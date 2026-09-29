begin;

-- A generated provisional password never satisfies the first-login policy.
create or replace function life_private.record_credential_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' or new.encrypted_password is distinct from old.encrypted_password then
    if coalesce(new.encrypted_password,'')<>'' then
      insert into life_private.credential_state(user_id,policy_version,changed_at,pending_txid)
      values(new.id,case when tg_op='INSERT' and new.raw_user_meta_data ? 'member_provisioning_nonce' then 0 else 1 end,clock_timestamp(),null)
      on conflict(user_id) do update set policy_version=excluded.policy_version,changed_at=excluded.changed_at,pending_txid=excluded.pending_txid;
    else
      delete from life_private.credential_state where user_id=new.id;
    end if;
  end if;
  return new;
end $$;

-- The prepared approved policy is visible without opening learner signup.
-- No email parameter means this RPC cannot enumerate registered members.
create function life_private.member_activation_policy() returns uuid
language sql stable security definer set search_path='' as $$
  select s.policy_id from life_private.signup_settings s
  where life_private.policy_valid(s.policy_id,s.org_id,'ACCOUNT_PRIVACY')
$$;
create function public.life_member_activation_policy() returns uuid
language sql stable security invoker set search_path='' as $$
  select life_private.member_activation_policy()
$$;
revoke all on function life_private.member_activation_policy(),public.life_member_activation_policy()
  from public,anon,authenticated,service_role;
grant execute on function life_private.member_activation_policy(),public.life_member_activation_policy()
  to anon,authenticated;

create function life_private.require_office_school_email() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.member_group='office' and new.email !~ '^[^@[:space:]]+@uc\.ac\.kr$' then
    raise exception 'SCHOOL_EMAIL_REQUIRED';
  end if;
  return new;
end $$;
revoke all on function life_private.require_office_school_email() from public,anon,authenticated,service_role;
create trigger life_office_school_email before insert or update of email,member_group
on life_private.manual_members for each row execute function life_private.require_office_school_email();

create table life_private.member_auth_permits (
  person_id uuid primary key references life_private.manual_members(person_id) on delete cascade,
  nonce text not null check(nonce ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null
);
create table life_private.member_auth_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  person_id uuid not null unique references public.life_people(id) on delete cascade
);
alter table life_private.member_auth_permits enable row level security;
alter table life_private.member_auth_state enable row level security;
revoke all on life_private.member_auth_permits,life_private.member_auth_state from public,anon,authenticated,service_role;

create function life_private.prepare_member_auth(p_person uuid,p_nonce text) returns void
language plpgsql security definer set search_path='' as $$
declare member life_private.manual_members;
begin
  if life_private.person_id() is null or p_nonce !~ '^[a-f0-9]{64}$' then raise exception 'FORBIDDEN'; end if;
  select * into member from life_private.manual_members where person_id=p_person for update;
  if member.person_id is null or member.email !~ '^[^@[:space:]]+@uc\.ac\.kr$'
    or not (member.member_group='office' or (member.member_group='instructor' and exists(
      select 1 from life_private.account_classifications where person_id=p_person and instructor_kind='INTERNAL')))
    or not exists(select 1 from life_private.member_entry_orgs() where org_id=member.org_id)
    or exists(select 1 from public.life_auth_links where person_id=p_person and auth_user_id is not null)
    then raise exception 'MEMBER_PROVISIONING_UNAVAILABLE'; end if;
  insert into life_private.member_auth_permits(person_id,nonce,expires_at)
    values(p_person,p_nonce,now()+interval '5 minutes')
    on conflict(person_id) do update set nonce=excluded.nonce,expires_at=excluded.expires_at;
end $$;
create function public.life_prepare_member_auth(p_person uuid,p_nonce text) returns void
language sql security invoker set search_path='' as $$
  select life_private.prepare_member_auth(p_person,p_nonce)
$$;
revoke all on function life_private.prepare_member_auth(uuid,text),public.life_prepare_member_auth(uuid,text)
  from public,anon,authenticated,service_role;
grant execute on function life_private.prepare_member_auth(uuid,text),public.life_prepare_member_auth(uuid,text)
  to authenticated;

-- A one-time server-issued nonce must match the administrator-owned permit.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path='' as $$
declare p uuid; v public.life_policy_versions; n text:=trim(new.raw_user_meta_data->>'name');
  member life_private.manual_members;
  mobile text:=new.raw_user_meta_data->>'mobile_phone';
  kind text; permit text;
