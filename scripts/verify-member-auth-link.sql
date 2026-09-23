-- Included by verify-member-manual-entry.sql with -v member_auth_extension=1.
-- Uses its synthetic fixtures and rolls back with the outer transaction.
do $$begin
  if current_database()<>'life_member_auth_test_20260923' then raise exception 'Isolated member auth test database required'; end if;
end$$;
update life_private.signup_settings set enabled=true,policy_id=md5('member-policy')::uuid;
update auth.mfa_amr_claims set updated_at=now() where session_id=md5('session-1')::uuid;
set local role authenticated;
select pg_temp.actor(1);
select pg_temp.expect_error($cmd$select pg_temp.register_member(100,'instructor','outside@example.invalid')$cmd$,'SCHOOL_EMAIL_REQUIRED');
do $$declare position text; person uuid; begin
  foreach position in array array['DIRECTOR','DIVISION_HEAD','CENTER_HEAD','OPERATIONS_HEAD','PRINCIPAL_RESEARCHER','SENIOR_RESEARCHER','RESEARCHER'] loop
    person:=public.life_create_member(md5(position)::uuid,'10000000-0000-4000-8000-000000000001','office','직책 검증',lower(position)||'@example.invalid',position,null,null,null,null,null,'');
    perform pg_temp.check_result(public.life_member_directory('office','',1,person)->'items'->0->>'office_position'=position,'create position '||position);
    perform public.life_save_member(person,'office','직책 검증',position,null,null,null,null,null,'',1);
  end loop;
end$$;
select pg_temp.expect_error($cmd$select public.life_create_member(md5('bad-position')::uuid,'10000000-0000-4000-8000-000000000001','office','검증','bad-position@example.invalid','SYSTEM_ADMIN',null,null,null,null,null,'')$cmd$,'INVALID_INPUT');
select public.life_create_member(md5('external-request')::uuid,'10000000-0000-4000-8000-000000000001','instructor','교외','external101@example.invalid',null,'EXTERNAL',null,null,null,null,'');
select pg_temp.register_member(102,'office');
select pg_temp.register_member(103,'office');
select pg_temp.register_member(104,'office');
reset role;

