-- 自動生成ファイル（scripts/bundle-migrations.sh）。直接編集しないこと。
-- 新しい Supabase プロジェクトの SQL Editor に全文を貼り付けて、一度だけ実行する。
begin;

-- ===== 20261024000001_stage1_foundation.sql =====
-- 第1段階: 利用者プロフィール・事業者情報・年度別申告設定・控除情報・税額計算結果・操作履歴
-- 金額はすべて円単位の整数（bigint）で保存する。

create extension if not exists pgcrypto;

-- ============================================================
-- 利用者プロフィール（auth.users と 1対1）
-- ============================================================
create table public.user_profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null default '',
  birth_date date,
  prefecture text not null default '',
  city text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 事業者情報
-- ============================================================
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null default '',
  industry text not null default '',
  started_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index businesses_user_id_idx on public.businesses (user_id);

-- ============================================================
-- 年度別申告設定
-- null は「未入力」。0 とは区別する。
-- ============================================================
create table public.tax_year_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  business_id uuid not null references public.businesses on delete cascade,
  tax_year int not null check (tax_year between 2020 and 2100),
  filing_type text not null default 'unknown' check (filing_type in ('blue', 'white', 'unknown')),
  blue_deduction_type text not null default 'unknown'
    check (blue_deduction_type in ('e_tax_65', 'paper_55', 'simple_10', 'none', 'unknown')),
  has_spouse text not null default 'unknown' check (has_spouse in ('yes', 'no', 'unknown')),
  dependents_count int check (dependents_count >= 0),
  has_salary_income text not null default 'unknown' check (has_salary_income in ('yes', 'no', 'unknown')),
  has_other_income text not null default 'unknown' check (has_other_income in ('yes', 'no', 'unknown')),
  withholding_tax bigint check (withholding_tax >= 0),
  estimated_tax_prepaid bigint check (estimated_tax_prepaid >= 0),
  consumption_tax_status text not null default 'unknown'
    check (consumption_tax_status in ('exempt', 'taxable_two_tenths', 'taxable_simplified', 'taxable_general', 'unknown')),
  business_tax_rate numeric(5, 4) check (business_tax_rate between 0 and 0.1),
  nhi_enrolled text not null default 'unknown' check (nhi_enrolled in ('yes', 'no', 'unknown')),
  nhi_members int check (nhi_members >= 1),
  -- 自治体の国保料率（医療・支援・介護・子ども子育て支援金分）。未入力は null（参考値で試算）
  nhi_rates jsonb,
  -- 取引登録機能（第2段階）実装前の、今年の売上・経費の概算入力
  ytd_revenue bigint check (ytd_revenue >= 0),
  ytd_expenses bigint check (ytd_expenses >= 0),
  ytd_as_of date,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, tax_year)
);

-- ============================================================
-- 控除情報（年度ごと・種類ごと）
-- ============================================================
create table public.deductions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  tax_year int not null,
  kind text not null check (kind in (
    'social_insurance', 'small_business_mutual_aid', 'life_insurance', 'other'
  )),
  -- 控除額（社会保険料は支払額＝控除額）
  amount bigint not null check (amount >= 0),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, tax_year, kind)
);

-- ============================================================
-- 税額計算結果（再現できるよう、入力条件とルールのバージョンを保存）
-- ============================================================
create table public.tax_calculations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  tax_year int not null,
  rule_version text not null,
  calculated_at timestamptz not null default now(),
  inputs jsonb not null,
  result jsonb not null
);
create index tax_calculations_user_year_idx on public.tax_calculations (user_id, tax_year, calculated_at desc);

-- ============================================================
-- 修正・操作履歴
-- ============================================================
create table public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  entity text not null,
  entity_id text,
  action text not null check (action in ('create', 'update', 'delete')),
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_user_idx on public.audit_logs (user_id, created_at desc);

-- ============================================================
-- updated_at の自動更新
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_profiles_updated_at before update on public.user_profiles
  for each row execute function public.set_updated_at();
create trigger businesses_updated_at before update on public.businesses
  for each row execute function public.set_updated_at();
create trigger tax_year_settings_updated_at before update on public.tax_year_settings
  for each row execute function public.set_updated_at();
create trigger deductions_updated_at before update on public.deductions
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS: 各利用者は自分のデータのみ参照・更新できる
-- ============================================================
alter table public.user_profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.tax_year_settings enable row level security;
alter table public.deductions enable row level security;
alter table public.tax_calculations enable row level security;
alter table public.audit_logs enable row level security;

create policy "own profile select" on public.user_profiles for select using ((select auth.uid()) = id);
create policy "own profile update" on public.user_profiles for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "own businesses" on public.businesses for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "own tax_year_settings" on public.tax_year_settings for all
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.businesses b where b.id = business_id and b.user_id = (select auth.uid()))
  );

create policy "own deductions" on public.deductions for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- 計算結果・操作履歴は追記のみ（更新・削除不可）
create policy "own tax_calculations select" on public.tax_calculations for select using ((select auth.uid()) = user_id);
create policy "own tax_calculations insert" on public.tax_calculations for insert with check ((select auth.uid()) = user_id);

create policy "own audit_logs select" on public.audit_logs for select using ((select auth.uid()) = user_id);
create policy "own audit_logs insert" on public.audit_logs for insert with check ((select auth.uid()) = user_id);

-- ===== 20261101000001_stage2_books.sql =====
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


-- ===== 20261110000001_stage3_receipts.sql =====
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

-- ===== 20261120000001_stage4_deductions.sql =====
-- 第4段階: 控除の詳細（人的控除・保険料・医療費・寄附金）と給与収入

