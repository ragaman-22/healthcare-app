-- 第5段階: 通知書・納付済みの記録のテスト
\set ON_ERROR_STOP on

create function pg_temp.login(p uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p::text, false);
$$;

set role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');

insert into public.tax_notices (user_id, tax_type, fiscal_year, total, installments)
values ('00000000-0000-0000-0000-00000000000a', 'resident', 2027, 200000, '[{"dueDate":"2027-06-30","amount":50000}]');
insert into public.tax_payment_records (user_id, payment_key, paid_on, amount)
values ('00000000-0000-0000-0000-00000000000a', 'resident:2027:1', '2027-06-20', 50000);

do $$ begin
  begin
    insert into public.tax_payment_records (user_id, payment_key, paid_on, amount)
    values ('00000000-0000-0000-0000-00000000000a', 'bad key', '2027-06-20', 1);
    raise exception 'invalid payment key accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.tax_payment_records (user_id, payment_key, paid_on, amount)
    values ('00000000-0000-0000-0000-00000000000a', 'resident:2027:1', '2027-06-21', 1);
    raise exception 'duplicate payment record accepted';
  exception when unique_violation then null;
  end;
end $$;

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
do $$ begin
  if (select count(*) from public.tax_notices) <> 0 then raise exception 'B can see A notices'; end if;
  if (select count(*) from public.tax_payment_records) <> 0 then raise exception 'B can see A payments'; end if;
  update public.tax_notices set total = 0;
  delete from public.tax_payment_records;
end $$;

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
do $$ begin
  if (select total from public.tax_notices) <> 200000 then raise exception 'B modified A notice'; end if;
  if (select count(*) from public.tax_payment_records) <> 1 then raise exception 'B deleted A record'; end if;
end $$;

reset role;
select 'SCHEDULE DATABASE TESTS PASSED' as result;
