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
