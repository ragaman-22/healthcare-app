-- Supabase の既定の権限に相当（RLS で行を制限する前提で、テーブル権限は付与されている）
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
