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
