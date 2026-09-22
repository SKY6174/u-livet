-- Transaction-only synthetic account. Never changes a real member or leaves consent.
begin;
do $$
declare u uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); p uuid; c integer; denied boolean;
begin
 p:=life_private.signup_policy();
 if p is null then raise exception 'TEST_REQUIRES_OPEN_SIGNUP_POLICY'; end if;
 insert into auth.users(id,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
 values(u,'authenticated','authenticated','{"provider":"custom:naver","providers":["custom:naver"]}', '{}',now(),now());
 insert into auth.identities(provider_id,user_id,identity_data,provider,created_at,updated_at)
 values(u::text,u,jsonb_build_object('sub',u::text,'email','unverified@example.invalid','email_verified',false),'custom:naver',now(),now());
 insert into auth.sessions(id,user_id,created_at,updated_at,aal) values(s,u,now(),now(),'aal1');
 insert into auth.mfa_amr_claims(id,session_id,created_at,updated_at,authentication_method) values(gen_random_uuid(),s,now(),now(),'oauth');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u::text,'role','authenticated','session_id',s::text,'aal','aal1','amr',jsonb_build_array(jsonb_build_object('method','oauth','timestamp',extract(epoch from now())::integer)))::text,true);
 if life_private.registration_status()->>'state'<>'PENDING' then raise exception 'EXPECTED_PENDING'; end if;
 denied:=false;
 begin perform public.life_complete_registration('Synthetic NAVER','+821012345678',p,true);
 exception when others then if sqlerrm<>'VERIFIED_SIGNUP_EMAIL_REQUIRED' then raise; end if; denied:=true; end;
 if not denied then raise exception 'UNVERIFIED_EMAIL_BYPASS'; end if;
 update auth.users set raw_user_meta_data='{"email":"forged@example.invalid","email_verified":true}' where id=u;
 denied:=false;
 begin perform public.life_complete_registration('Synthetic NAVER','+821012345678',p,true);
 exception when others then if sqlerrm<>'VERIFIED_SIGNUP_EMAIL_REQUIRED' then raise; end if; denied:=true; end;
 if not denied then raise exception 'METADATA_BYPASS'; end if;
 if exists(select 1 from public.life_auth_links where auth_user_id=u) then raise exception 'PREMATURE_MEMBER_CREATION'; end if;
 update auth.users set email='naver-fixture-'||u::text||'@example.invalid',email_confirmed_at=now() where id=u;
 denied:=false;
 begin perform public.life_complete_registration('Synthetic NAVER','+821012345678',p,false);
 exception when others then if sqlerrm<>'POLICY_CHANGED' then raise; end if; denied:=true; end;
 if not denied then raise exception 'CONSENT_BYPASS'; end if;
 perform public.life_complete_registration('Synthetic NAVER','+821012345678',p,true);
 if life_private.registration_status()->>'state'<>'COMPLETE' then raise exception 'EXPECTED_COMPLETE'; end if;
 select count(*) into c from public.life_consent_events where person_id=(select person_id from public.life_auth_links where auth_user_id=u);
 perform public.life_complete_registration('Must not overwrite','+821099999999',p,true);
 if c<>1 or (select count(*) from public.life_consent_events where person_id=(select person_id from public.life_auth_links where auth_user_id=u))<>c then raise exception 'DUPLICATE_CONSENT'; end if;
 if not exists(select 1 from public.life_people a join public.life_auth_links b on b.person_id=a.id where b.auth_user_id=u and a.name='Synthetic NAVER') then raise exception 'EXISTING_PROFILE_OVERWRITTEN'; end if;
 if exists(select 1 from public.life_role_assignments a join public.life_auth_links b on b.person_id=a.person_id where b.auth_user_id=u) then raise exception 'UNEXPECTED_ROLE'; end if;
end $$;
rollback;
select 'NAVER registration DB guards passed; synthetic rows rolled back' as result;
