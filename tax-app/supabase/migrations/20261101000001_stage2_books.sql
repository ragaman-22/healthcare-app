-- 第2段階: 勘定科目・取引・仕訳（ヘッダー/明細）・固定資産
-- 仕訳は「取引」「固定資産」から自動生成するものと、手入力のものがある。
-- 借方・貸方の一致はアプリと DB（遅延制約トリガー）の両方で検証する。

-- ============================================================
-- 勘定科目（user_id が null の行は全利用者共通の標準科目）
-- ============================================================
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  code text not null check (code ~ '^[0-9a-z]{3,8}$'),
  name text not null check (length(name) between 1 and 40),
  category text not null check (category in ('asset', 'liability', 'equity', 'revenue', 'expense')),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index accounts_system_code_idx on public.accounts (code) where user_id is null;
create unique index accounts_user_code_idx on public.accounts (user_id, code) where user_id is not null;

insert into public.accounts (code, name, category, sort_order) values
  ('101', '現金', 'asset', 101), ('102', '普通預金', 'asset', 102), ('110', '売掛金', 'asset', 110),
  ('120', '前払金', 'asset', 120), ('150', '工具器具備品', 'asset', 150), ('151', '車両運搬具', 'asset', 151),
  ('152', '建物附属設備', 'asset', 152), ('153', 'ソフトウェア', 'asset', 153), ('190', '事業主貸', 'asset', 190),
  ('201', '買掛金', 'liability', 201), ('202', '未払金', 'liability', 202), ('203', '預り金', 'liability', 203),
  ('204', '借入金', 'liability', 204), ('290', '事業主借', 'equity', 290), ('300', '元入金', 'equity', 300),
  ('400', '売上高', 'revenue', 400), ('410', '雑収入', 'revenue', 410),
  ('500', '仕入高', 'expense', 500), ('510', '租税公課', 'expense', 510), ('511', '荷造運賃', 'expense', 511),
  ('512', '水道光熱費', 'expense', 512), ('513', '旅費交通費', 'expense', 513), ('514', '通信費', 'expense', 514),
  ('515', '広告宣伝費', 'expense', 515), ('516', '接待交際費', 'expense', 516), ('517', '損害保険料', 'expense', 517),
  ('518', '修繕費', 'expense', 518), ('519', '消耗品費', 'expense', 519), ('520', '減価償却費', 'expense', 520),
  ('521', '福利厚生費', 'expense', 521), ('522', '給料賃金', 'expense', 522), ('523', '外注工賃', 'expense', 523),
  ('524', '利子割引料', 'expense', 524), ('525', '地代家賃', 'expense', 525), ('526', '貸倒金', 'expense', 526),
  ('527', '支払手数料', 'expense', 527), ('528', '新聞図書費', 'expense', 528), ('529', '会議費', 'expense', 529),
  ('530', '研修費', 'expense', 530), ('531', '車両費', 'expense', 531), ('599', '雑費', 'expense', 599);

-- ============================================================
-- 取引（売上・経費）
-- ============================================================
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('sale', 'expense')),
  occurred_on date not null,
  settled_on date,
  counterparty text not null default '',
  amount bigint not null check (amount > 0),
  withholding_tax bigint not null default 0 check (withholding_tax >= 0),
  account_code text not null,
  payment_account_code text not null,
  business_ratio int not null default 100 check (business_ratio between 0 and 100),
  ratio_basis text not null default '',
  tax_category text not null default 'taxable_10'
    check (tax_category in ('taxable_10', 'taxable_8', 'exempt', 'non_taxable', 'out_of_scope')),
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (withholding_tax < amount),
  check (settled_on is null or settled_on >= occurred_on),
  check (kind = 'sale' or (withholding_tax = 0 and settled_on is null))
);
create index transactions_user_date_idx on public.transactions (user_id, occurred_on);

