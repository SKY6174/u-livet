-- Execute with verify-kakao-signup.sql helpers in a transaction; always ROLLBACK.
do $$declare
 org uuid:='10000000-0000-4000-8000-000000000001'; approver uuid:=gen_random_uuid(); pol uuid:=gen_random_uuid();
 u uuid; s uuid; p uuid; provider text; external_person uuid; internal_person uuid;
 admin_user uuid:=gen_random_uuid(); admin_session uuid:=gen_random_uuid(); admin_person uuid; factor uuid:=gen_random_uuid();
begin
 perform set_config('request.jwt.claims','{}',true);
 insert into public.life_people(id,name) values(approver,'[TEST] Classification policy');
 insert into public.life_policy_versions(id,org_id,kind,version,title,body,status,approved_by,approved_at)
 values(pol,org,'ACCOUNT_PRIVACY',pol::text,'[TEST] All social providers','Synthetic only','APPROVED',approver,now());
 update life_private.signup_settings set enabled=true,policy_id=pol;
 foreach provider in array array['kakao','google','custom:naver'] loop
   u:=gen_random_uuid();s:=gen_random_uuid();
   perform set_config('request.jwt.claims','{}',true);
   insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
   values(u,'authenticated','authenticated',u::text||'@example.invalid',now(),jsonb_build_object('provider',provider),'{"role":"INSTRUCTOR","instructor_kind":"EXTERNAL","office_position":"DIRECTOR"}');
   insert into auth.identities(user_id,provider_id,provider,identity_data) values(u,u::text,provider,jsonb_build_object('sub',u));
   insert into auth.sessions(id,user_id,created_at,aal) values(s,u,clock_timestamp(),'aal1');
   insert into auth.mfa_amr_claims(id,session_id,authentication_method,created_at,updated_at) values(gen_random_uuid(),s,'oauth',now(),now());
   perform pg_temp.jwt(u,s,'oauth');
   perform pg_temp.check_it(public.life_registration_status()->>'state'='PENDING',provider||' pending registration supported');
   perform public.life_complete_registration('[TEST] Social applicant','+821012345678',pol,true);
   p:=(public.life_identity()->>'id')::uuid;
   perform pg_temp.check_it(public.life_login_context()->>'audience'='learner' and public.life_identity()->'roles'='[]'::jsonb,provider||' user metadata grants no instructor or office role');
   perform set_config('request.jwt.claims','{}',true);
   insert into public.life_role_assignments(person_id,org_id,role) values(p,org,'INSTRUCTOR');
   perform pg_temp.jwt(u,s,'oauth');
   perform pg_temp.check_it(public.life_identity() is not null and public.life_login_context()->>'audience'='external',provider||' approved external instructor allowed');
   perform pg_temp.rejects(format('select public.life_set_account_classification(%L,''DIRECTOR'',''EXTERNAL'')',p),provider||' instructor cannot change own trusted classification');
   perform pg_temp.check_it(public.life_manageable_accounts()='[]'::jsonb,provider||' instructor cannot list staff accounts');
   perform set_config('request.jwt.claims','{}',true);
   update life_private.account_classifications set instructor_kind='INTERNAL' where person_id=p;
   perform pg_temp.jwt(u,s,'oauth');
   perform pg_temp.check_it(public.life_identity() is null and public.life_registration_status()->>'state'='EMAIL_LOGIN_REQUIRED',provider||' internal classification immediately blocks OAuth');
   perform set_config('request.jwt.claims','{}',true);
   update life_private.account_classifications set instructor_kind='EXTERNAL' where person_id=p;
   insert into public.life_role_assignments(person_id,org_id,role) values(p,org,'COURSE_MANAGER');
   perform pg_temp.jwt(u,s,'oauth');
   perform pg_temp.check_it(public.life_identity() is null and public.life_registration_status()->>'state'='EMAIL_LOGIN_REQUIRED',provider||' office role takes priority and blocks OAuth');
   perform set_config('request.jwt.claims','{}',true);
   delete from public.life_role_assignments where person_id=p and role='COURSE_MANAGER';
   external_person:=p;
 end loop;
 -- School email plus password is required even when the caller chooses another tab.
 u:=gen_random_uuid();s:=gen_random_uuid();
 insert into auth.users(id,aud,role,email,email_confirmed_at,encrypted_password,raw_app_meta_data,raw_user_meta_data)
 values(u,'authenticated','authenticated',u::text||'@uc.ac.kr',now(),'synthetic-hash','{"provider":"email"}',jsonb_build_object('name','[TEST] Internal','mobile_phone','+821012345678','privacy_policy_id',pol,'privacy_accepted',true));
 select person_id into internal_person from public.life_auth_links where auth_user_id=u;
 insert into public.life_role_assignments(person_id,org_id,role) values(internal_person,org,'INSTRUCTOR');
 insert into auth.sessions(id,user_id,created_at,aal) values(s,u,clock_timestamp(),'aal1');
 perform pg_temp.jwt(u,s,'password');
 perform pg_temp.check_it(public.life_identity() is not null and public.life_login_context()->>'audience'='internal','school password login accepted');
 update auth.users set email=u::text||'@example.invalid' where id=u;
 perform pg_temp.check_it(public.life_identity() is null,'internal email changed off-domain blocked in DB');
 update auth.users set email=u::text||'@uc.ac.kr',email_confirmed_at=null where id=u;
 perform pg_temp.check_it(public.life_identity() is null,'unverified school email blocked in DB');
 update auth.users set email_confirmed_at=now() where id=u;
 perform set_config('request.jwt.claims','{}',true);
 -- Administrator needs MFA for identity, recent MFA for classification updates.
 insert into auth.users(id,aud,role,email,email_confirmed_at,encrypted_password,raw_app_meta_data,raw_user_meta_data)
 values(admin_user,'authenticated','authenticated',admin_user::text||'@uc.ac.kr',now(),'synthetic-hash','{"provider":"email"}',jsonb_build_object('name','[TEST] Admin','mobile_phone','+821012345678','privacy_policy_id',pol,'privacy_accepted',true,'office_position','DIRECTOR'));
 select person_id into admin_person from public.life_auth_links where auth_user_id=admin_user;
 insert into public.life_role_assignments(person_id,org_id,role) values(admin_person,org,'SYSTEM_ADMIN');
 insert into auth.sessions(id,user_id,created_at,aal) values(admin_session,admin_user,clock_timestamp(),'aal1');
 perform pg_temp.jwt(admin_user,admin_session,'password');
 perform pg_temp.check_it(public.life_login_context()->>'audience'='office' and public.life_login_context()->>'office_position' is null,'office detected from roles; metadata cannot forge position');
 perform pg_temp.check_it(public.life_identity() is null,'office still requires MFA');
 perform pg_temp.rejects(format('select public.life_set_account_classification(%L,''DIRECTOR'',null)',admin_person),'office classification requires MFA');
 perform set_config('request.jwt.claims','{}',true);
 perform set_config('life.mfa_recovery_user',admin_user::text,true);
 insert into auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at) values(factor,admin_user,'totp','verified',now(),now());
 update auth.sessions set aal='aal2',factor_id=factor where id=admin_session;
 insert into auth.mfa_amr_claims(id,session_id,authentication_method,created_at,updated_at) values(gen_random_uuid(),admin_session,'totp',now(),now());
 perform pg_temp.jwt(admin_user,admin_session,'totp','aal2');
 perform public.life_set_account_classification(admin_person,'DIRECTOR',null);
 perform pg_temp.check_it(public.life_identity()->>'office_position'='DIRECTOR','trusted office position appears after login');
 perform public.life_set_account_classification(admin_person,'CENTER_HEAD',null);
 perform pg_temp.check_it(public.life_identity()->>'office_position'='CENTER_HEAD','center head position supported');
 perform public.life_set_account_classification(admin_person,'RESEARCHER',null);
 perform pg_temp.check_it(public.life_identity()->>'office_position'='RESEARCHER','researcher position supported');
 perform pg_temp.rejects(format('select public.life_set_account_classification(%L,null,''INTERNAL'')',external_person),'internal assignment rejects external email');
 perform pg_temp.rejects(format('select public.life_set_account_classification(%L,''DIRECTOR'',''EXTERNAL'')',external_person),'instructor cannot be labeled as office without office role');
 perform pg_temp.rejects(format('select public.life_set_account_classification(%L,''DIRECTOR'',null)',gen_random_uuid()),'unknown account rejected');
 perform pg_temp.check_it(jsonb_array_length(public.life_manageable_accounts())>=5,'verified administrator can list managed accounts');
 -- Exercise the actual API role, not only owner-level calls with JWT claims.
 set local role authenticated;
 perform pg_temp.check_it(public.life_login_context()->>'audience'='office','authenticated role can invoke login context');
 perform pg_temp.check_it(jsonb_array_length(public.life_manageable_accounts())>=5,'authenticated role can invoke scoped account list');
 perform public.life_set_account_classification(admin_person,'DIRECTOR',null);
 perform pg_temp.check_it(public.life_identity()->>'office_position'='DIRECTOR','authenticated administrator can save classification through public RPC');
 reset role;
 update auth.mfa_amr_claims set updated_at=now()-interval '121 minutes' where session_id=admin_session;
 perform pg_temp.rejects(format('select public.life_set_account_classification(%L,''DIRECTOR'',null)',admin_person),'classification update requires recent MFA');
 perform pg_temp.check_it(not has_table_privilege('authenticated','life_private.account_classifications','update'),'classification table not writable by clients');
 perform pg_temp.check_it(not has_table_privilege('authenticated','life_private.account_classifications','select'),'classification table not directly readable');
 perform pg_temp.check_it(not has_function_privilege('anon','public.life_set_account_classification(uuid,text,text)','execute'),'anonymous classification update denied');
 perform set_config('request.jwt.claims','{}',true);
 perform pg_temp.check_it(public.life_login_context() is null,'signed-out classification not exposed');
end $$;
