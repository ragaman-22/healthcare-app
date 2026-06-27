-- profiles (Supabase Auth userと1対1)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text not null default '',
  role text not null default 'patient' check (role in ('patient', 'provider', 'admin')),
  organization_id uuid,
  created_at timestamptz default now()
);

-- 新規ユーザー登録時に自動でprofileを作成するトリガー
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'patient')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- organizations
create table organizations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  type text not null default 'clinic',
  address text,
  phone text,
  created_at timestamptz default now()
);

-- patient_provider_links
create table patient_provider_links (
  id uuid default gen_random_uuid() primary key,
  patient_id uuid references profiles(id) on delete cascade not null,
  provider_id uuid references profiles(id) on delete cascade not null,
  organization_id uuid references organizations(id),
  status text not null default 'pending' check (status in ('pending', 'active', 'revoked')),
  created_at timestamptz default now(),
  unique(patient_id, provider_id)
);

-- vitals
create table vitals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  type text not null check (type in ('weight', 'systolic', 'diastolic', 'temperature', 'spo2', 'pulse')),
  value numeric not null,
  unit text not null,
  measured_at timestamptz not null,
  note text,
  device_source text,
  created_at timestamptz default now()
);
create index vitals_user_measured on vitals(user_id, measured_at desc);

-- life_records
create table life_records (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  type text not null check (type in ('meal', 'medication', 'steps', 'event', 'photo')),
  title text not null,
  description text,
  value numeric,
  unit text,
  photo_url text,
  recorded_at timestamptz not null,
  created_at timestamptz default now()
);
create index life_records_user_recorded on life_records(user_id, recorded_at desc);

-- glucose_records
create table glucose_records (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  glucose numeric,
  hba1c numeric,
  insulin_type text,
  insulin_units numeric,
  timing text not null check (timing in ('before_meal', 'after_meal', 'fasting', 'bedtime', 'other')),
  measured_at timestamptz not null,
  note text,
  created_at timestamptz default now()
);
create index glucose_user_measured on glucose_records(user_id, measured_at desc);

-- lab_results
create table lab_results (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  institution_name text not null,
  test_name text not null,
  value numeric not null,
  unit text not null,
  reference_min numeric,
  reference_max numeric,
  tested_at timestamptz not null,
  note text,
  created_at timestamptz default now()
);
create index lab_user_tested on lab_results(user_id, tested_at desc);

-- ============================================
-- RLS (Row Level Security)
-- ============================================

alter table profiles enable row level security;
alter table vitals enable row level security;
alter table life_records enable row level security;
alter table glucose_records enable row level security;
alter table lab_results enable row level security;
alter table patient_provider_links enable row level security;
alter table organizations enable row level security;

-- profiles: 本人は全操作可。providerは担当患者のprofileを閲覧可
create policy "own profile" on profiles
  for all using (auth.uid() = id);

create policy "provider can view linked patients" on profiles
  for select using (
    exists (
      select 1 from patient_provider_links
      where provider_id = auth.uid()
        and patient_id = profiles.id
        and status = 'active'
    )
  );

-- vitals: 本人のみ読み書き可。担当providerは閲覧のみ
create policy "own vitals" on vitals
  for all using (auth.uid() = user_id);

create policy "provider reads patient vitals" on vitals
  for select using (
    exists (
      select 1 from patient_provider_links
      where provider_id = auth.uid()
        and patient_id = vitals.user_id
        and status = 'active'
    )
  );

-- life_records
create policy "own life records" on life_records
  for all using (auth.uid() = user_id);

create policy "provider reads life records" on life_records
  for select using (
    exists (
      select 1 from patient_provider_links
      where provider_id = auth.uid()
        and patient_id = life_records.user_id
        and status = 'active'
    )
  );

-- glucose_records
create policy "own glucose" on glucose_records
  for all using (auth.uid() = user_id);

create policy "provider reads glucose" on glucose_records
  for select using (
    exists (
      select 1 from patient_provider_links
      where provider_id = auth.uid()
        and patient_id = glucose_records.user_id
        and status = 'active'
    )
  );

-- lab_results
create policy "own labs" on lab_results
  for all using (auth.uid() = user_id);

create policy "provider reads labs" on lab_results
  for select using (
    exists (
      select 1 from patient_provider_links
      where provider_id = auth.uid()
        and patient_id = lab_results.user_id
        and status = 'active'
    )
  );

-- patient_provider_links: 患者は自分の招待を管理。providerは自分への招待を閲覧
create policy "patient manages own links" on patient_provider_links
  for all using (auth.uid() = patient_id);

create policy "provider views own links" on patient_provider_links
  for select using (auth.uid() = provider_id);

-- organizations: 全員閲覧可、adminのみ作成可
create policy "anyone can view orgs" on organizations
  for select using (true);

-- Storage bucket for photos
insert into storage.buckets (id, name, public) values ('photos', 'photos', true);

create policy "authenticated users can upload photos" on storage.objects
  for insert with check (bucket_id = 'photos' and auth.role() = 'authenticated');

create policy "photos are publicly readable" on storage.objects
  for select using (bucket_id = 'photos');