-- ============================================================
-- 固定資産
-- ============================================================
create table public.fixed_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  account_code text not null,
  acquired_on date not null,
  started_use_on date not null,
  cost bigint not null check (cost > 1),
  useful_life int not null check (useful_life between 2 and 20),
  depreciation_method text not null default 'straight_line' check (depreciation_method in ('straight_line')),
  business_ratio int not null default 100 check (business_ratio between 1 and 100),
  payment_account_code text not null,
  disposed_on date,
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (started_use_on >= acquired_on),
  check (disposed_on is null or disposed_on >= started_use_on)
);
create index fixed_assets_user_idx on public.fixed_assets (user_id);

-- ============================================================
-- 仕訳ヘッダー・明細
-- ============================================================
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  entry_date date not null,
  description text not null default '',
  source text not null check (source in ('manual', 'transaction', 'fixed_asset')),
  transaction_id uuid references public.transactions on delete cascade,
  fixed_asset_id uuid references public.fixed_assets on delete cascade,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (source = 'manual' and transaction_id is null and fixed_asset_id is null)
    or (source = 'transaction' and transaction_id is not null and fixed_asset_id is null)
    or (source = 'fixed_asset' and fixed_asset_id is not null and transaction_id is null)
  )
);
create index journal_entries_user_date_idx on public.journal_entries (user_id, entry_date);
create index journal_entries_transaction_idx on public.journal_entries (transaction_id);
create index journal_entries_fixed_asset_idx on public.journal_entries (fixed_asset_id);

create table public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.journal_entries on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  line_no int not null,
  account_code text not null,
  side text not null check (side in ('debit', 'credit')),
  amount bigint not null check (amount > 0),
  memo text not null default '',
  unique (entry_id, line_no)
);
create index journal_lines_entry_idx on public.journal_lines (entry_id);

-- ============================================================
-- 整合性チェック
-- ============================================================

-- 勘定科目が存在し、利用者が使える科目か（標準科目 or 本人の科目）
create or replace function public.account_usable(p_user uuid, p_code text, p_category text default null)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.accounts a
    where a.code = p_code
      and (a.user_id is null or a.user_id = p_user)
      and (p_category is null or a.category = p_category)
  );
$$;

create or replace function public.check_journal_line()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.account_usable(new.user_id, new.account_code) then
    raise exception '勘定科目 % は使用できません', new.account_code using errcode = '23514';
  end if;
  if not exists (select 1 from public.journal_entries e where e.id = new.entry_id and e.user_id = new.user_id) then
    raise exception '仕訳ヘッダーの所有者が一致しません' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger journal_lines_check before insert or update on public.journal_lines
  for each row execute function public.check_journal_line();

-- 仕訳が参照する取引・固定資産は、仕訳と同じ利用者のものに限る
create or replace function public.check_journal_entry_links()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.transaction_id is not null
     and not exists (select 1 from public.transactions t where t.id = new.transaction_id and t.user_id = new.user_id) then
    raise exception '取引の所有者が一致しません' using errcode = '23514';
  end if;
  if new.fixed_asset_id is not null
     and not exists (select 1 from public.fixed_assets a where a.id = new.fixed_asset_id and a.user_id = new.user_id) then
    raise exception '固定資産の所有者が一致しません' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger journal_entries_links_check before insert or update on public.journal_entries
  for each row execute function public.check_journal_entry_links();

-- 借方合計 = 貸方合計（トランザクション終了時に検証）
create or replace function public.check_journal_balance()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_entry uuid;
  v_debit bigint;
  v_credit bigint;
begin
  -- PL/pgSQL は存在しない列を参照するとエラーになるため、CASE 式ではなく IF で分岐する
  if tg_table_name = 'journal_entries' then
    v_entry := new.id;
  elsif tg_op = 'DELETE' then
    v_entry := old.entry_id;
  else
    v_entry := new.entry_id;
  end if;
  if not exists (select 1 from public.journal_entries where id = v_entry) then
    return null; -- ヘッダーごと削除された
  end if;
  select coalesce(sum(amount) filter (where side = 'debit'), 0),
         coalesce(sum(amount) filter (where side = 'credit'), 0)
    into v_debit, v_credit
    from public.journal_lines where entry_id = v_entry;
  if v_debit = 0 or v_credit = 0 then
    raise exception '仕訳 % に借方または貸方がありません', v_entry using errcode = '23514';
  end if;
  if v_debit <> v_credit then
    raise exception '仕訳 % の借方合計(%)と貸方合計(%)が一致しません', v_entry, v_debit, v_credit using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger journal_lines_balance
  after insert or update or delete on public.journal_lines
  deferrable initially deferred
  for each row execute function public.check_journal_balance();

