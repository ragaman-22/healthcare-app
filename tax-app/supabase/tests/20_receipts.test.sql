-- 第3段階: 証憑・OCR 結果・取引との関連付けのテスト
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
select pg_temp.login('00000000-0000-0000-0000-00000000000a');

insert into public.documents (id, user_id, storage_path, sha256, mime_type, size_bytes)
values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a',
        '00000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-000000000001.jpg',
        repeat('a', 64), 'image/jpeg', 1000);

insert into public.ocr_results (document_id, user_id, provider, fields)
values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'demo', '{"totalAmount": 3520}');

-- 他人のフォルダのパスでは作成できない
select pg_temp.expect_error($q$
  insert into public.documents (user_id, storage_path, sha256, mime_type, size_bytes)
  values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b/x.jpg', repeat('b', 64), 'image/jpeg', 1)
$q$, '%documents_check%');

-- 確認して経費として登録 → 証憑が登録済みになる
select public.save_transaction(
  '{"id":"30000000-0000-0000-0000-000000000001","kind":"expense","occurred_on":"2026-10-01","counterparty":"文具店",
    "amount":3520,"account_code":"519","payment_account_code":"290","document_id":"20000000-0000-0000-0000-000000000001"}'::jsonb,
  '[{"date":"2026-10-01","description":"文具店","lines":[
      {"account_code":"519","side":"debit","amount":3520},{"account_code":"290","side":"credit","amount":3520}]}]'::jsonb
);
do $$ begin
  if (select status from public.documents where id = '20000000-0000-0000-0000-000000000001') <> 'confirmed' then
    raise exception 'document not confirmed';
  end if;
  if (select document_id from public.transactions where id = '30000000-0000-0000-0000-000000000001') is null then
    raise exception 'transaction not linked';
  end if;
end $$;

-- 同じ証憑を別の取引に登録することはできない
select pg_temp.expect_error($q$
  select public.save_transaction(
    '{"kind":"expense","occurred_on":"2026-10-01","amount":1,"account_code":"519","payment_account_code":"290",
      "document_id":"20000000-0000-0000-0000-000000000001"}'::jsonb,
    '[{"date":"2026-10-01","description":"x","lines":[
        {"account_code":"519","side":"debit","amount":1},{"account_code":"290","side":"credit","amount":1}]}]'::jsonb)
$q$, '%別の取引に登録済み%');

-- 編集時に証憑を指定しなくても関連付けは維持される
select public.save_transaction(
  '{"id":"30000000-0000-0000-0000-000000000001","kind":"expense","occurred_on":"2026-10-01","counterparty":"文具店",
    "amount":3300,"account_code":"519","payment_account_code":"290"}'::jsonb,
  '[{"date":"2026-10-01","description":"文具店","lines":[
      {"account_code":"519","side":"debit","amount":3300},{"account_code":"290","side":"credit","amount":3300}]}]'::jsonb
);
do $$ begin
  if (select document_id from public.transactions where id = '30000000-0000-0000-0000-000000000001') is null then
    raise exception 'link lost on edit';
  end if;
end $$;

-- 登録済みの証憑は削除できない（RLS で 0 件削除）
delete from public.documents where id = '20000000-0000-0000-0000-000000000001';
do $$ begin
  if not exists (select 1 from public.documents where id = '20000000-0000-0000-0000-000000000001') then
    raise exception 'confirmed document was deleted';
  end if;
end $$;

-- OCR 結果は更新・削除できない
update public.ocr_results set provider = 'none';
do $$ begin
  if exists (select 1 from public.ocr_results where provider = 'none') then raise exception 'ocr result modified'; end if;
end $$;

-- ---------- 利用者B ----------
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
do $$ begin
  if (select count(*) from public.documents) <> 0 then raise exception 'B can see A documents'; end if;
  if (select count(*) from public.ocr_results) <> 0 then raise exception 'B can see A ocr results'; end if;
end $$;

-- Aの証憑を自分の取引に紐づけることはできない
select pg_temp.expect_error($q$
  select public.save_transaction(
    '{"kind":"expense","occurred_on":"2026-10-01","amount":1,"account_code":"519","payment_account_code":"290",
      "document_id":"20000000-0000-0000-0000-000000000001"}'::jsonb, '[]'::jsonb)
$q$, '%証憑が見つからない%');

-- Aの証憑に OCR 結果を追加することはできない
select pg_temp.expect_error($q$
  insert into public.ocr_results (document_id, user_id, provider)
  values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'none')
$q$, '%所有者が一致しません%');

-- ---------- Aで取引を削除 → 証憑は確認待ちに戻り、削除できるようになる ----------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.delete_transaction('30000000-0000-0000-0000-000000000001');
do $$ begin
  if (select status from public.documents where id = '20000000-0000-0000-0000-000000000001') <> 'pending' then
    raise exception 'document not reset to pending';
  end if;
end $$;
delete from public.documents where id = '20000000-0000-0000-0000-000000000001';
do $$ begin
  if exists (select 1 from public.documents) then raise exception 'pending document not deleted'; end if;
  if exists (select 1 from public.ocr_results) then raise exception 'ocr results not cascaded'; end if;
end $$;

reset role;
select 'RECEIPT DATABASE TESTS PASSED' as result;
