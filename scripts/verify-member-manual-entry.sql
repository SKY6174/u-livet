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

update life_private.member_entry_operators set auth_user_id=md5('member-test-1')::uuid where slot='SUPER_ADMIN';
update life_private.member_entry_operators set auth_user_id=md5('member-test-2')::uuid where slot='OPERATIONS';
update auth.users set email='yhlee4@uc.ac.kr',email_confirmed_at=null where id=md5('member-test-20')::uuid;
select pg_temp.check_result((select auth_user_id is null from life_private.member_entry_operators where slot='RESEARCH'),'unverified email cannot bind operator');
update auth.users set email_confirmed_at=now() where id=md5('member-test-20')::uuid;
select pg_temp.check_result((select auth_user_id=md5('member-test-20')::uuid from life_private.member_entry_operators where slot='RESEARCH'),'approved verified email binds exact account');
update auth.users set email='changed@example.invalid' where id=md5('member-test-20')::uuid;
select pg_temp.check_result((select auth_user_id=md5('member-test-20')::uuid from life_private.member_entry_operators where slot='RESEARCH'),'binding retains stable account ID');
create function pg_temp.actor(i integer) returns void language plpgsql as $$begin
 perform set_config('request.jwt.claims',jsonb_build_object('sub',md5('member-test-'||i)::uuid,'session_id',md5('session-'||i)::uuid,'aal','aal2','amr',jsonb_build_array(jsonb_build_object('method','totp','timestamp',floor(extract(epoch from now())))))::text,true);
end$$;
create function pg_temp.register_member(n integer,g text default 'learner',email text default null,org uuid default '10000000-0000-4000-8000-000000000001',name text default '수동 검증') returns uuid language sql as $$
 select public.life_create_member(md5('manual-request-'||n)::uuid,org,g,name,coalesce(email,'manual'||n||'@example.invalid'),'RESEARCHER','INTERNAL','0522300000','+821012345678','0212345678','1991-03-01','수동 등록 검증')
$$;
-- Add historical, next-year, withdrawn and cross-year offerings.
insert into public.life_offerings(id,org_id,project_year_id,course_version_id,name,mode,location,capacity,apply_from,apply_until,starts_on,ends_on)
select md5('manual-offering-'||i)::uuid,'10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',md5('member-version')::uuid,'연도 검증 '||i,'OFFLINE','테스트',20,now(),now()+interval '1 day',
 case i when 1 then (date_trunc('year',timezone('Asia/Seoul',now()))-interval '1 year')::date when 2 then (date_trunc('year',timezone('Asia/Seoul',now()))+interval '1 year')::date when 4 then (date_trunc('year',timezone('Asia/Seoul',now()))-interval '1 day')::date else current_date end,
 case i when 1 then (date_trunc('year',timezone('Asia/Seoul',now()))-interval '1 day')::date when 2 then (date_trunc('year',timezone('Asia/Seoul',now()))+interval '1 year 10 days')::date else current_date+10 end
