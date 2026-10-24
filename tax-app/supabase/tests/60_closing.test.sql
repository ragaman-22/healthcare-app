-- 第7段階: 年次締め・締めた年の変更禁止・申告書データの履歴
\set ON_ERROR_STOP on

create function pg_temp.login(p uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p::text, false);
$$;
create function pg_temp.expect_error(p_sql text, p_like text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm not like p_like then raise exception 'expected error like "%", got "%"', p_like, sqlerrm; end if;
    return;
  end;
  raise exception 'expected error like "%" but statement succeeded: %', p_like, p_sql;
end;
$$;

set role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000b');

insert into public.businesses (id, user_id) values ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b');
insert into public.tax_year_settings (user_id, business_id, tax_year)
values ('00000000-0000-0000-0000-00000000000b', '50000000-0000-0000-0000-000000000001', 2025);

-- 2025年の取引と固定資産
select public.save_transaction(
  '{"id":"60000000-0000-0000-0000-000000000001","kind":"sale","occurred_on":"2025-05-31","settled_on":"2025-06-30",
    "amount":500000,"account_code":"400","payment_account_code":"102"}'::jsonb,
  '[{"date":"2025-05-31","description":"売上","lines":[{"account_code":"110","side":"debit","amount":500000},{"account_code":"400","side":"credit","amount":500000}]},
    {"date":"2025-06-30","description":"入金","lines":[{"account_code":"102","side":"debit","amount":500000},{"account_code":"110","side":"credit","amount":500000}]}]'::jsonb);
select public.save_fixed_asset(
  '{"id":"61000000-0000-0000-0000-000000000001","name":"PC","account_code":"150","acquired_on":"2025-07-01","started_use_on":"2025-07-01",
    "cost":300000,"useful_life":4,"business_ratio":100,"payment_account_code":"102"}'::jsonb,
  '[{"date":"2025-07-01","description":"PC取得","lines":[{"account_code":"150","side":"debit","amount":300000},{"account_code":"102","side":"credit","amount":300000}]}]'::jsonb);

-- 締め: 減価償却の決算整理仕訳と、翌年の期首仕訳
select public.close_year(2025,
  '[{"fixed_asset_id":"61000000-0000-0000-0000-000000000001","date":"2025-12-31","description":"PC 減価償却",
     "lines":[{"account_code":"520","side":"debit","amount":37500},{"account_code":"150","side":"credit","amount":37500}]}]'::jsonb,
  '{"date":"2026-01-01","description":"期首残高","lines":[
     {"account_code":"102","side":"debit","amount":200000},{"account_code":"150","side":"debit","amount":262500},
     {"account_code":"300","side":"credit","amount":462500}]}'::jsonb);

do $$ begin
  if (select closed_at from public.tax_year_settings where tax_year = 2025) is null then raise exception 'not closed'; end if;
  if (select count(*) from public.journal_entries where source = 'closing') <> 1 then raise exception 'closing entry missing'; end if;
  if (select count(*) from public.journal_entries where source = 'opening' and entry_date = '2026-01-01') <> 1 then raise exception 'opening entry missing'; end if;
end $$;

-- 締めた年の取引・仕訳・資産は変更できない
select pg_temp.expect_error($q$
  select public.save_transaction(
    '{"id":"60000000-0000-0000-0000-000000000001","kind":"sale","occurred_on":"2025-05-31","amount":1,"account_code":"400","payment_account_code":"102"}'::jsonb,
    '[{"date":"2025-05-31","description":"x","lines":[{"account_code":"110","side":"debit","amount":1},{"account_code":"400","side":"credit","amount":1}]}]'::jsonb)
$q$, '%締め済みの年%');
select pg_temp.expect_error($q$ select public.delete_transaction('60000000-0000-0000-0000-000000000001') $q$, '%締め済みの年%');
select pg_temp.expect_error($q$
  select public.save_manual_entry(null, '{"date":"2025-12-01","description":"x","lines":[{"account_code":"102","side":"debit","amount":1},{"account_code":"300","side":"credit","amount":1}]}'::jsonb)
$q$, '%締め済みの年%');
select pg_temp.expect_error($q$ update public.fixed_assets set cost = 1 where id = '61000000-0000-0000-0000-000000000001' $q$, '%締め済みの年%');
select pg_temp.expect_error($q$ select public.close_year(2025, '[]'::jsonb, null) $q$, '%すでに締め済み%');

-- 締めた年より後の除却は記録できる
update public.fixed_assets set disposed_on = '2027-03-31' where id = '61000000-0000-0000-0000-000000000001';
-- 締めた年の除却日は不可
select pg_temp.expect_error($q$ update public.fixed_assets set disposed_on = '2025-12-31' where id = '61000000-0000-0000-0000-000000000001' $q$, '%締め済みの年%');

-- 翌年（締めていない年）の取引は登録できる
select public.save_transaction(
  '{"kind":"expense","occurred_on":"2026-01-10","amount":1000,"account_code":"519","payment_account_code":"102"}'::jsonb,
  '[{"date":"2026-01-10","description":"消耗品","lines":[{"account_code":"519","side":"debit","amount":1000},{"account_code":"102","side":"credit","amount":1000}]}]'::jsonb);

-- 申告書データの履歴は追記のみ
insert into public.tax_returns (user_id, tax_year, version, form_type, status, rule_version, data)
values ('00000000-0000-0000-0000-00000000000b', 2025, 1, 'blue', 'checked', '2025.2', '{}');
update public.tax_returns set status = 'draft';
do $$ begin
  if (select status from public.tax_returns) <> 'checked' then raise exception 'tax return modified'; end if;
end $$;

-- 他の利用者からは見えず、締めの操作もできない
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
do $$ begin
  if (select count(*) from public.tax_returns) <> 0 then raise exception 'A can see B returns'; end if;
end $$;
select pg_temp.expect_error($q$ select public.reopen_year(2025) $q$, '%締められていません%');
select pg_temp.expect_error($q$ select public.close_year(2025, '[]'::jsonb, null) $q$, '%申告設定がありません%');

-- 締めの取り消し: 決算整理・期首仕訳が消え、再び変更できる
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select public.reopen_year(2025);
do $$ begin
  if (select closed_at from public.tax_year_settings where tax_year = 2025) is not null then raise exception 'not reopened'; end if;
  if exists (select 1 from public.journal_entries where source in ('closing', 'opening')) then raise exception 'closing entries remain'; end if;
end $$;
select public.delete_transaction('60000000-0000-0000-0000-000000000001');

reset role;
select 'CLOSING DATABASE TESTS PASSED' as result;
