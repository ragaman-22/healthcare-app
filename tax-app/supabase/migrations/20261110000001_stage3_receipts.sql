-- 第3段階: 証憑画像（レシート・領収書）・OCR 読み取り結果・取引との関連付け

-- ============================================================
-- 証憑画像
-- ============================================================
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  -- Supabase Storage のパス（{user_id}/{document_id}.{ext}）
  storage_path text not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')),
  size_bytes int not null check (size_bytes > 0 and size_bytes <= 10485760),
  original_filename text not null default '',
  -- pending: 確認待ち / confirmed: 取引として登録済み / discarded: 登録しない（私用など）
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'discarded')),
  transaction_id uuid references public.transactions on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (storage_path like user_id::text || '/%'),
  check (status <> 'confirmed' or transaction_id is not null)
);
create index documents_user_idx on public.documents (user_id, created_at desc);
create index documents_user_sha_idx on public.documents (user_id, sha256);

create trigger documents_updated_at before update on public.documents
  for each row execute function public.set_updated_at();

-- ============================================================
-- OCR 読み取り結果（読み取りのたびに追記。最新のものを表示）
-- ============================================================
create table public.ocr_results (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  provider text not null check (provider in ('anthropic', 'demo', 'none')),
  model text,
  -- 検証済みの読み取り結果（読み取れない項目は null）
  fields jsonb,
  -- AI の生の出力（検証前）。検証ロジックの改善・監査用
  raw jsonb,
  error text,
  created_at timestamptz not null default now()
);
create index ocr_results_document_idx on public.ocr_results (document_id, created_at desc);

-- ============================================================
-- 取引と証憑の関連付け
-- ============================================================
alter table public.transactions add column document_id uuid references public.documents on delete set null;
create index transactions_document_idx on public.transactions (document_id);

-- 証憑・OCR 結果・取引が参照する証憑は同じ利用者のものに限る
create or replace function public.check_document_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'ocr_results' then
    if not exists (select 1 from public.documents d where d.id = new.document_id and d.user_id = new.user_id) then
      raise exception '証憑の所有者が一致しません' using errcode = '23514';
    end if;
  elsif tg_table_name = 'transactions' then
    if new.document_id is not null
       and not exists (select 1 from public.documents d where d.id = new.document_id and d.user_id = new.user_id) then
      raise exception '証憑の所有者が一致しません' using errcode = '23514';
    end if;
  elsif tg_table_name = 'documents' then
    if new.transaction_id is not null
       and not exists (select 1 from public.transactions t where t.id = new.transaction_id and t.user_id = new.user_id) then
      raise exception '取引の所有者が一致しません' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger ocr_results_owner_check before insert or update on public.ocr_results
  for each row execute function public.check_document_owner();
create trigger transactions_document_owner_check before insert or update of document_id on public.transactions
  for each row execute function public.check_document_owner();
create trigger documents_transaction_owner_check before insert or update of transaction_id on public.documents
  for each row execute function public.check_document_owner();

-- ============================================================
-- RLS
-- ============================================================
alter table public.documents enable row level security;
alter table public.ocr_results enable row level security;

create policy "own documents select" on public.documents for select using ((select auth.uid()) = user_id);
create policy "own documents insert" on public.documents for insert with check ((select auth.uid()) = user_id);
create policy "own documents update" on public.documents for update
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- 取引として登録済みの証憑は削除できない（帳簿の根拠を残すため。先に取引を削除する）
create policy "own documents delete" on public.documents for delete
  using ((select auth.uid()) = user_id and status <> 'confirmed');
-- OCR 結果は追記のみ
create policy "own ocr_results select" on public.ocr_results for select using ((select auth.uid()) = user_id);
create policy "own ocr_results insert" on public.ocr_results for insert with check ((select auth.uid()) = user_id);

