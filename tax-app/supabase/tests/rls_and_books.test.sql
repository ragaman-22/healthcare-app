-- RLS・仕訳の貸借一致・保存関数のテスト。失敗すると例外で停止する。
\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com');

create function pg_temp.login(p uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p::text, false);
$$;

create function pg_temp.expect_error(p_sql text, p_like text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm not like p_like then
      raise exception 'expected error like "%", got "%"', p_like, sqlerrm;
    end if;
    return;
  end;
  raise exception 'expected error like "%" but statement succeeded: %', p_like, p_sql;
end;
$$;

set role authenticated;

-- ---------- 利用者A: 取引の保存 ----------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');

do $$
begin
  if (select count(*) from public.user_profiles) <> 1 then raise exception 'profile trigger/RLS failed'; end if;
  if (select count(*) from public.accounts where user_id is null) < 40 then raise exception 'system accounts not visible'; end if;
end $$;

select public.save_transaction(
  '{"id":"10000000-0000-0000-0000-000000000001","kind":"sale","occurred_on":"2026-03-31","settled_on":"2026-04-30",
    "counterparty":"A社","amount":100000,"withholding_tax":10210,"account_code":"400","payment_account_code":"102"}'::jsonb,
  '[{"date":"2026-03-31","description":"売上計上","lines":[
      {"account_code":"110","side":"debit","amount":100000},{"account_code":"400","side":"credit","amount":100000}]},
    {"date":"2026-04-30","description":"入金","lines":[
      {"account_code":"102","side":"debit","amount":89790},{"account_code":"190","side":"debit","amount":10210},
      {"account_code":"110","side":"credit","amount":100000}]}]'::jsonb
);

do $$
begin
  if (select count(*) from public.journal_entries) <> 2 then raise exception 'entries not created'; end if;
  if (select count(*) from public.journal_lines) <> 5 then raise exception 'lines not created'; end if;
end $$;

-- 更新すると仕訳が作り直され、version が上がり、履歴が残る
select public.save_transaction(
  '{"id":"10000000-0000-0000-0000-000000000001","kind":"sale","occurred_on":"2026-03-31",
    "counterparty":"A社","amount":120000,"withholding_tax":0,"account_code":"400","payment_account_code":"102"}'::jsonb,
  '[{"date":"2026-03-31","description":"売上計上","lines":[
      {"account_code":"110","side":"debit","amount":120000},{"account_code":"400","side":"credit","amount":120000}]}]'::jsonb
);

do $$
begin
  if (select count(*) from public.journal_entries) <> 1 then raise exception 'entries not replaced'; end if;
  if (select version from public.journal_entries) <> 2 then raise exception 'version not incremented'; end if;
  if (select count(*) from public.audit_logs where entity = 'transactions') <> 2 then raise exception 'audit missing'; end if;
  if (select count(*) from public.audit_logs where entity = 'journal_entries') <> 1 then raise exception 'entry audit missing'; end if;
end $$;

-- ---------- 貸借不一致は保存できない ----------
select pg_temp.expect_error($q$
  select public.save_manual_entry(null, '{"date":"2026-05-01","description":"不一致","lines":[
    {"account_code":"102","side":"debit","amount":1000},{"account_code":"300","side":"credit","amount":999}]}'::jsonb);
  set constraints all immediate;
$q$, '%一致しません%');

-- 片側だけの仕訳も不可
select pg_temp.expect_error($q$
  select public.save_manual_entry(null, '{"date":"2026-05-01","description":"片側","lines":[
    {"account_code":"102","side":"debit","amount":1000}]}'::jsonb);
  set constraints all immediate;
$q$, '%借方または貸方がありません%');

-- 存在しない科目は不可
select pg_temp.expect_error($q$
  select public.save_manual_entry(null, '{"date":"2026-05-01","description":"科目なし","lines":[
    {"account_code":"999","side":"debit","amount":1000},{"account_code":"300","side":"credit","amount":1000}]}'::jsonb);
$q$, '%使用できません%');

-- 正しい手入力仕訳（元入金）
select public.save_manual_entry(null, '{"date":"2026-01-01","description":"元入金","lines":[
  {"account_code":"102","side":"debit","amount":500000},{"account_code":"300","side":"credit","amount":500000}]}'::jsonb);
