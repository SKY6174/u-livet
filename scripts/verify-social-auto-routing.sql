-- Run after verify-kakao-signup.sql in a ROLLBACK transaction.
do $$declare
 org uuid:='10000000-0000-4000-8000-000000000001'; approver uuid:=gen_random_uuid(); pol uuid:=gen_random_uuid();
 provider text; u uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); p uuid; consent_count bigint;
 fresh uuid:=gen_random_uuid(); fresh_session uuid:=gen_random_uuid(); factor uuid:=gen_random_uuid();
begin
 perform set_config('request.jwt.claims','{}',true);
 insert into public.life_people(id,name) values(approver,'[TEST] Auto routing policy');
 insert into public.life_policy_versions(id,org_id,kind,version,title,body,status,approved_by,approved_at)
 values(pol,org,'ACCOUNT_PRIVACY',pol::text,'[TEST] Auto routing','Synthetic only','APPROVED',approver,now());
 update life_private.signup_settings set enabled=true,policy_id=pol;
 foreach provider in array array['kakao','google','custom:naver'] loop
 u:=gen_random_uuid(); s:=gen_random_uuid(); fresh:=gen_random_uuid(); fresh_session:=gen_random_uuid(); factor:=gen_random_uuid();
 perform set_config('request.jwt.claims','{}',true);
 -- A completed EMAIL signup is linked by Auth to the same user's Kakao identity.
 insert into auth.users(id,aud,role,email,email_confirmed_at,encrypted_password,raw_app_meta_data,raw_user_meta_data)
 values(u,'authenticated','authenticated',u::text||'@example.invalid',now(),'synthetic-hash','{"provider":"email"}',
 jsonb_build_object('name','[TEST] Existing email member','mobile_phone','+821012345678','privacy_policy_id',pol,'privacy_accepted',true));
 select person_id into p from public.life_auth_links where auth_user_id=u;
 insert into auth.identities(user_id,provider_id,provider,identity_data) values(u,u::text,provider,jsonb_build_object('sub',u));
 insert into auth.sessions(id,user_id,created_at,aal) values(s,u,clock_timestamp(),'aal1');
 insert into auth.mfa_amr_claims(id,session_id,authentication_method,created_at,updated_at) values(gen_random_uuid(),s,'oauth',now(),now());
 perform pg_temp.jwt(u,s,'oauth');
 perform pg_temp.check_it(public.life_registration_status()->>'state'='COMPLETE',provider||' existing email member recognized after identity linking');
 perform pg_temp.check_it((public.life_auth_status()->>'active')::boolean and (public.life_identity()->>'id')::uuid=p,'existing email member logs into the original identity');
 select count(*) into consent_count from public.life_consent_events where person_id=p;
 perform public.life_complete_registration(null,null,null,false);
 perform pg_temp.check_it((select count(*) from public.life_consent_events where person_id=p)=consent_count and (select signup_source from life_private.learner_contacts where user_id=u)='EMAIL','repeat registration preserves email signup and consent history');
 update life_private.signup_settings set enabled=false;
 perform pg_temp.check_it(public.life_registration_status()->>'state'='COMPLETE' and public.life_identity() is not null,'closing new signup does not block existing members');
 update life_private.signup_settings set enabled=true;
 -- A separate Kakao account with the same entered contact data is still new.
 perform set_config('request.jwt.claims','{}',true);
 insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data)
 values(fresh,'authenticated','authenticated',fresh::text||'@example.invalid',jsonb_build_object('provider',provider),jsonb_build_object('name','[TEST] Existing email member','mobile_phone','+821012345678'));
 insert into auth.identities(user_id,provider_id,provider,identity_data) values(fresh,fresh::text,provider,jsonb_build_object('sub',fresh));
 insert into auth.sessions(id,user_id,created_at,aal) values(fresh_session,fresh,clock_timestamp(),'aal1');
 insert into auth.mfa_amr_claims(id,session_id,authentication_method,created_at,updated_at) values(gen_random_uuid(),fresh_session,'oauth',now(),now());
 perform pg_temp.jwt(fresh,fresh_session,'oauth');
 perform pg_temp.check_it(public.life_registration_status()->>'state'='PENDING' and public.life_identity() is null,'unlinked new Kakao account cannot inherit another member identity');
 perform pg_temp.jwt(u,s,'oauth');
 update public.life_people set active=false where id=p;
 perform pg_temp.check_it(public.life_registration_status()->>'state'='UNAVAILABLE' and public.life_identity() is null,'inactive email member cannot log in with Kakao');
 update public.life_people set active=true where id=p;
 perform set_config('request.jwt.claims','{}',true);
 insert into public.life_role_assignments(person_id,org_id,role) values(p,org,'INSTRUCTOR');
 perform pg_temp.jwt(u,s,'oauth');
 perform pg_temp.check_it(public.life_registration_status()->>'state'='COMPLETE' and public.life_login_context()->>'audience'='external' and public.life_identity() is not null,provider||' existing external instructor logs in');
 update life_private.account_classifications set instructor_kind='INTERNAL' where person_id=p;
 perform pg_temp.check_it(public.life_registration_status()->>'state'='EMAIL_LOGIN_REQUIRED' and public.life_identity() is null,'internal instructor still requires school email login');
 update life_private.account_classifications set instructor_kind='EXTERNAL' where person_id=p;
 insert into public.life_role_assignments(person_id,org_id,role) values(p,org,'COURSE_MANAGER');
 perform pg_temp.check_it(public.life_registration_status()->>'state'='EMAIL_LOGIN_REQUIRED' and public.life_identity() is null,'office role still blocks OAuth');
 perform set_config('request.jwt.claims','{}',true);
 delete from public.life_role_assignments where person_id=p and role='COURSE_MANAGER';
 perform set_config('life.mfa_recovery_user',u::text,true);
 insert into auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at) values(factor,u,'totp','verified',now(),now());
 perform pg_temp.jwt(u,s,'oauth');
 perform pg_temp.check_it(public.life_registration_status()->>'state'='COMPLETE' and (public.life_security_status()->>'mfa_required')::boolean and public.life_identity() is null,provider||' existing email member cannot bypass configured MFA');
 update auth.sessions set aal='aal2',factor_id=factor where id=s;
 insert into auth.mfa_amr_claims(id,session_id,authentication_method,created_at,updated_at) values(gen_random_uuid(),s,'totp',now(),now());
 perform pg_temp.jwt(u,s,'oauth','aal2');
 perform pg_temp.check_it(public.life_identity() is not null,'existing email member regains identity after verified MFA');
 update auth.users set banned_until=now()+interval '1 hour' where id=u;
 perform pg_temp.check_it(public.life_registration_status()->>'state'='SIGNED_OUT' and public.life_identity() is null,'banned member cannot bypass account restrictions');
 update auth.users set banned_until=null where id=u;
 end loop;
 -- Leave a valid JWT for the actual API-role checks below.
end $$;
set local role authenticated;
select pg_temp.check_it(public.life_registration_status()->>'state'='COMPLETE' and public.life_identity() is not null,'authenticated API role sees the existing member');
select pg_temp.check_it(not has_table_privilege('authenticated','life_private.learner_contacts','select'),'contact data remains inaccessible to browser role');
reset role;
