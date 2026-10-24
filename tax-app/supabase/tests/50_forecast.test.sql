\set ON_ERROR_STOP on
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into public.businesses (id, user_id) values ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a');
insert into public.tax_year_settings (user_id, business_id, tax_year, forecast_adjustment)
values ('00000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-000000000001', 2026, '{"remainingRevenue": 1000000, "remainingExpenses": null}');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  if (select count(*) from public.tax_year_settings) <> 0 then raise exception 'B can see A settings'; end if;
end $$;
reset role;
select 'FORECAST DATABASE TESTS PASSED' as result;