-- ============================================================
-- 取引の保存関数を更新: 証憑と関連付け、証憑を「登録済み」にする
-- ============================================================
create or replace function public.save_transaction(p_tx jsonb, p_entries jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid := coalesce((p_tx->>'id')::uuid, gen_random_uuid());
  v_doc uuid := nullif(p_tx->>'document_id', '')::uuid;
  v_before jsonb;
  v_after jsonb;
begin
  if v_user is null then raise exception 'ログインが必要です' using errcode = '42501'; end if;
  if not public.account_usable(v_user, p_tx->>'account_code')
     or not public.account_usable(v_user, p_tx->>'payment_account_code') then
    raise exception '勘定科目が不正です' using errcode = '23514';
  end if;
  if v_doc is not null and not exists (
    select 1 from public.documents d where d.id = v_doc and d.user_id = v_user
      and (d.transaction_id is null or d.transaction_id = v_id)
  ) then
    raise exception '証憑が見つからないか、別の取引に登録済みです' using errcode = '23514';
  end if;

  select to_jsonb(t) into v_before from public.transactions t where t.id = v_id and t.user_id = v_user;
  if v_before is null and exists (select 1 from public.transactions where id = v_id) then
    raise exception '取引が見つかりません' using errcode = '42501';
  end if;

  insert into public.transactions as t (
    id, user_id, kind, occurred_on, settled_on, counterparty, amount, withholding_tax,
    account_code, payment_account_code, business_ratio, ratio_basis, tax_category, memo, document_id
  ) values (
    v_id, v_user, p_tx->>'kind', (p_tx->>'occurred_on')::date, nullif(p_tx->>'settled_on', '')::date,
    coalesce(p_tx->>'counterparty', ''), (p_tx->>'amount')::bigint, coalesce((p_tx->>'withholding_tax')::bigint, 0),
    p_tx->>'account_code', p_tx->>'payment_account_code', coalesce((p_tx->>'business_ratio')::int, 100),
    coalesce(p_tx->>'ratio_basis', ''), coalesce(p_tx->>'tax_category', 'taxable_10'), coalesce(p_tx->>'memo', ''), v_doc
  )
  on conflict (id) do update set
    kind = excluded.kind, occurred_on = excluded.occurred_on, settled_on = excluded.settled_on,
    counterparty = excluded.counterparty, amount = excluded.amount, withholding_tax = excluded.withholding_tax,
    account_code = excluded.account_code, payment_account_code = excluded.payment_account_code,
    business_ratio = excluded.business_ratio, ratio_basis = excluded.ratio_basis,
    tax_category = excluded.tax_category, memo = excluded.memo,
    -- 編集時に証憑の指定がなければ、既存の関連付けを維持する
    document_id = coalesce(excluded.document_id, t.document_id)
  where t.user_id = v_user
  returning to_jsonb(t) into v_after;
  if v_after is null then raise exception '取引が見つかりません' using errcode = '42501'; end if;

  perform public.replace_linked_entries(v_user, 'transaction', v_id, null, p_entries);

  if v_doc is not null then
    update public.documents set status = 'confirmed', transaction_id = v_id where id = v_doc and user_id = v_user;
  end if;

  insert into public.audit_logs (user_id, entity, entity_id, action, before, after)
  values (v_user, 'transactions', v_id::text, case when v_before is null then 'create' else 'update' end, v_before, v_after);
  return v_id;
end;
$$;

-- 取引を削除したら、関連付けていた証憑は「確認待ち」に戻す（画像は残す）
create or replace function public.delete_transaction(p_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_before jsonb;
begin
  select to_jsonb(t) into v_before from public.transactions t where t.id = p_id and t.user_id = v_user;
  if v_before is null then raise exception '取引が見つかりません' using errcode = '42501'; end if;
  update public.documents set status = 'pending', transaction_id = null where transaction_id = p_id and user_id = v_user;
  delete from public.transactions where id = p_id and user_id = v_user;
  insert into public.audit_logs (user_id, entity, entity_id, action, before, after)
  values (v_user, 'transactions', p_id::text, 'delete', v_before, null);
end;
$$;

-- ============================================================
-- Supabase Storage: 非公開バケット receipts と、本人のフォルダのみ操作できるポリシー
-- （ローカルの DB テストでは storage スキーマがないため、存在する場合のみ作成する）
-- ============================================================
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('receipts', 'receipts', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
    on conflict (id) do nothing;

    execute $p$create policy "receipts select own" on storage.objects for select to authenticated
      using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
    execute $p$create policy "receipts insert own" on storage.objects for insert to authenticated
      with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
    execute $p$create policy "receipts delete own" on storage.objects for delete to authenticated
      using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
  end if;
end $$;
