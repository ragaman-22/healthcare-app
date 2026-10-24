-- 第8段階: すべてのテーブルで RLS が有効か・データの全削除
\set ON_ERROR_STOP on

-- public スキーマのすべてのテーブルで RLS が有効になっていること
do $$
declare v_missing text;
begin
  select string_agg(tablename, ', ') into v_missing
    from pg_tables where schemaname = 'public' and not rowsecurity;
  if v_missing is not null then raise exception 'RLS is disabled on: %', v_missing; end if;
end $$;

-- security definer の関数は search_path を固定していること
do $$
declare v_bad text;
begin
  select string_agg(p.proname, ', ') into v_bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
  if v_bad is not null then raise exception 'security definer without search_path: %', v_bad; end if;
end $$;

set role authenticated;

-- 利用者B（締め済みの年あり）のデータを全削除。利用者Aのデータは残る
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
create temp table a_counts as
  select (select count(*) from public.journal_entries) as entries, (select count(*) from public.tax_notices) as notices;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select public.close_year(2025, '[]'::jsonb, null);
select public.delete_my_data();
do $$ begin
  if exists (select 1 from public.journal_entries) or exists (select 1 from public.transactions)
     or exists (select 1 from public.fixed_assets) or exists (select 1 from public.tax_year_settings)
     or exists (select 1 from public.tax_returns) or exists (select 1 from public.audit_logs) then
    raise exception 'B data remains after delete_my_data';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
do $$ begin
  if (select count(*) from public.journal_entries) <> (select entries from a_counts)
     or (select count(*) from public.tax_notices) <> (select notices from a_counts) then
    raise exception 'A data was affected';
  end if;
end $$;

-- 未ログインでは実行できない
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
do $$ begin
  if has_function_privilege('anon', 'public.delete_my_data()', 'execute') then
    raise exception 'anon has execute privilege on delete_my_data';
  end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
  ) then
    raise exception 'anon can execute some public functions';
  end if;
  begin
    perform public.delete_my_data();
    raise exception 'anon could call delete_my_data';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select 'SECURITY DATABASE TESTS PASSED' as result;
