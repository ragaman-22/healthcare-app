-- 第7段階: 年次締め（締めた年の帳簿の変更を禁止）・期首残高の繰越・申告書データの作成履歴

alter table public.tax_year_settings add column closed_at timestamptz;

-- 仕訳の種類に「決算整理（締め時に保存する減価償却）」「期首（前年からの繰越）」を追加
alter table public.journal_entries drop constraint journal_entries_check;
alter table public.journal_entries drop constraint journal_entries_source_check;
alter table public.journal_entries add constraint journal_entries_source_check
  check (source in ('manual', 'transaction', 'fixed_asset', 'closing', 'opening'));
alter table public.journal_entries add constraint journal_entries_link_check check (
  (source in ('manual', 'opening') and transaction_id is null and fixed_asset_id is null)
  or (source = 'transaction' and transaction_id is not null and fixed_asset_id is null)
  or (source in ('fixed_asset', 'closing') and fixed_asset_id is not null and transaction_id is null)
);

-- ============================================================
-- 締めた年の判定と、変更の禁止
-- 締め処理・締めの取り消し（close_year / reopen_year）の中だけ、設定 app.closing = 'on' で許可する
-- ============================================================
create or replace function public.is_year_closed(p_user uuid, p_date date)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_date is not null and exists (
    select 1 from public.tax_year_settings s
    where s.user_id = p_user and s.tax_year = extract(year from p_date)::int and s.closed_at is not null
  );
$$;

create or replace function public.guard_closed_year()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid;
  v_dates date[];
begin
  if current_setting('app.closing', true) = 'on' then
    return coalesce(new, old);
  end if;

  if tg_table_name = 'transactions' then
    v_user := coalesce(new.user_id, old.user_id);
    v_dates := array[new.occurred_on, new.settled_on, old.occurred_on, old.settled_on];
  elsif tg_table_name = 'journal_entries' then
    v_user := coalesce(new.user_id, old.user_id);
    v_dates := array[new.entry_date, old.entry_date];
  elsif tg_table_name = 'journal_lines' then
    v_user := coalesce(new.user_id, old.user_id);
    select array_agg(e.entry_date) into v_dates
      from public.journal_entries e where e.id in (new.entry_id, old.entry_id);
  elsif tg_table_name = 'fixed_assets' then
    v_user := coalesce(new.user_id, old.user_id);
    -- 締めた年に取得した資産は、除却日・メモの変更（締めた年より後の除却）のみ許可
    if tg_op = 'UPDATE'
       and new.name = old.name and new.account_code = old.account_code and new.acquired_on = old.acquired_on
       and new.started_use_on = old.started_use_on and new.cost = old.cost and new.useful_life = old.useful_life
       and new.business_ratio = old.business_ratio and new.payment_account_code = old.payment_account_code
       and not public.is_year_closed(v_user, new.disposed_on)
       and not public.is_year_closed(v_user, old.disposed_on) then
      return new;
    end if;
    v_dates := array[new.acquired_on, old.acquired_on, new.disposed_on, old.disposed_on];
  end if;

  if exists (select 1 from unnest(v_dates) d where public.is_year_closed(v_user, d)) then
    raise exception '締め済みの年の帳簿は変更できません（締めを取り消してから変更してください）' using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger transactions_closed_guard before insert or update or delete on public.transactions
  for each row execute function public.guard_closed_year();
create trigger journal_entries_closed_guard before insert or update or delete on public.journal_entries
  for each row execute function public.guard_closed_year();
create trigger journal_lines_closed_guard before insert or update or delete on public.journal_lines
  for each row execute function public.guard_closed_year();
create trigger fixed_assets_closed_guard before insert or update or delete on public.fixed_assets
  for each row execute function public.guard_closed_year();