begin
  if new.raw_app_meta_data->>'provider' in ('kakao','google','custom:naver') then
    if life_private.signup_policy() is null then raise exception 'PUBLIC_SIGNUP_CLOSED'; end if;
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(lower(new.email),420));
  select m.* into member from life_private.manual_members m
    join public.life_people p on p.id=m.person_id and p.active
    left join life_private.account_classifications c on c.person_id=m.person_id
    where m.email=lower(new.email) and (m.member_group='office' or
      (m.member_group='instructor' and c.instructor_kind='INTERNAL' and m.email ~ '^[^@[:space:]]+@uc\.ac\.kr$')) for update of m;
  if new.raw_user_meta_data ? 'member_provisioning_nonce' then
    select nonce into permit from life_private.member_auth_permits
      where person_id=member.person_id and expires_at>now() for update;
    if member.person_id is null or new.invited_at is not null
      or new.email !~ '^[^@[:space:]]+@uc\.ac\.kr$'
      or permit is null or permit is distinct from new.raw_user_meta_data->>'member_provisioning_nonce'
      or exists(select 1 from public.life_auth_links where
        (person_id=member.person_id and auth_user_id is not null) or auth_user_id=new.id)
      then raise exception 'MEMBER_PROVISIONING_UNAVAILABLE'; end if;
    delete from life_private.member_auth_permits where person_id=member.person_id;
    insert into public.user_profiles(id,email,name,role)
      select new.id,new.email,p.name,'LEARNER' from public.life_people p where p.id=member.person_id;
    insert into public.life_auth_links(person_id,auth_user_id) values(member.person_id,new.id)
      on conflict(person_id) do update set auth_user_id=excluded.auth_user_id
      where life_auth_links.auth_user_id is null;
    insert into life_private.member_auth_state(user_id,person_id) values(new.id,member.person_id);
    insert into life_private.credential_state(user_id,policy_version,changed_at,pending_txid)
      values(new.id,0,clock_timestamp(),null)
      on conflict(user_id) do update set policy_version=0,changed_at=excluded.changed_at,pending_txid=null;
    select instructor_kind into kind from life_private.account_classifications where person_id=member.person_id;
    if member.member_group='instructor' and kind='INTERNAL' and not exists(
      select 1 from public.life_role_assignments where person_id=member.person_id and org_id=member.org_id
      and role='INSTRUCTOR' and valid_from<=now() and (valid_until is null or valid_until>now())) then
      insert into public.life_role_assignments(person_id,org_id,role) values(member.person_id,member.org_id,'INSTRUCTOR');
    end if;
    insert into public.life_audit_events(org_id,actor_id,action,entity_id)
      values(member.org_id,member.person_id,'MEMBER_AUTH_PROVISIONED',member.person_id);
    return new;
  end if;
  if member.person_id is not null and new.invited_at is null then
    raise exception 'MEMBER_PROVISIONING_REQUIRED';
  end if;
  select * into v from public.life_policy_versions where id=(new.raw_user_meta_data->>'privacy_policy_id')::uuid;
  if v.id is null or not life_private.policy_valid(v.id,v.org_id,'ACCOUNT_PRIVACY')
    or coalesce(new.raw_user_meta_data->>'privacy_accepted','false')<>'true' then
    raise exception 'APPROVED_ACCOUNT_PRIVACY_REQUIRED';
  end if;
  if new.invited_at is null then
    if life_private.signup_policy() is null or v.id is distinct from life_private.signup_policy() then
      raise exception 'PUBLIC_SIGNUP_CLOSED_OR_POLICY_CHANGED';
    end if;
    if n is null or length(n) not between 1 and 100 or mobile is null
      or mobile !~ '^\+82(10[0-9]{8}|1[16789][0-9]{7,8})$' then raise exception 'INVALID_SIGNUP_INPUT'; end if;
  end if;
  if member.person_id is not null then
    if exists(select 1 from public.life_auth_links where person_id=member.person_id) then raise exception 'MEMBER_ALREADY_LINKED'; end if;
    insert into life_private.manual_member_claims(user_id,person_id,policy_id,phone)
      values(new.id,member.person_id,v.id,case when new.invited_at is null then mobile end);
    perform life_private.link_verified_manual_member(new.id);
    return new;
  end if;
  if new.raw_user_meta_data->>'member_audience' in ('office','internal') then raise exception 'MEMBER_ACTIVATION_UNAVAILABLE'; end if;
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