from generate_series(1,4) i;
insert into public.life_applications(id,offering_id,person_id,status,policy_id) select md5('manual-app-'||i)::uuid,md5('manual-offering-'||i)::uuid,md5('member-test-3')::uuid,'ACCEPTED',md5('member-policy')::uuid from generate_series(1,4) i;
insert into public.life_enrollments(application_id,offering_id,person_id,status) select md5('manual-app-'||i)::uuid,md5('manual-offering-'||i)::uuid,md5('member-test-3')::uuid,case when i=3 then 'WITHDRAWN' else 'ACTIVE' end from generate_series(1,4) i;
set local role authenticated;
select pg_temp.actor(1);
select pg_temp.check_result((public.life_identity()->>'is_super_admin')::boolean,'chief administrator identity');
select pg_temp.check_result(jsonb_array_length(public.life_member_directory('learner','',1,md5('member-test-3')::uuid)->'items'->0->'current_courses')=2,'current courses include overlapping year but exclude past future withdrawn');
select pg_temp.check_result((public.life_member_history(md5('member-test-3')::uuid,'learner')->>'total')::int=5,'history retains all years and withdrawn records');
select pg_temp.check_result(pg_temp.register_member(1)=pg_temp.register_member(1),'retry idempotency returns same member');
select pg_temp.register_member(2,'office');
select pg_temp.register_member(3,'instructor');
select pg_temp.check_result((public.life_member_directory('learner','manual1@')->>'total')::int=1,'created learner persists and is searchable');
select pg_temp.check_result(public.life_member_directory('learner','manual1@')->'items'->0->>'mobile_phone'='+821012345678','manual profile persisted');
select pg_temp.check_result(public.life_member_directory('office','manual2@')->'items'->0->>'office_position'='RESEARCHER','office classification saved');
select pg_temp.check_result(public.life_member_directory('instructor','manual3@')->'items'->0->>'instructor_kind'='INTERNAL','manual internal instructor classification saved without granting login role');
select pg_temp.expect_error($cmd$select pg_temp.register_member(4,'learner','MANUAL1@EXAMPLE.INVALID')$cmd$,'MEMBER_EMAIL_EXISTS');
select pg_temp.expect_error($cmd$select pg_temp.register_member(4,'learner','member3@example.invalid')$cmd$,'MEMBER_EMAIL_EXISTS');
select pg_temp.expect_error($cmd$select pg_temp.register_member(1,'learner',null,'10000000-0000-4000-8000-000000000001','수정된 요청')$cmd$,'REQUEST_CONFLICT');
select pg_temp.expect_error($cmd$select pg_temp.register_member(4,'learner','invalid')$cmd$,'INVALID_INPUT');
select pg_temp.expect_error($cmd$select pg_temp.register_member(4,'fake')$cmd$,'INVALID_INPUT');
select pg_temp.expect_error($cmd$select pg_temp.register_member(4,'learner',null,md5('other-org')::uuid)$cmd$,'MEMBER_ENTRY_FORBIDDEN');
select pg_temp.actor(2);
select pg_temp.check_result(not (public.life_identity()->>'is_super_admin')::boolean,'operator cannot impersonate chief');
select pg_temp.check_result((public.life_member_directory('office')->>'total')::int=4,'designated non-admin operator can read directory');
select pg_temp.check_result(not (public.life_member_directory('office')->'items'->0->>'can_manage')::boolean,'entry permission does not grant edit permission');
select pg_temp.register_member(5);
select pg_temp.expect_error($cmd$select public.life_delete_member(md5('member-test-3')::uuid,0)$cmd$,'FORBIDDEN');
select pg_temp.expect_error($cmd$select public.life_delete_member(md5('member-test-1')::uuid,0)$cmd$,'SUPER_ADMIN_PROTECTED');
select pg_temp.actor(20);
select pg_temp.check_result(public.life_login_context()->>'audience'='office','entry operator uses office login without broad admin role');
select pg_temp.check_result((public.life_security_status()->>'staff_required')::boolean,'entry operator requires staff MFA');
select pg_temp.register_member(6);
select pg_temp.actor(4);
select pg_temp.expect_error($cmd$select pg_temp.register_member(7,'learner',null,md5('other-org')::uuid)$cmd$,'MEMBER_ENTRY_FORBIDDEN');
select pg_temp.check_result((public.life_member_directory('learner','manual')->>'total')::int=0,'other organization cannot read manual members');
select pg_temp.actor(3);
select pg_temp.expect_error($cmd$select pg_temp.register_member(7)$cmd$,'MEMBER_ENTRY_FORBIDDEN');
select pg_temp.expect_error($cmd$select public.life_member_directory('learner')$cmd$,'FORBIDDEN');
select pg_temp.actor(1);
select public.life_save_member((public.life_member_directory('instructor','manual3@')->'items'->0->>'id')::uuid,'instructor','수동 수정',null,'INTERNAL',null,null,'0522300000',null,'수정 메모',1);
select pg_temp.check_result(public.life_member_directory('instructor','manual3@')->'items'->0->>'name'='수동 수정','manual instructor can be edited');
select public.life_delete_member((public.life_member_directory('learner','manual1@')->'items'->0->>'id')::uuid,1);
select pg_temp.check_result((public.life_member_directory('learner','manual1@')->>'total')::int=0,'manual deletion hides list entry');
select pg_temp.expect_error($cmd$select pg_temp.register_member(1)$cmd$,'REQUEST_CONFLICT');
reset role;
select pg_temp.check_result((select count(*) from life_private.manual_members)=5,'exactly five distinct records persisted');
select pg_temp.check_result((select count(*) from public.life_audit_events where action='MEMBER_CREATED')=5,'one creation audit per member');
select pg_temp.check_result(not exists(select 1 from public.life_role_assignments r join life_private.manual_members m on m.person_id=r.person_id),'manual entry never grants service roles');
select pg_temp.check_result((select count(*) from auth.users)=32,'manual entry never creates login accounts');
update auth.mfa_amr_claims set updated_at=now()-interval '20 minutes' where session_id=md5('session-1')::uuid;
set local role authenticated;
select pg_temp.expect_error($cmd$select pg_temp.register_member(9)$cmd$,'MFA_REAUTH_REQUIRED');
reset role;
set local role anon;
select pg_temp.expect_error($cmd$select pg_temp.register_member(8)$cmd$,'permission denied');
reset role;
select pg_temp.check_result(not has_table_privilege('authenticated','life_private.member_entry_operators','select') and not has_table_privilege('authenticated','life_private.manual_members','select'),'private tables inaccessible directly');
rollback;
