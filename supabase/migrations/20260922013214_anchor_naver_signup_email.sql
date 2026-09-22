-- NAVER proves its subject, but not ownership of its contact email.
-- Keep pending OAuth access separate from completed portal registration.
create or replace function life_private.complete_registration(p_name text,p_phone text,p_policy uuid,p_accepted boolean) returns void
language plpgsql security definer set search_path='' as $$
declare p uuid; st text; source text;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 perform 1 from auth.users where id=auth.uid() for update;
 st:=life_private.registration_status()->>'state';
 if st='COMPLETE' then return; end if;
 if st<>'PENDING' then raise exception 'REGISTRATION_UNAVAILABLE'; end if;
 if exists(select 1 from auth.identities where user_id=auth.uid() and provider='custom:naver')
 and not exists(select 1 from auth.users where id=auth.uid() and nullif(email,'') is not null and email_confirmed_at is not null)
 then raise exception 'VERIFIED_SIGNUP_EMAIL_REQUIRED'; end if;
 if p_name is null or length(trim(p_name)) not between 1 and 100 or p_phone is null or p_phone !~ '^\+82(10[0-9]{8}|1[16789][0-9]{7,8})$' then raise exception 'INVALID_SIGNUP_INPUT'; end if;
 if p_accepted is distinct from true or p_policy is null or p_policy is distinct from life_private.signup_policy() then raise exception 'POLICY_CHANGED'; end if;
 select person_id into p from public.life_auth_links where auth_user_id=auth.uid();
 if p is null then
   insert into public.life_people(name) values(trim(p_name)) returning id into p;
   insert into public.life_auth_links values(p,auth.uid());
   insert into public.user_profiles(id,email,name,role) select id,coalesce(email,''),trim(p_name),'LEARNER' from auth.users where id=auth.uid();
 end if;
 source:=case when exists(select 1 from auth.identities where user_id=auth.uid() and provider='kakao') then 'KAKAO' else 'SOCIAL' end;
 insert into life_private.learner_contacts(user_id,phone,signup_source,policy_id) values(auth.uid(),p_phone,source,p_policy)
 on conflict(user_id) do update set phone=excluded.phone,phone_verified_at=null,signup_source=excluded.signup_source,policy_id=excluded.policy_id;
 insert into public.life_consent_events(person_id,policy_id,accepted,source) values(p,p_policy,true,source||'_SIGNUP');
end $$;
