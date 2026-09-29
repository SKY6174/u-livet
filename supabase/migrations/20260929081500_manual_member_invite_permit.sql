begin;

create table life_private.manual_member_invite_permits (
  person_id uuid primary key references life_private.manual_members(person_id) on delete cascade,
  nonce text not null check(nonce ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null
);
alter table life_private.manual_member_invite_permits enable row level security;
revoke all on life_private.manual_member_invite_permits from public,anon,authenticated,service_role;

create function public.life_prepare_manual_member_invite(p_person uuid,p_nonce text) returns void
language plpgsql security definer set search_path='' as $$
declare member life_private.manual_members;
begin
  if p_nonce !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_INVITATION_NONCE'; end if;
  select m.* into member from life_private.manual_members m
    join public.life_people p on p.id=m.person_id and p.active
    where m.person_id=p_person for update of m;
  if member.person_id is null or exists(select 1 from public.life_auth_links
    where person_id=p_person and auth_user_id is not null)
    then raise exception 'MANUAL_INVITATION_UNAVAILABLE'; end if;
  insert into life_private.manual_member_invite_permits(person_id,nonce,expires_at)
    values(p_person,p_nonce,now()+interval '5 minutes')
    on conflict(person_id) do update set nonce=excluded.nonce,expires_at=excluded.expires_at;
end $$;
revoke all on function public.life_prepare_manual_member_invite(uuid,text)
  from public,anon,authenticated,service_role;
grant execute on function public.life_prepare_manual_member_invite(uuid,text) to service_role;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path='' as $$
declare p uuid; v public.life_policy_versions; n text:=trim(new.raw_user_meta_data->>'name');
  member life_private.manual_members;
  mobile text:=new.raw_user_meta_data->>'mobile_phone';
  kind text; permit text; invite_permit text;
begin
  if new.raw_app_meta_data->>'provider' in ('kakao','google','custom:naver') then
    if life_private.signup_policy() is null then raise exception 'PUBLIC_SIGNUP_CLOSED'; end if;
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(lower(new.email),420));
  select m.* into member from life_private.manual_members m
    join public.life_people p on p.id=m.person_id and p.active
    left join life_private.account_classifications c on c.person_id=m.person_id
    where m.email=lower(new.email) for update of m;
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
  -- The server-issued nonce is consumed by this initial Auth INSERT.
  if new.raw_user_meta_data ? 'manual_member_invitation_nonce' or
    new.raw_user_meta_data->>'manual_member_invitation'='true' then
    select nonce into invite_permit from life_private.manual_member_invite_permits
      where person_id=member.person_id and expires_at>now() for update;
    if member.person_id is null or
      new.raw_user_meta_data->>'member_org_id' is distinct from member.org_id::text or
      coalesce(new.raw_user_meta_data->>'manual_member_invitation_nonce','') !~ '^[a-f0-9]{64}$' or
      invite_permit is null or
      invite_permit is distinct from new.raw_user_meta_data->>'manual_member_invitation_nonce' or
      exists(select 1 from public.life_auth_links where person_id=member.person_id)
      then raise exception 'MANUAL_INVITATION_UNAVAILABLE'; end if;
    delete from life_private.manual_member_invite_permits where person_id=member.person_id;
    insert into life_private.manual_member_claims(user_id,person_id,policy_id,phone)
      values(new.id,member.person_id,null,
        (select mobile_phone from life_private.member_profiles where person_id=member.person_id));
    return new;
  end if;
  if member.person_id is not null and new.invited_at is null and
    (member.member_group='office' or
      (member.member_group='instructor' and exists(select 1 from life_private.account_classifications
        where person_id=member.person_id and instructor_kind='INTERNAL'))) then
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

notify pgrst,'reload schema';
commit;
