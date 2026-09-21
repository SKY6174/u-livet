-- Run after the migration inside a ROLLBACK transaction. Synthetic data only.
create function pg_temp.check_it(ok boolean,label text) returns void language plpgsql as $$begin
 if ok is distinct from true then raise exception 'FAIL: %',label; end if;
 raise notice 'PASS %',label;
end $$;
create function pg_temp.rejects(statement text,label text) returns void language plpgsql as $$begin
 begin execute statement; exception when others then raise notice 'PASS %',label; return; end;
 raise exception 'FAIL: %',label;
end $$;
create function pg_temp.jwt(u uuid,s uuid,method text,aal text default 'aal1') returns void language sql as $$
 select set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',s,'aal',aal,'amr',jsonb_build_array(jsonb_build_object('method',method,'timestamp',floor(extract(epoch from now()))::bigint)))::text,true)::void
$$;
do $$declare
 org uuid:='10000000-0000-4000-8000-000000000001'; ap uuid:=gen_random_uuid(); pol uuid:=gen_random_uuid();
 u uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); p uuid; e uuid:=gen_random_uuid(); es uuid:=gen_random_uuid(); ep uuid;
 f uuid:=gen_random_uuid(); other uuid:=gen_random_uuid(); other_s uuid:=gen_random_uuid();
