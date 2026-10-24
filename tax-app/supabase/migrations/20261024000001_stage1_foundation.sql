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
