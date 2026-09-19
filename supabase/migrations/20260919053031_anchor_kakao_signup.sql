-- Public learners may supply an UNVERIFIED mobile number. No SMS/PASS provider.
create table life_private.signup_settings (
  singleton boolean primary key default true check(singleton),
  org_id uuid not null references public.life_organizations(id),
  policy_id uuid references public.life_policy_versions(id),
  enabled boolean not null default false
);
insert into life_private.signup_settings(singleton,org_id)
values(true,'10000000-0000-4000-8000-000000000001');
create table life_private.learner_contacts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone text not null check(phone ~ '^\+82(10[0-9]{8}|1[16789][0-9]{7,8})$'),
  phone_verified_at timestamptz check(phone_verified_at is null),
  signup_source text not null check(signup_source in ('EMAIL','KAKAO')),
  policy_id uuid not null references public.life_policy_versions(id),
  created_at timestamptz not null default now()
);
alter table life_private.signup_settings enable row level security;
alter table life_private.learner_contacts enable row level security;
revoke all on life_private.signup_settings,life_private.learner_contacts from public,anon,authenticated,service_role;

create function life_private.signup_policy() returns uuid
language sql stable security definer set search_path='' as $$
  select s.policy_id from life_private.signup_settings s
  where s.enabled and life_private.policy_valid(s.policy_id,s.org_id,'ACCOUNT_PRIVACY')
$$;
create function public.life_signup_policy() returns uuid
language sql stable security invoker set search_path='' as $$select life_private.signup_policy()$$;
revoke all on function life_private.signup_policy(),public.life_signup_policy() from public,anon,authenticated,service_role;
grant execute on function life_private.signup_policy(),public.life_signup_policy() to anon,authenticated;

-- Supabase Auth manages app_metadata. Client-editable user_metadata never grants roles.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path='' as $$
declare p uuid; v public.life_policy_versions; n text:=trim(new.raw_user_meta_data->>'name');
  mobile text:=new.raw_user_meta_data->>'mobile_phone';
begin
  if new.raw_app_meta_data->>'provider'='kakao' then
    if life_private.signup_policy() is null then raise exception 'PUBLIC_SIGNUP_CLOSED'; end if;
    return new; -- Auth-only pending account, no access to application data.
  end if;
  select * into v from public.life_policy_versions where id=(new.raw_user_meta_data->>'privacy_policy_id')::uuid;
  if v.id is null or not life_private.policy_valid(v.id,v.org_id,'ACCOUNT_PRIVACY')
    or coalesce(new.raw_user_meta_data->>'privacy_accepted','false')<>'true' then
    raise exception 'APPROVED_ACCOUNT_PRIVACY_REQUIRED';
  end if;
  -- Native invitations retain their individually approved consent workflow.
  if new.invited_at is null then
    if life_private.signup_policy() is null or v.id is distinct from life_private.signup_policy() then
      raise exception 'PUBLIC_SIGNUP_CLOSED_OR_POLICY_CHANGED';
    end if;
    if n is null or length(n) not between 1 and 100 or mobile is null
      or mobile !~ '^\+82(10[0-9]{8}|1[16789][0-9]{7,8})$' then raise exception 'INVALID_SIGNUP_INPUT'; end if;
  end if;
  insert into public.user_profiles(id,email,name,role)
    values(new.id,coalesce(new.email,''),left(coalesce(nullif(n,''),'학습자'),100),'LEARNER');
  insert into public.life_people(name) values(left(coalesce(nullif(n,''),'학습자'),100)) returning id into p;
  insert into public.life_auth_links values(p,new.id);
  insert into public.life_consent_events(person_id,policy_id,accepted,source) values(p,v.id,true,'SIGNUP');
  if new.invited_at is null then
    insert into life_private.learner_contacts(user_id,phone,signup_source,policy_id) values(new.id,mobile,'EMAIL',v.id);
  end if;
  return new;
end $$;

create function life_private.native_session_valid() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u join auth.sessions s on s.user_id=u.id
 left join life_private.credential_state c on c.user_id=u.id
 where u.id=auth.uid() and s.id::text=auth.jwt()->>'session_id'
 and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
 and (s.not_after is null or s.not_after>now()) and (c.user_id is null or s.created_at>=c.changed_at))
$$;
create function life_private.oauth_session() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.mfa_amr_claims a join auth.sessions s on s.id=a.session_id
 where s.user_id=auth.uid() and s.id::text=auth.jwt()->>'session_id' and a.authentication_method='oauth')
 and exists(select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) e where e->>'method'='oauth')