-- ============================================================
-- 年次締め: 決算整理仕訳（減価償却）と翌年の期首仕訳を保存し、年を締める
-- p_closing: [{ "fixed_asset_id": "...", "date": "2026-12-31", "description": "...", "lines": [...] }]
-- p_opening: { "date": "2027-01-01", "description": "...", "lines": [...] } または null
-- 仕訳の内容はアプリで計算し、貸借一致は遅延制約トリガーで検証する
-- ============================================================
create or replace function public.close_year(p_year int, p_closing jsonb, p_opening jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_entry jsonb;
begin
  if v_user is null then raise exception 'ログインが必要です' using errcode = '42501'; end if;
  if not exists (select 1 from public.tax_year_settings where user_id = v_user and tax_year = p_year) then
    raise exception '%年の申告設定がありません', p_year using errcode = '23514';
  end if;
  if exists (select 1 from public.tax_year_settings where user_id = v_user and tax_year = p_year and closed_at is not null) then
    raise exception '%年はすでに締め済みです', p_year using errcode = '23514';
  end if;
  if public.is_year_closed(v_user, make_date(p_year + 1, 1, 1)) then
    raise exception '翌年がすでに締め済みです' using errcode = '23514';
  end if;

  perform set_config('app.closing', 'on', true);

  -- 再締めに備え、前回の締めで作った仕訳を消してから作り直す
  delete from public.journal_entries
   where user_id = v_user and source = 'closing' and extract(year from entry_date) = p_year;
  delete from public.journal_entries
   where user_id = v_user and source = 'opening' and entry_date = make_date(p_year + 1, 1, 1);

  for v_entry in select * from jsonb_array_elements(coalesce(p_closing, '[]'::jsonb)) loop
    if extract(year from (v_entry->>'date')::date) <> p_year then
      raise exception '決算整理仕訳の日付が対象年ではありません' using errcode = '23514';
    end if;
    perform public.insert_journal_entry(v_user, 'closing', null, (v_entry->>'fixed_asset_id')::uuid, v_entry, 1);
  end loop;
  if p_opening is not null then
    if (p_opening->>'date')::date <> make_date(p_year + 1, 1, 1) then
      raise exception '期首仕訳の日付は翌年1月1日です' using errcode = '23514';
    end if;
    perform public.insert_journal_entry(v_user, 'opening', null, null, p_opening, 1);
  end if;

  update public.tax_year_settings set closed_at = now() where user_id = v_user and tax_year = p_year;
  perform set_config('app.closing', 'off', true);

  insert into public.audit_logs (user_id, entity, entity_id, action, before, after)
  values (v_user, 'year_closing', p_year::text, 'create', null, jsonb_build_object('closing', p_closing, 'opening', p_opening));
end;
$$;

create or replace function public.reopen_year(p_year int)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'ログインが必要です' using errcode = '42501'; end if;
  if not exists (select 1 from public.tax_year_settings where user_id = v_user and tax_year = p_year and closed_at is not null) then
    raise exception '%年は締められていません', p_year using errcode = '23514';
  end if;
  if public.is_year_closed(v_user, make_date(p_year + 1, 1, 1)) then
    raise exception '翌年が締め済みのため、先に翌年の締めを取り消してください' using errcode = '23514';
  end if;

  perform set_config('app.closing', 'on', true);
  delete from public.journal_entries
   where user_id = v_user and source = 'closing' and extract(year from entry_date) = p_year;
  delete from public.journal_entries
   where user_id = v_user and source = 'opening' and entry_date = make_date(p_year + 1, 1, 1);
  update public.tax_year_settings set closed_at = null where user_id = v_user and tax_year = p_year;
  perform set_config('app.closing', 'off', true);

  insert into public.audit_logs (user_id, entity, entity_id, action, before, after)
  values (v_user, 'year_closing', p_year::text, 'delete', null, null);
end;
$$;

-- ============================================================
-- 申告書データの作成履歴（作成時点の計算結果を保存。変更・削除不可）
-- ============================================================
create table public.tax_returns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  tax_year int not null,
  version int not null,
  -- blue: 青色申告決算書＋確定申告書 / white: 収支内訳書＋確定申告書
  form_type text not null check (form_type in ('blue', 'white')),
  -- draft: 下書き（年の途中・確認事項あり） / checked: 確認事項なし / unsupported: 対象外の項目あり
  status text not null check (status in ('draft', 'checked', 'unsupported')),
  rule_version text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, tax_year, version)
);

alter table public.tax_returns enable row level security;
create policy "own tax_returns select" on public.tax_returns for select using ((select auth.uid()) = user_id);
create policy "own tax_returns insert" on public.tax_returns for insert with check ((select auth.uid()) = user_id);