set constraints all immediate;

-- 利用者独自の科目
insert into public.accounts (user_id, code, name, category)
values ('00000000-0000-0000-0000-00000000000a', 'u001', '撮影小道具費', 'expense');

-- 標準科目は変更できない（RLS で対象外 → 0件更新）
update public.accounts set name = '改ざん' where code = '400' and user_id is null;
do $$ begin
  if (select name from public.accounts where code = '400' and user_id is null) <> '売上高' then
    raise exception 'system account was modified';
  end if;
end $$;

-- 計算結果・履歴は更新・削除できない
update public.audit_logs set action = 'delete';
delete from public.audit_logs;
do $$ begin
  if (select count(*) from public.audit_logs where action <> 'delete') = 0 then raise exception 'audit logs were modified'; end if;
end $$;

-- ---------- 利用者B: Aのデータは見えない・変更できない ----------
select pg_temp.login('00000000-0000-0000-0000-00000000000b');

do $$
begin
  if (select count(*) from public.transactions) <> 0 then raise exception 'B can see A transactions'; end if;
  if (select count(*) from public.journal_entries) <> 0 then raise exception 'B can see A entries'; end if;
  if (select count(*) from public.journal_lines) <> 0 then raise exception 'B can see A lines'; end if;
  if (select count(*) from public.audit_logs) <> 0 then raise exception 'B can see A audit logs'; end if;
  if (select count(*) from public.user_profiles) <> 1 then raise exception 'B profile visibility wrong'; end if;
  if exists (select 1 from public.accounts where code = 'u001') then raise exception 'B can see A custom account'; end if;
end $$;

-- Aの取引IDで上書きしようとしても不可
select pg_temp.expect_error($q$
  select public.save_transaction(
    '{"id":"10000000-0000-0000-0000-000000000001","kind":"expense","occurred_on":"2026-03-31",
      "amount":1,"account_code":"519","payment_account_code":"102"}'::jsonb, '[]'::jsonb)
$q$, '%見つかりません%');

select pg_temp.expect_error($q$
  select public.delete_transaction('10000000-0000-0000-0000-000000000001')
$q$, '%見つかりません%');

-- Aの科目は使えない
select pg_temp.expect_error($q$
  select public.save_manual_entry(null, '{"date":"2026-05-01","description":"他人の科目","lines":[
    {"account_code":"u001","side":"debit","amount":1000},{"account_code":"102","side":"credit","amount":1000}]}'::jsonb)
$q$, '%使用できません%');

-- user_id を偽装した直接 INSERT は RLS で拒否
select pg_temp.expect_error($q$
  insert into public.transactions (user_id, kind, occurred_on, amount, account_code, payment_account_code)
  values ('00000000-0000-0000-0000-00000000000a', 'expense', '2026-01-01', 1, '519', '102')
$q$, '%row-level security%');

-- Aの取引に紐づく仕訳を作ることはできない
select pg_temp.expect_error($q$
  insert into public.journal_entries (user_id, entry_date, source, transaction_id)
  values ('00000000-0000-0000-0000-00000000000b', '2026-01-01', 'transaction', '10000000-0000-0000-0000-000000000001')
$q$, '%所有者が一致しません%');

-- 未ログインでは保存できない
select pg_temp.login(null);
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.expect_error($q$
  select public.save_transaction('{"kind":"expense","occurred_on":"2026-01-01","amount":1,"account_code":"519","payment_account_code":"102"}'::jsonb, '[]'::jsonb)
$q$, '%ログインが必要です%');

-- ---------- Aで削除 ----------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
do $$ begin
  if (select amount from public.transactions where id = '10000000-0000-0000-0000-000000000001') <> 120000 then
    raise exception 'A transaction was modified by B';
  end if;
end $$;
select public.delete_transaction('10000000-0000-0000-0000-000000000001');
do $$
begin
  if exists (select 1 from public.journal_entries where source = 'transaction') then raise exception 'cascade delete failed'; end if;
  if (select count(*) from public.audit_logs where entity = 'transactions' and action = 'delete') <> 1 then raise exception 'delete audit missing'; end if;
end $$;

reset role;
select 'ALL DATABASE TESTS PASSED' as result;
