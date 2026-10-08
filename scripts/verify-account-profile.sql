-- Synthetic auth sessions in an isolated schema snapshot only. All fixtures roll back.
\set ON_ERROR_STOP on
begin;
do $$begin
  if current_database()<>'life_account_profile_test_20261008' then raise exception 'Isolated profile database required'; end if;
end$$;
create function pg_temp.check_result(ok boolean,label text) returns void language plpgsql as $$begin
  if ok is distinct from true then raise exception 'FAIL %',label; end if; raise notice 'PASS %',label;
end$$;
create function pg_temp.expect_error(command text,expected text) returns void language plpgsql as $$begin
  begin execute command; exception when others then if strpos(sqlerrm,expected)>0 then raise notice 'PASS denied: %',expected; return; else raise; end if; end;
  raise exception 'FAIL expected %',expected;
end$$;
alter table auth.users disable trigger on_auth_user_created;
insert into auth.users(id,email,email_confirmed_at,encrypted_password,created_at,updated_at)
select md5('account-profile-'||i)::uuid,'profile-'||i||'@uc.ac.kr',now(),'synthetic-not-a-password',now(),now() from generate_series(1,4) i;
alter table auth.users enable trigger on_auth_user_created;
insert into public.life_people(id,name) select md5('account-profile-'||i)::uuid,'프로필 검증 '||i from generate_series(1,4) i;
insert into public.life_auth_links select md5('account-profile-'||i)::uuid,md5('account-profile-'||i)::uuid from generate_series(1,4) i;
insert into life_private.credential_state(user_id,policy_version,changed_at)
select md5('account-profile-'||i)::uuid,1,now()-interval '1 hour' from generate_series(1,4) i
on conflict(user_id) do update set policy_version=1,changed_at=excluded.changed_at;
insert into auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at)
select md5('profile-factor-'||i)::uuid,md5('account-profile-'||i)::uuid,'totp','verified',now(),now() from generate_series(1,4) i;
insert into auth.sessions(id,user_id,created_at,updated_at,factor_id,aal)
select md5('profile-session-'||i)::uuid,md5('account-profile-'||i)::uuid,now(),now(),md5('profile-factor-'||i)::uuid,'aal2' from generate_series(1,4) i;
insert into auth.mfa_amr_claims(id,session_id,authentication_method,created_at,updated_at)
select md5('profile-amr-'||i)::uuid,md5('profile-session-'||i)::uuid,'totp',now(),now() from generate_series(1,4) i;
insert into public.life_organizations(id,slug,name) values(md5('profile-org')::uuid,'profile-test','프로필 검증 기관');
insert into public.life_role_assignments(person_id,org_id,role)
select md5('account-profile-'||i)::uuid,md5('profile-org')::uuid,case when i=1 then 'SYSTEM_ADMIN' else 'INSTRUCTOR' end from generate_series(1,3) i;
insert into life_private.account_classifications(person_id,office_position,instructor_kind,updated_by)
select md5('account-profile-'||i)::uuid,case when i=1 then 'RESEARCHER' end,case when i=2 then 'INTERNAL' when i=3 then 'EXTERNAL' end,md5('account-profile-1')::uuid from generate_series(1,3) i
on conflict(person_id) do update set office_position=excluded.office_position,instructor_kind=excluded.instructor_kind;
create function pg_temp.actor(i integer) returns void language plpgsql as $$begin
  perform set_config('request.jwt.claims',jsonb_build_object('sub',md5('account-profile-'||i)::uuid,'session_id',md5('profile-session-'||i)::uuid,'aal','aal2','amr',jsonb_build_array(jsonb_build_object('method','totp','timestamp',floor(extract(epoch from now())))))::text,true);
