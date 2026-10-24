-- ローカル PostgreSQL でマイグレーションを検証するための、Supabase の最小限の代替（本番では使わない）
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

-- Supabase と同じく、public スキーマに作られるオブジェクトの既定の権限を anon / authenticated に付与する
-- （マイグレーション内の revoke が有効になるよう、マイグレーションより前に設定する）
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