create constraint trigger journal_entries_balance
  after insert on public.journal_entries
  deferrable initially deferred
  for each row execute function public.check_journal_balance();

create trigger transactions_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();
create trigger fixed_assets_updated_at before update on public.fixed_assets
  for each row execute function public.set_updated_at();
create trigger journal_entries_updated_at before update on public.journal_entries
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS
-- ============================================================
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.fixed_assets enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;

create policy "accounts select" on public.accounts for select
  using (user_id is null or (select auth.uid()) = user_id);
create policy "accounts insert own" on public.accounts for insert
  with check ((select auth.uid()) = user_id);
create policy "accounts update own" on public.accounts for update
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "own transactions" on public.transactions for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own fixed_assets" on public.fixed_assets for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own journal_entries" on public.journal_entries for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own journal_lines" on public.journal_lines for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ============================================================
-- 保存用の関数（1トランザクションで取引と仕訳をまとめて保存し、履歴を残す）
-- security invoker のため RLS が適用される。
--
-- p_entries: [{ "date": "2026-01-31", "description": "...",
--               "lines": [{ "account_code": "102", "side": "debit", "amount": 1000, "memo": "" }, ...] }]
-- ============================================================

create or replace function public.insert_journal_entry(
  p_user uuid, p_source text, p_transaction uuid, p_asset uuid, p_entry jsonb, p_version int
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_line jsonb;
  v_no int := 0;
begin
  insert into public.journal_entries (user_id, entry_date, description, source, transaction_id, fixed_asset_id, version)
  values (p_user, (p_entry->>'date')::date, coalesce(p_entry->>'description', ''), p_source, p_transaction, p_asset, p_version)
  returning id into v_id;
  for v_line in select * from jsonb_array_elements(p_entry->'lines') loop
    v_no := v_no + 1;
    insert into public.journal_lines (entry_id, user_id, line_no, account_code, side, amount, memo)
    values (v_id, p_user, v_no, v_line->>'account_code', v_line->>'side', (v_line->>'amount')::bigint, coalesce(v_line->>'memo', ''));
  end loop;
  return v_id;
end;
$$;

-- 取引に紐づく仕訳を作り直す（旧仕訳は audit_logs に残す）
create or replace function public.replace_linked_entries(
  p_user uuid, p_source text, p_transaction uuid, p_asset uuid, p_entries jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_old jsonb;
  v_version int;
  v_entry jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('entry', to_jsonb(e), 'lines',
           (select jsonb_agg(to_jsonb(l) order by l.line_no) from public.journal_lines l where l.entry_id = e.id))), '[]'::jsonb),
         coalesce(max(e.version), 0) + 1
    into v_old, v_version
    from public.journal_entries e
   where e.user_id = p_user
     and ((p_transaction is not null and e.transaction_id = p_transaction)
       or (p_asset is not null and e.fixed_asset_id = p_asset));

  delete from public.journal_entries e
   where e.user_id = p_user
     and ((p_transaction is not null and e.transaction_id = p_transaction)
       or (p_asset is not null and e.fixed_asset_id = p_asset));

  for v_entry in select * from jsonb_array_elements(p_entries) loop
    perform public.insert_journal_entry(p_user, p_source, p_transaction, p_asset, v_entry, v_version);
  end loop;

  if jsonb_array_length(v_old) > 0 then
    insert into public.audit_logs (user_id, entity, entity_id, action, before, after)
    values (p_user, 'journal_entries', coalesce(p_transaction, p_asset)::text, 'update', v_old, p_entries);
  end if;
