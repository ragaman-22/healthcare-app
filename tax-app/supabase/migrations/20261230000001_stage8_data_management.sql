-- 第8段階: 利用者によるデータの全削除

-- 本人のデータをすべて削除する（ログインアカウント自体の削除は、サーバーの管理者権限で別途行う）。
-- 履歴（audit_logs）など本人でも削除できないテーブルを含めて消すため security definer とし、
-- 必ず auth.uid() の行だけを対象にする。
create or replace function public.delete_my_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'ログインが必要です' using errcode = '42501'; end if;
  -- 締めた年の帳簿も削除できるようにする（このトランザクション内のみ）
  perform set_config('app.closing', 'on', true);

  delete from public.tax_payment_records where user_id = v_user;
  delete from public.tax_notices where user_id = v_user;
  delete from public.tax_returns where user_id = v_user;
  delete from public.tax_calculations where user_id = v_user;
  delete from public.ocr_results where user_id = v_user;
  delete from public.journal_entries where user_id = v_user;
  update public.documents set transaction_id = null where user_id = v_user;
  delete from public.transactions where user_id = v_user;
  delete from public.documents where user_id = v_user;
  delete from public.fixed_assets where user_id = v_user;
  delete from public.deductions where user_id = v_user;
  delete from public.other_incomes where user_id = v_user;
  delete from public.tax_year_settings where user_id = v_user;
  delete from public.businesses where user_id = v_user;
  delete from public.accounts where user_id = v_user;
  delete from public.audit_logs where user_id = v_user;
  update public.user_profiles set display_name = '', birth_date = null, prefecture = '', city = '' where id = v_user;

  perform set_config('app.closing', 'off', true);
end;
$$;

revoke execute on function public.delete_my_data() from public, anon;
grant execute on function public.delete_my_data() to authenticated;

-- 未ログイン（anon）からはアプリの関数を一切呼べないようにする（各関数でも auth.uid() を確認しているが、多層防御として）
-- PostgreSQL は関数の実行権限を PUBLIC（全ロール）に付与するため、PUBLIC と anon から取り消し、
-- ログイン済み（authenticated）とサーバー（service_role）に明示的に付与する
revoke execute on all functions in schema public from public, anon;
alter default privileges in schema public revoke execute on functions from public, anon;
grant execute on all functions in schema public to authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on all functions in schema public to service_role';
  end if;
end $$;
