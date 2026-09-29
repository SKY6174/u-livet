begin;

-- An admin invitation reserves an Auth identity without recording consent.
alter table life_private.manual_member_claims alter column policy_id drop not null;

create or replace function life_private.link_verified_manual_member(p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
declare u auth.users; claim life_private.manual_member_claims; member life_private.manual_members; person public.life_people;
begin
  select * into u from auth.users where id=p_user for update;
  if u.id is null or u.email_confirmed_at is null or u.deleted_at is not null
    or (u.banned_until is not null and u.banned_until>now())
    or coalesce(u.raw_app_meta_data->>'provider','email')<>'email' then return; end if;
  select * into claim from life_private.manual_member_claims where user_id=p_user for update;
  if not found or claim.verified_at is not null or claim.policy_id is null then return; end if;
  select * into member from life_private.manual_members where person_id=claim.person_id for update;
  select * into person from public.life_people where id=claim.person_id for update;
  if member.person_id is null or person.active is distinct from true
    or lower(u.email) is distinct from member.email
    or not life_private.policy_valid(claim.policy_id,member.org_id,'ACCOUNT_PRIVACY')
    or exists(select 1 from public.life_auth_links where person_id=claim.person_id or auth_user_id=p_user)
    then return; end if;
  insert into public.user_profiles(id,email,name,role) values(u.id,u.email,person.name,'LEARNER');
  insert into public.life_auth_links(person_id,auth_user_id) values(person.id,u.id);
  insert into public.life_consent_events(person_id,policy_id,accepted,source)
    values(person.id,claim.policy_id,true,'MANUAL_MEMBER_EMAIL_VERIFIED');
  if claim.phone is not null then
    insert into life_private.learner_contacts(user_id,phone,signup_source,policy_id)
      values(u.id,claim.phone,'EMAIL',claim.policy_id);
  end if;
  if member.member_group='instructor' and not exists(select 1 from public.life_role_assignments
    where person_id=person.id and org_id=member.org_id and role='INSTRUCTOR'
      and valid_from<=now() and (valid_until is null or valid_until>now())) then
    insert into public.life_role_assignments(person_id,org_id,role) values(person.id,member.org_id,'INSTRUCTOR');
  end if;
  update life_private.manual_member_claims set verified_at=now() where user_id=u.id;
  insert into public.life_audit_events(org_id,actor_id,action,entity_id)
    values(member.org_id,person.id,'MANUAL_MEMBER_AUTH_LINKED',person.id);
end $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path='' as $$
declare p uuid; v public.life_policy_versions; n text:=trim(new.raw_user_meta_data->>'name');
  member life_private.manual_members; mobile text:=new.raw_user_meta_data->>'mobile_phone';
  stored_phone text;
begin
  if new.raw_app_meta_data->>'provider' in ('kakao','google','custom:naver') then
    if life_private.signup_policy() is null then raise exception 'PUBLIC_SIGNUP_CLOSED'; end if;
    return new;
  end if;
  -- The existing, administrator-owned roster is the only invitation target.
  perform pg_advisory_xact_lock(hashtextextended(lower(new.email),420));
  select m.* into member from life_private.manual_members m
    join public.life_people p on p.id=m.person_id and p.active
    where m.email=lower(new.email) for update of m;
  if member.person_id is not null and exists(
    select 1 from public.life_auth_links where person_id=member.person_id) then
    raise exception 'MEMBER_ALREADY_LINKED';
  end if;
  if new.invited_at is not null and member.person_id is not null then
    select mobile_phone into stored_phone from life_private.member_profiles where person_id=member.person_id;
    insert into life_private.manual_member_claims(user_id,person_id,policy_id,phone)
      values(new.id,member.person_id,null,stored_phone);
    return new;
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
    if v.org_id is distinct from member.org_id then raise exception 'APPROVED_ACCOUNT_PRIVACY_REQUIRED'; end if;
    if new.raw_user_meta_data->>'member_audience' in ('office','internal')
      and new.raw_user_meta_data->>'member_audience'<>
        (case when member.member_group='office' then 'office' when member.member_group='instructor' then 'internal' else 'learner' end)
      then raise exception 'MEMBER_ACTIVATION_UNAVAILABLE'; end if;
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

create function life_private.accept_manual_member_invitation(p_policy uuid,p_accepted boolean) returns void
language plpgsql security definer set search_path='' as $$
declare u auth.users; claim life_private.manual_member_claims; member life_private.manual_members;
begin
  if p_accepted is distinct from true or p_policy is null then raise exception 'PRIVACY_CONSENT_REQUIRED'; end if;
  select * into u from auth.users where id=auth.uid() for update;
  if u.id is null or u.invited_at is null or u.email_confirmed_at is null
    or u.deleted_at is not null or (u.banned_until is not null and u.banned_until>now())
    or not exists(select 1 from auth.sessions s where s.id::text=auth.jwt()->>'session_id'
      and s.user_id=u.id and (s.not_after is null or s.not_after>now()))
    then raise exception 'INVALID_INVITATION'; end if;
  select * into claim from life_private.manual_member_claims where user_id=u.id for update;
  if not found or claim.verified_at is not null or claim.policy_id is not null then
    raise exception 'INVALID_INVITATION'; end if;
  select * into member from life_private.manual_members where person_id=claim.person_id for update;
  if member.person_id is null or member.email is distinct from lower(u.email)
    or not life_private.policy_valid(p_policy,member.org_id,'ACCOUNT_PRIVACY')
    then raise exception 'APPROVED_ACCOUNT_PRIVACY_REQUIRED'; end if;
  update life_private.manual_member_claims set policy_id=p_policy where user_id=u.id;
  perform life_private.link_verified_manual_member(u.id);
  if not exists(select 1 from public.life_auth_links where person_id=member.person_id and auth_user_id=u.id)
    then raise exception 'MEMBER_ACTIVATION_UNAVAILABLE'; end if;
end $$;
create function public.life_accept_manual_member_invitation(p_policy uuid,p_accepted boolean) returns void
language sql security invoker set search_path='' as $$
  select life_private.accept_manual_member_invitation(p_policy,p_accepted)
$$;
revoke all on function life_private.accept_manual_member_invitation(uuid,boolean),
  public.life_accept_manual_member_invitation(uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function life_private.accept_manual_member_invitation(uuid,boolean),
  public.life_accept_manual_member_invitation(uuid,boolean) to authenticated;

-- Return only new roster targets. Retried request IDs resolve to the same person.
create or replace function life_private.member_excel_import(p_group text,p_org uuid,p_rows jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare row_data jsonb; row_number integer:=0; created integer:=0; updated integer:=0;
  target uuid; current_email text; created_members jsonb:='[]'::jsonb;
begin
  if life_private.person_id() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not life_private.mfa_recent() then raise exception 'MFA_REAUTH_REQUIRED'; end if;
  if p_group is null or p_group not in ('office','instructor','learner') or p_rows is null
    or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 100 then raise exception 'INVALID_INPUT'; end if;
  for row_data in select value from jsonb_array_elements(p_rows) loop
    row_number:=row_number+1;
    begin
      if jsonb_typeof(row_data)<>'object' then raise exception 'INVALID_INPUT'; end if;
      if nullif(row_data->>'person_id','') is null then
        target:=life_private.create_member((row_data->>'request_id')::uuid,p_org,p_group,row_data->>'name',row_data->>'email',
          nullif(row_data->>'position',''),nullif(row_data->>'kind',''),nullif(row_data->>'office_phone',''),nullif(row_data->>'mobile_phone',''),
          nullif(row_data->>'instructor_phone',''),nullif(row_data->>'birth_date','')::date,coalesce(row_data->>'notes',''));
        created_members:=created_members||jsonb_build_array(jsonb_build_object('person_id',target,'email',lower(row_data->>'email'),'row',row_number+1));
        created:=created+1;
      else
        target:=(row_data->>'person_id')::uuid;
        select lower(coalesce(u.email,mm.email)) into current_email from public.life_people p
          left join public.life_auth_links a on a.person_id=p.id left join auth.users u on u.id=a.auth_user_id
          left join life_private.manual_members mm on mm.person_id=p.id where p.id=target and p.active;
        if nullif(row_data->>'email','') is not null and lower(row_data->>'email') is distinct from current_email then raise exception 'MEMBER_EMAIL_MISMATCH'; end if;
        perform life_private.save_member(target,p_group,row_data->>'name',nullif(row_data->>'position',''),nullif(row_data->>'kind',''),
          nullif(row_data->>'office_phone',''),nullif(row_data->>'mobile_phone',''),nullif(row_data->>'instructor_phone',''),
          nullif(row_data->>'birth_date','')::date,coalesce(row_data->>'notes',''),(row_data->>'revision')::integer);
        updated:=updated+1;
      end if;
    exception when others then
      raise exception 'ROW_%: %',row_number,sqlerrm;
    end;
  end loop;
  return jsonb_build_object('created',created,'updated',updated,'created_members',created_members);
end $$;

notify pgrst,'reload schema';
commit;