-- 控除情報に詳細（支払額・家族の情報など）を保存できるようにする
alter table public.deductions add column detail jsonb;
alter table public.deductions drop constraint deductions_kind_check;
alter table public.deductions add constraint deductions_kind_check check (kind in (
  'social_insurance', 'small_business_mutual_aid', 'life_insurance', 'other',
  -- 以下は detail に詳細を保存する（amount は 0）
  'family', 'life_insurance_paid', 'earthquake_insurance', 'medical', 'donation'
));

-- 事業所得以外の所得（現在は給与のみ）
create table public.other_incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  tax_year int not null,
  kind text not null check (kind in ('salary')),
  -- 収入金額（給与は源泉徴収票の支払金額）
  revenue bigint not null check (revenue >= 0),
  withholding_tax bigint not null default 0 check (withholding_tax >= 0),
  social_insurance bigint not null default 0 check (social_insurance >= 0),
  detail jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, tax_year, kind)
);

create trigger other_incomes_updated_at before update on public.other_incomes
  for each row execute function public.set_updated_at();

alter table public.other_incomes enable row level security;
create policy "own other_incomes" on public.other_incomes for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ===== 20261201000001_stage5_schedule.sql =====
-- 第5段階: 自治体の設定・取り置き額・通知書の金額（確定額）・納付済みの記録

alter table public.tax_year_settings
  -- 住民税の級地・徴収方法、国保の納期・世帯の情報、所得税の納め方（LocalSettings）
  add column local_settings jsonb,
  -- 利用者が自分で取り置いている金額（口座残高ではなく自己申告の目安）
  add column reserved_amount bigint check (reserved_amount >= 0);

-- 通知書（住民税・国保・事業税の納税通知書、予定納税額の通知）で確定した金額
create table public.tax_notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  tax_type text not null check (tax_type in ('prepayment', 'resident', 'nhi', 'business')),
  -- 年度（予定納税は対象の年分）
  fiscal_year int not null check (fiscal_year between 2020 and 2100),
  total bigint not null check (total >= 0),
  -- 各期の納期限と金額 [{ "dueDate": "2027-06-30", "amount": 50000 }]。null は一般的な納期で分割
  installments jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, tax_type, fiscal_year)
);

create trigger tax_notices_updated_at before update on public.tax_notices
  for each row execute function public.set_updated_at();

-- 納付済みの記録（payment_key は 税目:年度:期。例 resident:2027:1）
create table public.tax_payment_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  payment_key text not null check (payment_key ~ '^(income_tax|consumption_tax|prepayment|resident|nhi|business):\d{4}:\d{1,2}$'),
  paid_on date not null,
  amount bigint not null,
  created_at timestamptz not null default now(),
  unique (user_id, payment_key)
);

alter table public.tax_notices enable row level security;
alter table public.tax_payment_records enable row level security;
create policy "own tax_notices" on public.tax_notices for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own tax_payment_records" on public.tax_payment_records for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ===== 20261210000001_stage6_forecast.sql =====
-- 第6段階: 年末予測の手入力補正（年末までの残りの売上・経費の見込み）
alter table public.tax_year_settings add column forecast_adjustment jsonb;

-- ===== 20261220000001_stage7_closing_returns.sql =====
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

-- ===== 20261230000001_stage8_data_management.sql =====
-- 第8段階: 利用者によるデータの全削除

-- 本人のデータをすべて削除する（ログインアカウント自体の削除は、サーバーの管理者権限で別途行う）。
-- 履歴（audit_logs）など本人でも削除できないテーブルを含めて消すため security definer とし、
-- 必ず auth.uid() の行だけを対象にする。
create or replace function public.delete_my_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'ログインが必要です' using errcode = '42501'; end if;
  -- 締めた年の帳簿も削除できるようにする（このトランザクション内のみ）
  perform set_config('app.closing', 'on', true);

  delete from public.tax_payment_records where user_id = v_user;
  delete from public.tax_notices where user_id = v_user;
  delete from public.tax_returns where user_id = v_user;
  delete from public.tax_calculations where user_id = v_user;
  delete from public.ocr_results where user_id = v_user;
  delete from public.journal_entries where user_id = v_user;
  update public.documents set transaction_id = null where user_id = v_user;
  delete from public.transactions where user_id = v_user;
  delete from public.documents where user_id = v_user;
  delete from public.fixed_assets where user_id = v_user;
  delete from public.deductions where user_id = v_user;
  delete from public.other_incomes where user_id = v_user;
  delete from public.tax_year_settings where user_id = v_user;
  delete from public.businesses where user_id = v_user;
  delete from public.accounts where user_id = v_user;
  delete from public.audit_logs where user_id = v_user;
  update public.user_profiles set display_name = '', birth_date = null, prefecture = '', city = '' where id = v_user;

  perform set_config('app.closing', 'off', true);
end;
$$;

revoke execute on function public.delete_my_data() from public, anon;
grant execute on function public.delete_my_data() to authenticated;

-- 未ログイン（anon）からはアプリの関数を一切呼べないようにする（各関数でも auth.uid() を確認しているが、多層防御として）
-- PostgreSQL は関数の実行権限を PUBLIC（全ロール）に付与するため、PUBLIC と anon から取り消し、
-- ログイン済み（authenticated）とサーバー（service_role）に明示的に付与する
revoke execute on all functions in schema public from public, anon;
alter default privileges in schema public revoke execute on functions from public, anon;
grant execute on all functions in schema public to authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on all functions in schema public to service_role';
  end if;
end $$;

commit;