end$$;
set local role authenticated;
select pg_temp.actor(1);
select pg_temp.check_result(public.life_my_account_profile()->>'school_email'='profile-1@uc.ac.kr','initial school email comes from authenticated user');
select public.life_save_account_profile('+821012345678','0522300000','test@uc.ac.kr','test@example.invalid','기계공학과','단장');
select pg_temp.check_result(public.life_my_account_profile() @> '{"mobile_phone":"+821012345678","office_phone":"0522300000","school_email":"test@uc.ac.kr","personal_email":"test@example.invalid","affiliation":"기계공학과","job_title":"단장"}'::jsonb,'all six fields persist and are readable by self');
select pg_temp.check_result(public.life_identity()->>'office_position'='RESEARCHER','display job title never changes granted position');
select public.life_save_account_profile('+821087654321',null,null,'updated@example.invalid','평생교육팀','연구원');
select pg_temp.check_result(public.life_my_account_profile()->>'mobile_phone'='+821087654321' and public.life_my_account_profile()->>'school_email' is null,'edit and explicit clear persist');
select pg_temp.expect_error($cmd$select public.life_save_account_profile('01012345678',null,null,null,null,null)$cmd$,'INVALID_INPUT');
select pg_temp.expect_error($cmd$select public.life_save_account_profile(null,'123',null,null,null,null)$cmd$,'INVALID_INPUT');
select pg_temp.expect_error($cmd$select public.life_save_account_profile(null,null,'invalid',null,null,null)$cmd$,'INVALID_INPUT');
select pg_temp.expect_error($cmd$select public.life_save_account_profile(null,null,null,'a@b',null,null)$cmd$,'INVALID_INPUT');
select pg_temp.expect_error($cmd$select public.life_save_account_profile(null,null,null,null,repeat('a',101),null)$cmd$,'INVALID_INPUT');
select pg_temp.expect_error($cmd$select public.life_save_account_profile(null,null,null,null,null,repeat('a',101))$cmd$,'INVALID_INPUT');
select pg_temp.actor(2);
select pg_temp.check_result(public.life_my_account_profile()->>'affiliation' is null,'internal instructor cannot see another profile');
reset role;
insert into life_private.member_profiles(person_id,instructor_phone,updated_by) values(md5('account-profile-2')::uuid,'01055556666',md5('account-profile-1')::uuid);
set local role authenticated;
select pg_temp.check_result(public.life_my_account_profile()->>'mobile_phone'='+821055556666','existing instructor phone is shown before first edit');
select public.life_save_account_profile('+821011112222','0212345678',null,null,'교내학과','교수');
select pg_temp.actor(3);
select public.life_save_account_profile('+821033334444',null,null,'external@example.invalid','외부기관','강사');
select pg_temp.check_result(public.life_my_account_profile()->>'personal_email'='external@example.invalid','external instructor can edit self');
select pg_temp.actor(1);
select pg_temp.check_result(public.life_my_account_profile()->>'affiliation'='평생교육팀','instructor edits do not overwrite office profile');
select pg_temp.actor(4);
select pg_temp.expect_error('select public.life_my_account_profile()','FORBIDDEN');
select pg_temp.expect_error('select public.life_save_account_profile(null,null,null,null,null,null)','FORBIDDEN');
select set_config('request.jwt.claims','{}',true);
select pg_temp.expect_error('select public.life_my_account_profile()','FORBIDDEN');
reset role;
select pg_temp.check_result((select count(*)=3 from public.life_role_assignments),'self edits never grant roles');
select pg_temp.check_result((select instructor_phone='01011112222' from life_private.member_profiles where person_id=md5('account-profile-2')::uuid),'instructor directory phone stays synchronized');
select pg_temp.check_result((select email='profile-1@uc.ac.kr' from auth.users where id=md5('account-profile-1')::uuid),'contact emails do not change login email');
select pg_temp.check_result((select revision=2 from life_private.member_profiles where person_id=md5('account-profile-1')::uuid),'member revision increments on edits');
select pg_temp.check_result(not has_table_privilege('authenticated','life_private.account_profiles','select') and not has_table_privilege('authenticated','life_private.account_profiles','update'),'private profile table cannot be directly read or changed');
select pg_temp.check_result(not has_function_privilege('anon','public.life_my_account_profile()','execute') and not has_function_privilege('anon','public.life_save_account_profile(text,text,text,text,text,text)','execute'),'anonymous profile RPC denied');
rollback;