create function pg_temp.signup_manual(n integer,email text,provider text default 'email',audience text default 'learner') returns void language plpgsql as $$begin
  insert into auth.users(id,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values(md5('claim-user-'||n)::uuid,email,'synthetic-not-a-password',jsonb_build_object('provider',provider),
    jsonb_build_object('name','사용자 입력 이름','mobile_phone','+821011112222','privacy_policy_id',md5('member-policy')::uuid,
      'privacy_accepted',true,'member_audience',audience,'role','SYSTEM_ADMIN','person_id',md5('member-test-1')::uuid),now(),now());
end$$;
select pg_temp.signup_manual(2,'manual2@example.invalid','email','office');
select pg_temp.signup_manual(3,'manual3@uc.ac.kr','email','internal');
select pg_temp.check_result((select count(*) from life_private.manual_member_claims)=2,'only trusted matching members enter pending claims');
select pg_temp.check_result(not exists(select 1 from public.life_auth_links where auth_user_id in(md5('claim-user-2')::uuid,md5('claim-user-3')::uuid)),'unverified accounts do not link');
select pg_temp.check_result(not exists(select 1 from public.life_role_assignments r join life_private.manual_member_claims c on c.person_id=r.person_id),'unverified claims have no role');
-- A preassigned teaching record keeps the same person ID through activation.
insert into public.life_offering_instructors(offering_id,person_id)
select md5('member-offering')::uuid,person_id from life_private.manual_members where email='manual3@uc.ac.kr';
update auth.users set email_confirmed_at=now() where id in(md5('claim-user-2')::uuid,md5('claim-user-3')::uuid);
select pg_temp.check_result((select count(*) from life_private.manual_member_claims c join public.life_auth_links a on a.person_id=c.person_id and a.auth_user_id=c.user_id where c.verified_at is not null)=2,'verified accounts reuse exactly the existing person IDs');
select pg_temp.check_result((select p.name='수동 수정' from public.life_people p join life_private.manual_members m on m.person_id=p.id where m.email='manual3@uc.ac.kr'),'administrator name survives untrusted signup metadata');
select pg_temp.check_result((select count(*) from public.life_offering_instructors i join public.life_auth_links a on a.person_id=i.person_id where a.auth_user_id=md5('claim-user-3')::uuid)=1,'preassigned teaching record is preserved');
select pg_temp.check_result((select count(*) from public.life_role_assignments r join public.life_auth_links a on a.person_id=r.person_id where a.auth_user_id=md5('claim-user-3')::uuid and r.role='INSTRUCTOR')=1,'internal instructor gets only instructor membership');
select pg_temp.check_result(not exists(select 1 from public.life_role_assignments r join public.life_auth_links a on a.person_id=r.person_id where a.auth_user_id=md5('claim-user-2')::uuid),'office position does not grant administrative roles');
update auth.users set email_confirmed_at=now() where id=md5('claim-user-3')::uuid;
select pg_temp.check_result((select count(*) from public.life_audit_events where action='MANUAL_MEMBER_AUTH_LINKED')=2,'repeat confirmation is idempotent');
select pg_temp.check_result((select count(*) from public.life_consent_events where source='MANUAL_MEMBER_EMAIL_VERIFIED')=2,'consent persists once after confirmation');
select pg_temp.signup_manual(101,'external101@example.invalid');
select pg_temp.signup_manual(5,'manual5@example.invalid');
select pg_temp.signup_manual(102,'manual102@example.invalid','google');
select pg_temp.check_result(not exists(select 1 from life_private.manual_member_claims where user_id in(md5('claim-user-101')::uuid,md5('claim-user-5')::uuid,md5('claim-user-102')::uuid)),'external, learner and OAuth signups are excluded');
select pg_temp.expect_error($cmd$select pg_temp.signup_manual(200,'unlisted@example.invalid','email','office')$cmd$,'MEMBER_ACTIVATION_UNAVAILABLE');
select pg_temp.signup_manual(103,'manual103@example.invalid','email','office');
update public.life_people set active=false where id=(select person_id from life_private.manual_members where email='manual103@example.invalid');
update auth.users set email_confirmed_at=now() where id=md5('claim-user-103')::uuid;
select pg_temp.check_result(not exists(select 1 from public.life_auth_links where auth_user_id=md5('claim-user-103')::uuid),'deleted member cannot activate');
select pg_temp.signup_manual(104,'manual104@example.invalid','email','office');
update auth.users set email='changed104@example.invalid',email_confirmed_at=now() where id=md5('claim-user-104')::uuid;
select pg_temp.check_result(not exists(select 1 from public.life_auth_links where auth_user_id=md5('claim-user-104')::uuid),'different verified email cannot claim membership');

insert into auth.sessions(id,user_id,created_at,updated_at,aal)
select md5('claim-session-'||n)::uuid,md5('claim-user-'||n)::uuid,clock_timestamp(),clock_timestamp(),'aal1' from generate_series(2,3)n;
select set_config('request.jwt.claims',jsonb_build_object('sub',md5('claim-user-2')::uuid,'session_id',md5('claim-session-2')::uuid,'aal','aal1')::text,true);
set local role authenticated;
select pg_temp.check_result(public.life_login_context()->>'audience'='office','verified office member follows office login');
select pg_temp.check_result((public.life_security_status()->>'staff_required')::boolean and not (public.life_security_status()->>'mfa_verified')::boolean,'office still requires separate MFA');
select pg_temp.check_result(public.life_identity() is null,'office identity is inaccessible before MFA');
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',md5('claim-user-3')::uuid,'session_id',md5('claim-session-3')::uuid,'aal','aal1')::text,true);
set local role authenticated;
select pg_temp.check_result(public.life_login_context()->>'audience'='internal','verified instructor follows internal login');
select pg_temp.check_result(public.life_identity()->>'member_group'='instructor','instructor identity references original membership');
select pg_temp.actor(1);
select pg_temp.check_result((public.life_member_directory('office','manual2@')->'items'->0->>'account_verified')::boolean,'directory distinguishes verified members');
reset role;
select pg_temp.check_result(not has_function_privilege('authenticated','life_private.link_verified_manual_member(uuid)','execute'),'clients cannot directly activate membership');
select pg_temp.check_result(not has_table_privilege('authenticated','life_private.manual_member_claims','select') and not has_table_privilege('anon','life_private.manual_member_claims','insert'),'pending claim table is private');
