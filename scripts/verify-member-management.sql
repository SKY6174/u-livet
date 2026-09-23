-- Run ONLY in an isolated local test database. Every fixture and mutation rolls back.
\set ON_ERROR_STOP on
begin;
do $$begin
  if current_database() <> 'life_members_test_20260921' then
    raise exception 'Use the isolated local life_members_test_20260921 database only';
  end if;
end$$;
create function pg_temp.check_result(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL %',label; end if; raise notice 'PASS %',label; end$$;
create function pg_temp.expect_error(command text,expected text) returns void language plpgsql as $$begin
  begin execute command; exception when others then if strpos(sqlerrm,expected)>0 then raise notice 'PASS denied: %',expected; return; else raise; end if; end;
  raise exception 'FAIL expected %',expected;
end$$;
alter table auth.users disable trigger on_auth_user_created;
insert into auth.users(id,email,email_confirmed_at,encrypted_password,created_at,updated_at)
select md5('member-test-'||i)::uuid,'member'||i||'@example.invalid',now(),'synthetic-not-a-password',now(),now() from generate_series(1,32) i;
alter table auth.users enable trigger on_auth_user_created;
insert into public.life_people(id,name) select md5('member-test-'||i)::uuid,'검증구성원'||lpad(i::text,2,'0') from generate_series(1,32) i;
insert into public.life_auth_links select md5('member-test-'||i)::uuid,md5('member-test-'||i)::uuid from generate_series(1,32) i;
insert into public.user_profiles(id,email,name,role) select id,email,'원래 이름','LEARNER' from auth.users;
update life_private.credential_state set changed_at=now()-interval '1 hour';
insert into auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at) select md5('factor-'||i)::uuid,md5('member-test-'||i)::uuid,'totp','verified',now(),now() from generate_series(1,32) i;
insert into auth.sessions(id,user_id,created_at,updated_at,factor_id,aal) select md5('session-'||i)::uuid,md5('member-test-'||i)::uuid,now(),now(),md5('factor-'||i)::uuid,'aal2' from generate_series(1,32) i;
insert into auth.mfa_amr_claims(id,session_id,authentication_method,created_at,updated_at) select md5('amr-'||i)::uuid,md5('session-'||i)::uuid,'totp',now(),now() from generate_series(1,32) i;
insert into public.life_organizations(id,slug,name) values(md5('other-org')::uuid,'member-test-other','다른 기관');
insert into public.life_role_assignments(person_id,org_id,role) values
(md5('member-test-1')::uuid,'10000000-0000-4000-8000-000000000001','SYSTEM_ADMIN'),
(md5('member-test-2')::uuid,'10000000-0000-4000-8000-000000000001','INSTRUCTOR'),
(md5('member-test-4')::uuid,md5('other-org')::uuid,'SYSTEM_ADMIN'),
(md5('member-test-5')::uuid,'10000000-0000-4000-8000-000000000001','INSTRUCTOR'),
(md5('member-test-5')::uuid,md5('other-org')::uuid,'INSTRUCTOR');
insert into public.life_policy_versions(id,org_id,kind,version,title,body,status,approved_by,approved_at) values
(md5('member-policy')::uuid,'10000000-0000-4000-8000-000000000001','ACCOUNT_PRIVACY','member-test','검증 안내','합성 데이터 전용','APPROVED',md5('member-test-1')::uuid,now());
insert into public.life_consent_events(person_id,policy_id,accepted,source) select md5('member-test-'||i)::uuid,md5('member-policy')::uuid,true,'TEST' from generate_series(1,32) i where i not in (4,5);
insert into life_private.learner_contacts(user_id,phone,signup_source,policy_id) values(md5('member-test-3')::uuid,'+821011112222','EMAIL',md5('member-policy')::uuid);
insert into public.life_courses(id,org_id,title,academy) values(md5('member-course')::uuid,'10000000-0000-4000-8000-000000000001','검증 과정','검증');
insert into public.life_course_versions(id,org_id,course_id,summary,curriculum) values(md5('member-version')::uuid,'10000000-0000-4000-8000-000000000001',md5('member-course')::uuid,'검증','검증');
insert into public.life_offerings(id,org_id,project_year_id,course_version_id,name,mode,location,capacity,apply_from,apply_until,starts_on,ends_on) values
(md5('member-offering')::uuid,'10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',md5('member-version')::uuid,'실제 DB 강의이력 검증','OFFLINE','테스트',20,now(),now()+interval '1 day',current_date,current_date+10);
insert into public.life_offering_instructors(offering_id,person_id) values(md5('member-offering')::uuid,md5('member-test-2')::uuid);
insert into public.life_applications(id,offering_id,person_id,status,policy_id) values
(md5('member-application')::uuid,md5('member-offering')::uuid,md5('member-test-3')::uuid,'ACCEPTED',md5('member-policy')::uuid),
(md5('instructor-application')::uuid,md5('member-offering')::uuid,md5('member-test-2')::uuid,'SUBMITTED',md5('member-policy')::uuid);
insert into public.life_enrollments(application_id,offering_id,person_id) values(md5('member-application')::uuid,md5('member-offering')::uuid,md5('member-test-3')::uuid);
select set_config('request.jwt.claims',jsonb_build_object('sub',md5('member-test-1')::uuid,'session_id',md5('session-1')::uuid,'aal','aal2','amr',jsonb_build_array(jsonb_build_object('method','totp','timestamp',floor(extract(epoch from now())))))::text,true);
set local role authenticated;
select pg_temp.check_result((public.life_member_directory('office')->>'total')::int=1,'office scope');
select pg_temp.check_result((public.life_member_directory('instructor')->>'total')::int=1,'cross-organization instructor excluded');
select pg_temp.check_result((public.life_member_directory('learner')->>'total')::int=29,'learners include enrolled instructor');
select pg_temp.check_result(jsonb_array_length(public.life_member_directory('learner')->'items')=20,'server page bounded at 20');
select pg_temp.check_result(jsonb_array_length(public.life_member_directory('learner','',2)->'items')=9,'second page');
select pg_temp.check_result((public.life_member_directory('learner','MEMBER3@')->>'total')::int=1,'case insensitive email search');
select pg_temp.check_result((public.life_member_directory('learner','%',1)->>'total')::int=0,'search wildcard treated literally');
select pg_temp.check_result(public.life_member_directory('learner','',1,md5('member-test-3')::uuid)->'items'->0->>'mobile_phone'='+821011112222','existing signup phone fallback');
select pg_temp.check_result(public.life_member_directory('instructor','',1,md5('member-test-2')::uuid)->'items'->0->>'instructor_kind'='EXTERNAL','existing instructor classification');
select pg_temp.check_result(public.life_member_history(md5('member-test-2')::uuid,'instructor')->'items'->0->>'name'='실제 DB 강의이력 검증','real teaching history');
select pg_temp.check_result(public.life_member_history(md5('member-test-3')::uuid,'learner')->'items'->0->>'status'='ENROLLED','real enrollment history');
select pg_temp.expect_error($$select public.life_member_directory('fake')$$,'INVALID_INPUT');
select pg_temp.expect_error($$select public.life_member_directory('office','',0)$$,'INVALID_INPUT');
select pg_temp.expect_error($$select public.life_member_history(md5('member-test-5')::uuid,'instructor')$$,'FORBIDDEN');
select pg_temp.expect_error($$select * from life_private.member_profiles$$,'permission denied');
select public.life_save_member(md5('member-test-1')::uuid,'office','운영자 변경','DIRECTOR',null,'0522300000','+821012345678',null,null,'운영 비고',0);
select pg_temp.check_result(public.life_member_directory('office')->'items'->0->>'office_phone'='0522300000','office save and phone');
select public.life_save_member(md5('member-test-2')::uuid,'instructor','강사 변경',null,'EXTERNAL',null,null,'0212345678',null,'문의 가능',0);
select pg_temp.check_result(public.life_member_directory('instructor')->'items'->0->>'instructor_phone'='0212345678','Q&A phone separate from mobile');
select public.life_save_member(md5('member-test-3')::uuid,'learner','수강생 변경',null,null,null,'+821033334444',null,'1990-03-01','변경 비고',0);
select pg_temp.check_result(public.life_member_directory('learner','',1,md5('member-test-3')::uuid)->'items'->0->>'birth_date'='1990-03-01','birth date save');
select pg_temp.expect_error($$select public.life_save_member(md5('member-test-3')::uuid,'learner','오래된 저장',null,null,null,'+821033334444',null,null,'',0)$$,'REVISION_CONFLICT');
select pg_temp.expect_error($$select public.life_save_member(md5('member-test-3')::uuid,'learner','미래 생일',null,null,null,'+821033334444',null,'2099-01-01','',1)$$,'INVALID_INPUT');
select pg_temp.expect_error($$select public.life_save_member(md5('member-test-3')::uuid,'learner','전화 삭제',null,null,null,null,null,null,'',1)$$,'MOBILE_REQUIRED');
select pg_temp.expect_error($$select public.life_save_member(md5('member-test-2')::uuid,'instructor','강사',null,'INTERNAL',null,null,null,null,'',1)$$,'SCHOOL_EMAIL_REQUIRED');
select pg_temp.expect_error($$select public.life_save_member(md5('member-test-5')::uuid,'instructor','다른기관',null,'EXTERNAL',null,null,null,null,'',0)$$,'FORBIDDEN');
select pg_temp.expect_error($$select public.life_delete_member(md5('member-test-1')::uuid,1)$$,'SELF_DELETE_FORBIDDEN');
select pg_temp.expect_error($$select public.life_delete_member(md5('member-test-3')::uuid,0)$$,'REVISION_CONFLICT');
reset role;
select pg_temp.check_result((select phone='+821033334444' from life_private.learner_contacts where user_id=md5('member-test-3')::uuid),'phone transaction synced');
select pg_temp.check_result((select name='수강생 변경' from public.user_profiles where id=md5('member-test-3')::uuid),'legacy display name synced');
update auth.mfa_amr_claims set updated_at=now()-interval '121 minutes' where session_id=md5('session-1')::uuid;
set local role authenticated;
select pg_temp.expect_error($$select public.life_delete_member(md5('member-test-3')::uuid,1)$$,'MFA_REAUTH_REQUIRED');
reset role;
update auth.mfa_amr_claims set updated_at=now() where session_id=md5('session-1')::uuid;
set local role authenticated;
select public.life_delete_member(md5('member-test-3')::uuid,1);
select pg_temp.check_result((public.life_member_directory('learner','',1,md5('member-test-3')::uuid)->>'total')::int=0,'deleted member excluded');
reset role;
select pg_temp.check_result((select count(*)=1 from public.life_enrollments where person_id=md5('member-test-3')::uuid),'enrollment history preserved');
select pg_temp.check_result((select count(*)=1 from public.life_audit_events where entity_id=md5('member-test-3')::uuid and action='MEMBER_DEACTIVATED'),'deletion audited');
select set_config('request.jwt.claims',jsonb_build_object('sub',md5('member-test-3')::uuid,'session_id',md5('session-3')::uuid,'aal','aal2','amr',jsonb_build_array(jsonb_build_object('method','totp','timestamp',floor(extract(epoch from now())))))::text,true);
set local role authenticated;
select pg_temp.check_result(public.life_identity() is null,'disabled member cannot use an existing session');
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',md5('member-test-2')::uuid,'session_id',md5('session-2')::uuid,'aal','aal2','amr',jsonb_build_array(jsonb_build_object('method','totp','timestamp',floor(extract(epoch from now())))))::text,true);
set local role authenticated;
select pg_temp.expect_error($$select public.life_member_directory('learner')$$,'FORBIDDEN');
select pg_temp.expect_error($$select public.life_member_history(md5('member-test-2')::uuid,'instructor')$$,'FORBIDDEN');
select pg_temp.expect_error($$select public.life_delete_member(md5('member-test-6')::uuid,0)$$,'FORBIDDEN');
reset role;
set local role anon;
select pg_temp.expect_error($$select public.life_member_directory('office')$$,'permission denied');
select pg_temp.expect_error($$select public.life_delete_member(md5('member-test-6')::uuid,0)$$,'permission denied');
reset role;
rollback;
