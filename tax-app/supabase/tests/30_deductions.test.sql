-- 第4段階: 控除の詳細・給与収入のテスト
\set ON_ERROR_STOP on

create function pg_temp.login(p uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p::text, false);
$$;

set role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');

insert into public.deductions (user_id, tax_year, kind, amount, detail)
values ('00000000-0000-0000-0000-00000000000a', 2026, 'family', 0, '{"spouse": {"totalIncome": 500000}}');
insert into public.other_incomes (user_id, tax_year, kind, revenue, withholding_tax, social_insurance)
values ('00000000-0000-0000-0000-00000000000a', 2026, 'salary', 3000000, 50000, 400000);

do $$ begin
  begin
    insert into public.deductions (user_id, tax_year, kind, amount) values ('00000000-0000-0000-0000-00000000000a', 2026, 'unknown_kind', 0);
    raise exception 'unknown kind accepted';
  exception when check_violation then null;
  end;
end $$;

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
do $$ begin
  if (select count(*) from public.deductions) <> 0 then raise exception 'B can see A deductions'; end if;
  if (select count(*) from public.other_incomes) <> 0 then raise exception 'B can see A incomes'; end if;
  begin
    insert into public.other_incomes (user_id, tax_year, kind, revenue)
    values ('00000000-0000-0000-0000-00000000000a', 2026, 'salary', 1);
    raise exception 'B inserted A income';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select 'DEDUCTION DATABASE TESTS PASSED' as result;