begin
 insert into public.life_people(id,name) values(ap,'[TEST] Privacy approver');
 insert into public.life_policy_versions(id,org_id,kind,version,title,body,status,approved_by,approved_at)
 values(pol,org,'ACCOUNT_PRIVACY',pol::text,'[TEST] Signup','Synthetic only','APPROVED',ap,now());
 perform pg_temp.check_it(public.life_signup_policy() is null,'signup closed by default');
 perform pg_temp.rejects(format('insert into auth.users(id,raw_app_meta_data) values(%L,''{"provider":"kakao"}'')',u),'closed signup blocks direct Kakao account creation');
 update life_private.signup_settings set enabled=true,policy_id=pol;
 perform pg_temp.check_it(public.life_signup_policy()=pol,'configured approved signup policy');
 insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data) values(u,'authenticated','authenticated',u::text||'@example.invalid','{"provider":"kakao","providers":["kakao"]}','{"role":"SYSTEM_ADMIN","phone_confirmed_at":"2026-09-19"}');
 insert into auth.identities(user_id,provider_id,provider,identity_data) values(u,u::text,'kakao',jsonb_build_object('sub',u));
 insert into auth.sessions(id,user_id,created_at,aal) values(s,u,clock_timestamp(),'aal1');
 insert into auth.mfa_amr_claims(id,session_id,authentication_method,created_at,updated_at) values(gen_random_uuid(),s,'oauth',now(),now());
 perform pg_temp.jwt(u,s,'oauth');
 perform pg_temp.check_it(public.life_registration_status()->>'state'='PENDING','OAuth creates pending account');
 perform pg_temp.check_it(public.life_identity() is null,'pending account cannot access business identity');
 perform pg_temp.rejects(format('select public.life_complete_registration(''Learner'',null,%L,true)',pol),'missing phone rejected');
 perform pg_temp.rejects(format('select public.life_complete_registration(''Learner'',''+821012345678'',%L,false)',pol),'missing consent rejected');
 perform pg_temp.rejects('select public.life_complete_registration(''Learner'',''+821012345678'',null,true)','missing policy rejected');
 perform pg_temp.rejects(format('select public.life_complete_registration(''Learner'',''+821012345678'',%L,true)',gen_random_uuid()),'old or forged policy rejected');
 perform public.life_complete_registration('Synthetic learner','+821012345678',pol,true);
 p:=(public.life_identity()->>'id')::uuid;
 perform pg_temp.check_it(p is not null,'completed OAuth learner has identity');
 perform pg_temp.check_it(public.life_identity()->'roles'='[]'::jsonb,'forged roles do not grant privileges');
 perform pg_temp.check_it((select phone_verified_at is null from life_private.learner_contacts where user_id=u),'phone remains unverified');
 perform pg_temp.rejects(format('update life_private.learner_contacts set phone_verified_at=now() where user_id=%L',u),'verification cannot be forged');
 perform public.life_complete_registration('Changed','+821087654321',pol,true);
 perform pg_temp.check_it((select count(*)=1 from public.life_consent_events where person_id=p and source='KAKAO_SIGNUP'),'completion retry is idempotent');
 perform pg_temp.check_it(not (public.life_auth_status()->>'needs_reset')::boolean,'passwordless learner is not forced to reset password');
 update auth.sessions set not_after=now()-interval '1 second' where id=s;
 perform pg_temp.check_it(public.life_identity() is null,'expired session rejected');
 update auth.sessions set not_after=null where id=s;
 update auth.users set banned_until=now()+interval '1 day' where id=u;
 perform pg_temp.check_it(public.life_identity() is null,'banned learner rejected');
 update auth.users set banned_until=null where id=u;
 update public.life_people set active=false where id=p;
 perform pg_temp.check_it(public.life_registration_status()->>'state'='UNAVAILABLE','inactive learner cannot reactivate via completion');
 update public.life_people set active=true where id=p;
 perform set_config('request.jwt.claims','{}',true);
 insert into public.life_role_assignments(person_id,org_id,role) values(p,org,'INSTRUCTOR');
 perform pg_temp.jwt(u,s,'oauth');
 perform pg_temp.check_it(public.life_identity() is not null,'approved external instructor OAuth session is allowed');
 perform pg_temp.check_it(public.life_registration_status()->>'state'='COMPLETE','external instructor registration retained');
 perform set_config('request.jwt.claims','{}',true);
 delete from public.life_role_assignments where person_id=p;
 -- Email accounts still require native password policy and session freshness.
 insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data)
 values(e,'authenticated','authenticated',e::text||'@example.invalid','synthetic-password-hash','{"provider":"email"}',jsonb_build_object('name','[TEST] Email learner','mobile_phone','+821012345678','privacy_policy_id',pol,'privacy_accepted',true,'role','SYSTEM_ADMIN'));
 insert into auth.sessions(id,user_id,created_at,aal) values(es,e,clock_timestamp(),'aal1');
 perform pg_temp.jwt(e,es,'password');
 ep:=(public.life_identity()->>'id')::uuid;
 perform pg_temp.check_it(ep is not null and public.life_identity()->'roles'='[]'::jsonb,'email signup preserves learner identity only');
 perform pg_temp.check_it((select phone_verified_at is null from life_private.learner_contacts where user_id=e),'email phone also unverified');
 -- Auth-linked email members reuse their completed registration.
 insert into auth.identities(user_id,provider_id,provider,identity_data) values(e,e::text,'kakao',jsonb_build_object('sub',e));
 insert into auth.sessions(id,user_id,created_at,aal) values(other_s,e,clock_timestamp(),'aal1');
 insert into auth.mfa_amr_claims(id,session_id,authentication_method,created_at,updated_at) values(gen_random_uuid(),other_s,'oauth',now(),now());
 perform pg_temp.jwt(e,other_s,'oauth');
 perform pg_temp.check_it(public.life_registration_status()->>'state'='COMPLETE' and public.life_identity() is not null,'automatically linked email uses its completed signup');
 perform public.life_complete_registration('Different display name','+821011112222',pol,true);
 perform pg_temp.check_it((public.life_identity()->>'id')::uuid=ep and public.life_identity()->>'name'='[TEST] Email learner','linking retains original person and name');
 perform set_config('request.jwt.claims','{}',true);
 insert into public.life_role_assignments(person_id,org_id,role) values(ep,org,'SYSTEM_ADMIN');
 perform pg_temp.jwt(e,other_s,'oauth');
 perform pg_temp.check_it(public.life_identity() is null,'linked staff OAuth remains blocked');
 perform pg_temp.jwt(e,es,'password');
 perform pg_temp.check_it(public.life_identity() is null and (public.life_security_status()->>'mfa_required')::boolean,'staff password login still requires MFA');
 perform set_config('request.jwt.claims','{}',true);
 -- The shared local fixture still has the older self-hosted factor guard.
 perform set_config('life.mfa_recovery_user',e::text,true);
 insert into auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at) values(f,e,'totp','verified',now(),now());
 update auth.sessions set aal='aal2',factor_id=f where id=es;
 insert into auth.mfa_amr_claims(id,session_id,authentication_method,created_at,updated_at) values(gen_random_uuid(),es,'totp',now(),now());
 perform pg_temp.jwt(e,es,'totp','aal2');
 perform pg_temp.check_it((public.life_identity()->>'id')::uuid=ep and (public.life_security_status()->>'recent')::boolean,'staff verified TOTP retains access');
 update auth.users set encrypted_password='changed-synthetic-password-hash' where id=e;
 perform pg_temp.check_it(public.life_identity() is null and not (public.life_auth_status()->>'active')::boolean,'password change invalidates old sessions including MFA');
 perform pg_temp.jwt(u,s,'oauth');
 delete from auth.sessions where id=s;
 perform pg_temp.check_it(public.life_identity() is null,'revoked session rejected even with old JWT');
 perform set_config('request.jwt.claims','{}',true);
 perform pg_temp.rejects(format('insert into auth.users(id,raw_app_meta_data,raw_user_meta_data) values(%L,''{"provider":"email"}'',%L)',other,jsonb_build_object('name','Test','privacy_policy_id',pol,'privacy_accepted',true)::text),'direct email signup cannot omit phone');
 perform pg_temp.check_it(not has_table_privilege('authenticated','life_private.learner_contacts','select'),'raw phone table unreadable to browser');
 perform pg_temp.check_it(not has_table_privilege('authenticated','life_private.learner_contacts','update'),'raw phone table immutable to browser');
 perform pg_temp.check_it(not has_function_privilege('anon','public.life_complete_registration(text,text,uuid,boolean)','execute'),'anonymous completion RPC denied');
 perform pg_temp.check_it(not has_function_privilege('anon','life_private.native_session_valid()','execute'),'private session helper inaccessible');
end $$;