$$;
create function life_private.kakao_learner_session() returns boolean
language sql stable security definer set search_path='' as $$
 select life_private.oauth_session()
 and exists(select 1 from auth.identities i where i.user_id=auth.uid() and i.provider='kakao')
 and not exists(select 1 from public.life_auth_links a join public.life_role_assignments r on r.person_id=a.person_id
 where a.auth_user_id=auth.uid() and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now()))
$$;
create function life_private.registration_status() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('state',case
 when not life_private.native_session_valid() then 'SIGNED_OUT'
 when not life_private.kakao_learner_session() then 'EMAIL_LOGIN_REQUIRED'
 when exists(select 1 from public.life_auth_links a join public.life_people p on p.id=a.person_id where a.auth_user_id=auth.uid() and not p.active) then 'UNAVAILABLE'
 when exists(select 1 from life_private.learner_contacts c join public.life_auth_links a on a.auth_user_id=c.user_id
 where c.user_id=auth.uid() and c.signup_source='KAKAO') then 'COMPLETE'
 when life_private.signup_policy() is null then 'CLOSED'
 else 'PENDING' end)
$$;
create function public.life_registration_status() returns jsonb
language sql stable security invoker set search_path='' as $$select life_private.registration_status()$$;

create function life_private.complete_registration(p_name text,p_phone text,p_policy uuid,p_accepted boolean) returns void
language plpgsql security definer set search_path='' as $$
declare p uuid; st text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  perform 1 from auth.users where id=auth.uid() for update;
  st:=life_private.registration_status()->>'state';
  if st='COMPLETE' then return; end if;
  if st<>'PENDING' then raise exception 'REGISTRATION_UNAVAILABLE'; end if;
  if p_name is null or length(trim(p_name)) not between 1 and 100 or p_phone is null
    or p_phone !~ '^\+82(10[0-9]{8}|1[16789][0-9]{7,8})$' then raise exception 'INVALID_SIGNUP_INPUT'; end if;
  if p_accepted is distinct from true or p_policy is null or p_policy is distinct from life_private.signup_policy() then raise exception 'POLICY_CHANGED'; end if;
  select person_id into p from public.life_auth_links where auth_user_id=auth.uid();
  if p is null then
    insert into public.life_people(name) values(trim(p_name)) returning id into p;
    insert into public.life_auth_links values(p,auth.uid());
    insert into public.user_profiles(id,email,name,role)
      select id,coalesce(email,''),trim(p_name),'LEARNER' from auth.users where id=auth.uid();
  end if;
  -- Existing person's records/name are retained on native verified-email linking.
  insert into life_private.learner_contacts(user_id,phone,signup_source,policy_id)
    values(auth.uid(),p_phone,'KAKAO',p_policy)
    on conflict(user_id) do update set phone=excluded.phone,phone_verified_at=null,signup_source='KAKAO',policy_id=excluded.policy_id;
  insert into public.life_consent_events(person_id,policy_id,accepted,source) values(p,p_policy,true,'KAKAO_SIGNUP');
end $$;
create function public.life_complete_registration(p_name text,p_phone text,p_policy uuid,p_accepted boolean) returns void
language sql security invoker set search_path='' as $$select life_private.complete_registration(p_name,p_phone,p_policy,p_accepted)$$;

create or replace function life_private.auth_status() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('active',life_private.native_session_valid()
 and exists(select 1 from public.life_auth_links a join public.life_people p on p.id=a.person_id where a.auth_user_id=auth.uid() and p.active)
 and (not life_private.oauth_session() or (life_private.kakao_learner_session()
   and exists(select 1 from life_private.learner_contacts where user_id=auth.uid() and signup_source='KAKAO'))),
 'needs_reset',case when life_private.oauth_session() then not life_private.kakao_learner_session()
 else not exists(select 1 from life_private.credential_state where user_id=auth.uid() and policy_version=1) end)
$$;
create or replace function life_private.person_id() returns uuid
language sql stable security definer set search_path='' as $$
 select a.person_id from public.life_auth_links a
 where a.auth_user_id=auth.uid() and (life_private.auth_status()->>'active')::boolean
 and not (life_private.auth_status()->>'needs_reset')::boolean
 and ((not life_private.mfa_required() and coalesce(auth.jwt()->>'aal','aal1')<>'aal2') or life_private.mfa_verified())
$$;

revoke all on function life_private.native_session_valid(),life_private.oauth_session(),life_private.kakao_learner_session(),life_private.registration_status(),public.life_registration_status(),life_private.complete_registration(text,text,uuid,boolean),public.life_complete_registration(text,text,uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function life_private.registration_status(),public.life_registration_status(),life_private.complete_registration(text,text,uuid,boolean),public.life_complete_registration(text,text,uuid,boolean) to authenticated;