create function life_private.member_consent_complete() returns boolean
language sql stable security definer set search_path='' as $$
  select not exists(select 1 from life_private.member_auth_state where user_id=auth.uid())
  or exists(select 1 from public.life_auth_links a join public.life_consent_events c on c.person_id=a.person_id
    where a.auth_user_id=auth.uid() and c.accepted and c.source='MEMBER_FIRST_PASSWORD')
$$;
revoke all on function life_private.member_consent_complete() from public,anon,authenticated,service_role;

create function public.life_member_setup_required() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from life_private.member_auth_state where user_id=auth.uid())
$$;
revoke all on function public.life_member_setup_required() from public,anon,authenticated,service_role;
grant execute on function public.life_member_setup_required() to authenticated;

create function life_private.accept_member_privacy(p_policy uuid) returns void
language plpgsql security definer set search_path='' as $$
declare member_id uuid; member_org uuid; member_email text; user_email text;
begin
  if auth.uid() is null or not life_private.native_session_valid() or not exists(
    select 1 from life_private.member_auth_state where user_id=auth.uid())
    then raise exception 'MEMBER_SETUP_REQUIRED'; end if;
  select m.person_id,m.org_id,m.email,u.email into member_id,member_org,member_email,user_email from life_private.manual_members m
    join public.life_auth_links a on a.person_id=m.person_id
    join auth.users u on u.id=a.auth_user_id
    where a.auth_user_id=auth.uid() for update of m;
  if member_id is null or lower(user_email) is distinct from member_email
    or p_policy is distinct from life_private.member_activation_policy()
    or not life_private.policy_valid(p_policy,member_org,'ACCOUNT_PRIVACY')
    then raise exception 'MEMBER_POLICY_CHANGED'; end if;
  if not exists(select 1 from public.life_consent_events where person_id=member_id
    and policy_id=p_policy and accepted and source='MEMBER_FIRST_PASSWORD') then
    insert into public.life_consent_events(person_id,policy_id,accepted,source)
      values(member_id,p_policy,true,'MEMBER_FIRST_PASSWORD');
  end if;
end $$;
create function public.life_accept_member_privacy(p_policy uuid) returns void
language sql security invoker set search_path='' as $$
  select life_private.accept_member_privacy(p_policy)
$$;
revoke all on function life_private.accept_member_privacy(uuid),public.life_accept_member_privacy(uuid)
  from public,anon,authenticated,service_role;
grant execute on function life_private.accept_member_privacy(uuid),public.life_accept_member_privacy(uuid)
  to authenticated;

-- Keep role, account, password and actual-session checks; pause TOTP gating.
create or replace function life_private.mfa_required() returns boolean
language sql stable security definer set search_path='' as $$select false$$;
create or replace function life_private.mfa_verified() returns boolean
language sql stable security definer set search_path='' as $$
  with status as materialized (select life_private.auth_status() value)
  select coalesce((value->>'active')::boolean,false)
     and not coalesce((value->>'needs_reset')::boolean,true)
     and life_private.member_consent_complete() from status
$$;
create or replace function life_private.mfa_recent() returns boolean
language sql stable security definer set search_path='' as $$select life_private.mfa_verified()$$;
create or replace function life_private.security_status() returns jsonb
language sql stable security definer set search_path='' as $$
  select life_private.auth_status() || jsonb_build_object(
    'staff_required',false,'mfa_required',false,
    'mfa_verified',false,'recent',false,'fresh_minutes',0)
$$;
create or replace function life_private.person_id() returns uuid
language sql stable security definer set search_path='' as $$
  with status as materialized (select life_private.auth_status() value)
  select a.person_id from public.life_auth_links a cross join status s
  where a.auth_user_id=auth.uid() and (s.value->>'active')::boolean
    and not (s.value->>'needs_reset')::boolean
    and life_private.member_consent_complete()
    and ((not life_private.mfa_required() and coalesce(auth.jwt()->>'aal','aal1')<>'aal2') or life_private.mfa_verified())
$$;
create or replace function public.life_prepare_mfa_change(k text,f uuid default null) returns text
language plpgsql security definer set search_path='' as $$
begin
  raise exception 'MFA_DISABLED' using errcode='42501';
end $$;

commit;