end;
$$;

create or replace function public.save_transaction(p_tx jsonb, p_entries jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid := coalesce((p_tx->>'id')::uuid, gen_random_uuid());
  v_before jsonb;
  v_after jsonb;
begin
  if v_user is null then raise exception 'ログインが必要です' using errcode = '42501'; end if;
  if not public.account_usable(v_user, p_tx->>'account_code')
     or not public.account_usable(v_user, p_tx->>'payment_account_code') then
    raise exception '勘定科目が不正です' using errcode = '23514';
  end if;

  select to_jsonb(t) into v_before from public.transactions t where t.id = v_id and t.user_id = v_user;
  if v_before is null and exists (select 1 from public.transactions where id = v_id) then
    raise exception '取引が見つかりません' using errcode = '42501';
  end if;

  insert into public.transactions as t (
    id, user_id, kind, occurred_on, settled_on, counterparty, amount, withholding_tax,
    account_code, payment_account_code, business_ratio, ratio_basis, tax_category, memo
  ) values (
    v_id, v_user, p_tx->>'kind', (p_tx->>'occurred_on')::date, nullif(p_tx->>'settled_on', '')::date,
    coalesce(p_tx->>'counterparty', ''), (p_tx->>'amount')::bigint, coalesce((p_tx->>'withholding_tax')::bigint, 0),
    p_tx->>'account_code', p_tx->>'payment_account_code', coalesce((p_tx->>'business_ratio')::int, 100),
    coalesce(p_tx->>'ratio_basis', ''), coalesce(p_tx->>'tax_category', 'taxable_10'), coalesce(p_tx->>'memo', '')
  )
  on conflict (id) do update set
    kind = excluded.kind, occurred_on = excluded.occurred_on, settled_on = excluded.settled_on,
    counterparty = excluded.counterparty, amount = excluded.amount, withholding_tax = excluded.withholding_tax,
    account_code = excluded.account_code, payment_account_code = excluded.payment_account_code,
    business_ratio = excluded.business_ratio, ratio_basis = excluded.ratio_basis,
    tax_category = excluded.tax_category, memo = excluded.memo
  where t.user_id = v_user
  returning to_jsonb(t) into v_after;
  -- 他の利用者の ID と衝突した場合（RLS で見えないため事前チェックを通過する）は更新されない
  if v_after is null then raise exception '取引が見つかりません' using errcode = '42501'; end if;

  perform public.replace_linked_entries(v_user, 'transaction', v_id, null, p_entries);

  insert into public.audit_logs (user_id, entity, entity_id, action, before, after)
  values (v_user, 'transactions', v_id::text, case when v_before is null then 'create' else 'update' end, v_before, v_after);
  return v_id;
end;
$$;

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
  delete from public.transactions where id = p_id and user_id = v_user; -- 仕訳は cascade で削除
  insert into public.audit_logs (user_id, entity, entity_id, action, before, after)
  values (v_user, 'transactions', p_id::text, 'delete', v_before, null);
end;
$$;

create or replace function public.save_fixed_asset(p_asset jsonb, p_entries jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid := coalesce((p_asset->>'id')::uuid, gen_random_uuid());
  v_before jsonb;
  v_after jsonb;
begin
  if v_user is null then raise exception 'ログインが必要です' using errcode = '42501'; end if;
  if not public.account_usable(v_user, p_asset->>'account_code', 'asset')
     or not public.account_usable(v_user, p_asset->>'payment_account_code') then
    raise exception '勘定科目が不正です' using errcode = '23514';
  end if;
  select to_jsonb(a) into v_before from public.fixed_assets a where a.id = v_id and a.user_id = v_user;
  if v_before is null and exists (select 1 from public.fixed_assets where id = v_id) then
    raise exception '固定資産が見つかりません' using errcode = '42501';
  end if;

  insert into public.fixed_assets as a (
    id, user_id, name, account_code, acquired_on, started_use_on, cost, useful_life,
    business_ratio, payment_account_code, disposed_on, memo
  ) values (
    v_id, v_user, p_asset->>'name', p_asset->>'account_code', (p_asset->>'acquired_on')::date,
    (p_asset->>'started_use_on')::date, (p_asset->>'cost')::bigint, (p_asset->>'useful_life')::int,
    (p_asset->>'business_ratio')::int, p_asset->>'payment_account_code', nullif(p_asset->>'disposed_on', '')::date,
    coalesce(p_asset->>'memo', '')
  )
  on conflict (id) do update set
    name = excluded.name, account_code = excluded.account_code, acquired_on = excluded.acquired_on,
    started_use_on = excluded.started_use_on, cost = excluded.cost, useful_life = excluded.useful_life,
    business_ratio = excluded.business_ratio, payment_account_code = excluded.payment_account_code,
    disposed_on = excluded.disposed_on, memo = excluded.memo
  where a.user_id = v_user
  returning to_jsonb(a) into v_after;
  if v_after is null then raise exception '固定資産が見つかりません' using errcode = '42501'; end if;

  perform public.replace_linked_entries(v_user, 'fixed_asset', null, v_id, p_entries);

  insert into public.audit_logs (user_id, entity, entity_id, action, before, after)
  values (v_user, 'fixed_assets', v_id::text, case when v_before is null then 'create' else 'update' end, v_before, v_after);
  return v_id;
end;
$$;

create or replace function public.delete_fixed_asset(p_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_before jsonb;
begin
  select to_jsonb(a) into v_before from public.fixed_assets a where a.id = p_id and a.user_id = v_user;
  if v_before is null then raise exception '固定資産が見つかりません' using errcode = '42501'; end if;
  delete from public.fixed_assets where id = p_id and user_id = v_user;
  insert into public.audit_logs (user_id, entity, entity_id, action, before, after)
  values (v_user, 'fixed_assets', p_id::text, 'delete', v_before, null);
end;
$$;

-- 手入力仕訳の作成・更新（明細は作り直し、version を上げる）
create or replace function public.save_manual_entry(p_id uuid, p_entry jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_before jsonb;
  v_version int := 1;
  v_id uuid;
begin
  if v_user is null then raise exception 'ログインが必要です' using errcode = '42501'; end if;
  if p_id is not null then
    select jsonb_build_object('entry', to_jsonb(e), 'lines',
             (select jsonb_agg(to_jsonb(l) order by l.line_no) from public.journal_lines l where l.entry_id = e.id)),
           e.version + 1
      into v_before, v_version
      from public.journal_entries e
     where e.id = p_id and e.user_id = v_user and e.source = 'manual';
    if v_before is null then raise exception '手入力の仕訳が見つかりません' using errcode = '42501'; end if;
    delete from public.journal_entries where id = p_id and user_id = v_user;
  end if;
  v_id := public.insert_journal_entry(v_user, 'manual', null, null, p_entry, v_version);
  insert into public.audit_logs (user_id, entity, entity_id, action, before, after)
  values (v_user, 'journal_entries', v_id::text, case when v_before is null then 'create' else 'update' end, v_before, p_entry);
  return v_id;
end;
$$;

create or replace function public.delete_manual_entry(p_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_before jsonb;
begin
  select jsonb_build_object('entry', to_jsonb(e), 'lines',
           (select jsonb_agg(to_jsonb(l) order by l.line_no) from public.journal_lines l where l.entry_id = e.id))
    into v_before
    from public.journal_entries e
   where e.id = p_id and e.user_id = v_user and e.source = 'manual';
  if v_before is null then raise exception '手入力の仕訳が見つかりません' using errcode = '42501'; end if;
  delete from public.journal_entries where id = p_id and user_id = v_user;
  insert into public.audit_logs (user_id, entity, entity_id, action, before, after)
  values (v_user, 'journal_entries', p_id::text, 'delete', v_before, null);
end;
$$;

