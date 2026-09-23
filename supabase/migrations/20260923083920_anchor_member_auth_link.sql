begin;
-- Display positions never imply administrative permissions.
alter table life_private.account_classifications drop constraint account_classifications_office_position_check;
alter table life_private.account_classifications add constraint account_classifications_office_position_check
  check(office_position in ('DIRECTOR','DIVISION_HEAD','CENTER_HEAD','OPERATIONS_HEAD','PRINCIPAL_RESEARCHER','SENIOR_RESEARCHER','RESEARCHER'));

-- Trusted signup snapshot, inaccessible through the Data API. No auth link exists
-- until the native email provider confirms ownership of the registered address.
create table life_private.manual_member_claims (
  user_id uuid primary key references auth.users(id) on delete cascade,
  person_id uuid not null references public.life_people(id),
  policy_id uuid not null references public.life_policy_versions(id),
  phone text check(phone ~ '^\+82(10[0-9]{8}|1[16789][0-9]{7,8})$'),
  created_at timestamptz not null default now(),
  verified_at timestamptz
);
create index manual_member_claim_person on life_private.manual_member_claims(person_id);
create index manual_member_claim_policy on life_private.manual_member_claims(policy_id);
alter table life_private.manual_member_claims enable row level security;
revoke all on life_private.manual_member_claims from public,anon,authenticated,service_role;

create function life_private.link_verified_manual_member(p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
declare u auth.users; claim life_private.manual_member_claims; member life_private.manual_members; person public.life_people; kind text;
begin
  select * into u from auth.users where id=p_user for update;
  if u.id is null or u.email_confirmed_at is null or u.deleted_at is not null
    or (u.banned_until is not null and u.banned_until>now())
    or coalesce(u.raw_app_meta_data->>'provider','email')<>'email' then return; end if;
  select * into claim from life_private.manual_member_claims where user_id=p_user for update;
  if not found or claim.verified_at is not null then return; end if;
  select * into member from life_private.manual_members where person_id=claim.person_id for update;
  select * into person from public.life_people where id=claim.person_id for update;
  select instructor_kind into kind from life_private.account_classifications where person_id=claim.person_id;
  if member.person_id is null or person.active is distinct from true or lower(u.email) is distinct from member.email
    or not (member.member_group='office' or (member.member_group='instructor' and kind='INTERNAL' and member.email ~ '^[^@[:space:]]+@uc\.ac\.kr$'))
    or exists(select 1 from public.life_auth_links where person_id=claim.person_id or auth_user_id=p_user)
    then return; end if;
  insert into public.user_profiles(id,email,name,role) values(u.id,u.email,person.name,'LEARNER');
  insert into public.life_auth_links(person_id,auth_user_id) values(person.id,u.id);
  insert into public.life_consent_events(person_id,policy_id,accepted,source) values(person.id,claim.policy_id,true,'MANUAL_MEMBER_EMAIL_VERIFIED');
  if claim.phone is not null then
    insert into life_private.learner_contacts(user_id,phone,signup_source,policy_id) values(u.id,claim.phone,'EMAIL',claim.policy_id);
  end if;
  if member.member_group='instructor' and not exists(select 1 from public.life_role_assignments
    where person_id=person.id and org_id=member.org_id and role='INSTRUCTOR' and valid_from<=now() and (valid_until is null or valid_until>now())) then
    insert into public.life_role_assignments(person_id,org_id,role) values(person.id,member.org_id,'INSTRUCTOR');
  end if;
  update life_private.manual_member_claims set verified_at=now() where user_id=u.id;
  insert into public.life_audit_events(org_id,actor_id,action,entity_id) values(member.org_id,person.id,'MANUAL_MEMBER_AUTH_LINKED',person.id);
end $$;
revoke all on function life_private.link_verified_manual_member(uuid) from public,anon,authenticated,service_role;

create function life_private.confirm_manual_member() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform life_private.link_verified_manual_member(new.id);
  return new;
end $$;
revoke all on function life_private.confirm_manual_member() from public,anon,authenticated,service_role;
create trigger life_confirm_manual_member after update of email_confirmed_at on auth.users
for each row when (new.email_confirmed_at is not null) execute function life_private.confirm_manual_member();


create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path='' as $$
declare p uuid; v public.life_policy_versions; n text:=trim(new.raw_user_meta_data->>'name');
  member life_private.manual_members;
  mobile text:=new.raw_user_meta_data->>'mobile_phone';
begin
  if new.raw_app_meta_data->>'provider' in ('kakao','google','custom:naver') then
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
  -- Read only administrator-owned membership/classification; never trust a
  -- submitted person ID, position or role. Serialize with manual registration.
  perform pg_advisory_xact_lock(hashtextextended(lower(new.email),420));
  select m.* into member from life_private.manual_members m
    join public.life_people p on p.id=m.person_id and p.active
    left join life_private.account_classifications c on c.person_id=m.person_id
    where m.email=lower(new.email) and (m.member_group='office' or
      (m.member_group='instructor' and c.instructor_kind='INTERNAL' and m.email ~ '^[^@[:space:]]+@uc\.ac\.kr$')) for update of m;
  if member.person_id is not null then
    if exists(select 1 from public.life_auth_links where person_id=member.person_id) then raise exception 'MEMBER_ALREADY_LINKED'; end if;
    if new.raw_user_meta_data->>'member_audience' in ('office','internal')
      and new.raw_user_meta_data->>'member_audience'<>(case when member.member_group='office' then 'office' else 'internal' end)
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

create or replace function life_private.create_member(p_request uuid,p_org uuid,p_group text,p_name text,p_email text,p_position text,p_kind text,p_office_phone text,p_mobile_phone text,p_instructor_phone text,p_birth_date date,p_notes text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=life_private.person_id(); target uuid; existing life_private.manual_members; normalized_email text:=lower(trim(p_email)); fingerprint text:=md5(jsonb_build_array(p_org,p_group,trim(p_name),lower(trim(p_email)),p_position,p_kind,p_office_phone,p_mobile_phone,p_instructor_phone,p_birth_date,p_notes)::text);
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from life_private.member_entry_orgs() where org_id=p_org) then raise exception 'MEMBER_ENTRY_FORBIDDEN'; end if;
  if not life_private.mfa_recent() then raise exception 'MFA_REAUTH_REQUIRED'; end if;
  if p_request is null or p_group is null or p_group not in ('office','instructor','learner')
    or p_name is null or length(trim(p_name)) not between 1 and 100 or p_notes is null or length(p_notes)>2000
    or normalized_email is null or length(normalized_email)>254 or normalized_email !~ '^[^@[:space:]]+@[^@[:space:].]+(\.[^@[:space:].]+)+$'
    or (p_office_phone is not null and p_office_phone !~ '^0[0-9]{8,10}$')
    or (p_mobile_phone is not null and p_mobile_phone !~ '^\+82(10[0-9]{8}|1[16789][0-9]{7,8})$')
    or (p_instructor_phone is not null and p_instructor_phone !~ '^0[0-9]{8,10}$')
    or (p_birth_date is not null and (p_birth_date<date '1900-01-01' or p_birth_date>current_date))
    or (p_group='office' and p_position is not null and p_position not in ('DIRECTOR','DIVISION_HEAD','CENTER_HEAD','OPERATIONS_HEAD','PRINCIPAL_RESEARCHER','SENIOR_RESEARCHER','RESEARCHER'))
    or (p_group='instructor' and (p_kind is null or p_kind not in ('INTERNAL','EXTERNAL'))) then raise exception 'INVALID_INPUT'; end if;
  if p_group='instructor' and p_kind='INTERNAL' and normalized_email !~ '^[^@[:space:]]+@uc\.ac\.kr$' then raise exception 'SCHOOL_EMAIL_REQUIRED'; end if;
  -- Serialize retries first, then email collisions across sessions.
  perform pg_advisory_xact_lock(hashtextextended(p_request::text,419));
  select * into existing from life_private.manual_members where request_id=p_request;
  if found then
    if existing.created_by<>actor or existing.org_id<>p_org or existing.member_group<>p_group or existing.email<>normalized_email or existing.request_fingerprint<>fingerprint or not exists(select 1 from public.life_people where id=existing.person_id and active) then raise exception 'REQUEST_CONFLICT'; end if;
    return existing.person_id;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(normalized_email,420));
  if exists(select 1 from life_private.manual_members where email=normalized_email)
     or exists(select 1 from auth.users where lower(email)=normalized_email) then raise exception 'MEMBER_EMAIL_EXISTS'; end if;
  insert into public.life_people(name) values(trim(p_name)) returning id into target;
  insert into life_private.manual_members(person_id,org_id,member_group,email,request_id,request_fingerprint,created_by)
    values(target,p_org,p_group,normalized_email,p_request,fingerprint,actor);
  insert into life_private.member_profiles(person_id,office_phone,mobile_phone,instructor_phone,birth_date,notes,updated_by)
    values(target,case when p_group='office' then p_office_phone end,case when p_group in ('office','learner') then p_mobile_phone end,
      case when p_group='instructor' then p_instructor_phone end,case when p_group='learner' then p_birth_date end,p_notes,actor);
  if p_group in ('office','instructor') then
    insert into life_private.account_classifications(person_id,office_position,instructor_kind,updated_by)
    values(target,case when p_group='office' then p_position end,case when p_group='instructor' then p_kind end,actor);
  end if;
  insert into public.life_audit_events(org_id,actor_id,action,entity_id) values(p_org,actor,'MEMBER_CREATED',target);
  return target;
end $$;

create or replace function life_private.save_member(p_person uuid,p_group text,p_name text,p_position text,p_kind text,p_office_phone text,p_mobile_phone text,p_instructor_phone text,p_birth_date date,p_notes text,p_revision integer) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=life_private.person_id(); s record; m life_private.member_profiles; c life_private.account_classifications; linked_user uuid; existing_phone text;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if not life_private.mfa_recent() then raise exception 'MFA_REAUTH_REQUIRED'; end if;
  perform 1 from public.life_people where id=p_person and active for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into s from life_private.member_scope() where person_id=p_person;
  if not found then raise exception 'FORBIDDEN'; end if;
  if p_group is null or not (case p_group when 'office' then s.is_office when 'instructor' then s.is_instructor when 'learner' then s.is_learner else false end) then raise exception 'INVALID_INPUT'; end if;
  select * into m from life_private.member_profiles where person_id=p_person;
  if p_revision is distinct from coalesce(m.revision,0) then raise exception 'REVISION_CONFLICT'; end if;
  if p_name is null or length(trim(p_name)) not between 1 and 100 or p_notes is null or length(p_notes)>2000
    or (p_office_phone is not null and p_office_phone !~ '^0[0-9]{8,10}$')
    or (p_mobile_phone is not null and p_mobile_phone !~ '^\+82(10[0-9]{8}|1[16789][0-9]{7,8})$')
    or (p_instructor_phone is not null and p_instructor_phone !~ '^0[0-9]{8,10}$')
    or (p_birth_date is not null and (p_birth_date<date '1900-01-01' or p_birth_date>current_date)) then raise exception 'INVALID_INPUT'; end if;
  select * into c from life_private.account_classifications where person_id=p_person;
  select auth_user_id into linked_user from public.life_auth_links where person_id=p_person;
  select phone into existing_phone from life_private.learner_contacts where user_id=linked_user;
  if p_group in ('office','learner') and p_mobile_phone is null and existing_phone is not null then raise exception 'MOBILE_REQUIRED'; end if;
  if p_group='office' and p_position is not null and p_position not in ('DIRECTOR','DIVISION_HEAD','CENTER_HEAD','OPERATIONS_HEAD','PRINCIPAL_RESEARCHER','SENIOR_RESEARCHER','RESEARCHER') then raise exception 'INVALID_INPUT'; end if;
  if p_group='instructor' then
    if p_kind='INTERNAL' and exists(select 1 from life_private.manual_members where person_id=p_person and email !~ '^[^@[:space:]]+@uc\.ac\.kr$') then raise exception 'SCHOOL_EMAIL_REQUIRED'; end if;
    if p_kind is null or p_kind not in ('INTERNAL','EXTERNAL') then raise exception 'INVALID_INPUT'; end if;
    if p_kind='INTERNAL' and not exists(select 1 from life_private.manual_members where person_id=p_person and linked_user is null) and not exists(select 1 from auth.users where id=linked_user and email_confirmed_at is not null and lower(email) ~ '^[^@[:space:]]+@uc\.ac\.kr$') then raise exception 'SCHOOL_EMAIL_REQUIRED'; end if;
  end if;
  update public.life_people set name=trim(p_name) where id=p_person;
  update public.user_profiles set name=trim(p_name) where id=linked_user;
  if p_group in ('office','instructor') then
    insert into life_private.account_classifications(person_id,office_position,instructor_kind,updated_by)
    values(p_person,case when p_group='office' then p_position else c.office_position end,case when p_group='instructor' then p_kind else c.instructor_kind end,actor)
    on conflict(person_id) do update set office_position=excluded.office_position,instructor_kind=excluded.instructor_kind,updated_at=now(),updated_by=actor;
  end if;
  insert into life_private.member_profiles(person_id,office_phone,mobile_phone,instructor_phone,birth_date,notes,revision,updated_by)
  values(p_person,case when p_group='office' then p_office_phone else m.office_phone end,
    case when p_group in ('office','learner') then p_mobile_phone else coalesce(m.mobile_phone,existing_phone) end,
    case when p_group='instructor' then p_instructor_phone else m.instructor_phone end,
    case when p_group='learner' then p_birth_date else m.birth_date end,p_notes,coalesce(m.revision,0)+1,actor)
  on conflict(person_id) do update set office_phone=excluded.office_phone,mobile_phone=excluded.mobile_phone,instructor_phone=excluded.instructor_phone,birth_date=excluded.birth_date,notes=excluded.notes,revision=excluded.revision,updated_at=now(),updated_by=actor;
  if p_group in ('office','learner') and existing_phone is not null then
    update life_private.learner_contacts set phone=p_mobile_phone,phone_verified_at=null where user_id=linked_user;
  end if;
  insert into public.life_audit_events(org_id,actor_id,action,entity_id)
    select org_id,actor,'MEMBER_UPDATED',p_person from life_private.member_affiliations() where person_id=p_person;
end $$;

create or replace function life_private.set_account_classification(p_person uuid,p_position text,p_kind text) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=life_private.person_id(); office boolean; instructor boolean; target_email text; email_verified boolean;
begin
 if actor is null or auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if not life_private.mfa_recent() then raise exception 'MFA_REAUTH_REQUIRED'; end if;
 perform 1 from public.life_people where id=p_person and active for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if not exists(select 1 from public.life_role_assignments r where r.person_id=p_person and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now()))
 or exists(select 1 from public.life_role_assignments r where r.person_id=p_person and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now()) and not life_private.has_role(r.org_id,'SYSTEM_ADMIN')) then raise exception 'FORBIDDEN'; end if;
 select bool_or(r.role<>'INSTRUCTOR'),bool_or(r.role='INSTRUCTOR') into office,instructor from public.life_role_assignments r where r.person_id=p_person and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now());
 if (p_position is not null and (p_position not in ('DIRECTOR','DIVISION_HEAD','CENTER_HEAD','OPERATIONS_HEAD','PRINCIPAL_RESEARCHER','SENIOR_RESEARCHER','RESEARCHER') or not office))
 or (p_kind is not null and (p_kind not in ('INTERNAL','EXTERNAL') or not instructor))
 or (instructor and p_kind is null) then raise exception 'INVALID_CLASSIFICATION'; end if;
 select u.email,u.email_confirmed_at is not null into target_email,email_verified from auth.users u join public.life_auth_links a on a.auth_user_id=u.id where a.person_id=p_person;
 if p_kind='INTERNAL' and (email_verified is distinct from true or coalesce(lower(target_email) ~ '^[^@[:space:]]+@uc\.ac\.kr$',false) is not true) then raise exception 'SCHOOL_EMAIL_REQUIRED'; end if;
 insert into life_private.account_classifications(person_id,office_position,instructor_kind,updated_by)
 values(p_person,p_position,p_kind,actor) on conflict(person_id) do update set office_position=excluded.office_position,instructor_kind=excluded.instructor_kind,updated_at=now(),updated_by=actor;
 insert into public.life_audit_events(org_id,actor_id,action,entity_id)
 select distinct r.org_id,actor,'ACCOUNT_CLASSIFICATION_UPDATED',p_person from public.life_role_assignments r where r.person_id=p_person and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now());
end $$;

create or replace function life_private.login_context() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('audience',case
    when exists(select 1 from life_private.manual_members m where m.person_id=p.id and m.member_group='office') then 'office'
    when exists(select 1 from life_private.member_entry_operators e where e.auth_user_id=auth.uid()) then 'office'
    when exists(select 1 from public.life_role_assignments r where r.person_id=p.id and r.role<>'INSTRUCTOR' and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())) then 'office'
    when exists(select 1 from public.life_role_assignments r where r.person_id=p.id and r.role='INSTRUCTOR' and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now()))
      then case when c.instructor_kind='EXTERNAL' then 'external' else 'internal' end
    else 'learner' end,
    'office_position',c.office_position,'instructor_kind',c.instructor_kind,
    'roles',coalesce((select jsonb_agg(distinct r.role) from public.life_role_assignments r where r.person_id=p.id and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())),'[]'::jsonb))
  from public.life_auth_links a join public.life_people p on p.id=a.person_id
  left join life_private.account_classifications c on c.person_id=p.id
  where a.auth_user_id=auth.uid() and p.active and life_private.native_session_valid()
$$;

create or replace function life_private.staff_mfa_required() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from life_private.manual_members m join public.life_auth_links a on a.person_id=m.person_id where a.auth_user_id=auth.uid() and m.member_group='office')
 or exists(select 1 from life_private.member_entry_operators e where e.auth_user_id=auth.uid())
 or exists(select 1 from public.life_auth_links a join public.life_role_assignments r on r.person_id=a.person_id
 where a.auth_user_id=auth.uid() and r.role<>'INSTRUCTOR' and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now()))
$$;

create or replace function life_private.kakao_learner_session() returns boolean
language sql stable security definer set search_path='' as $$
  select life_private.oauth_session()
  and not exists(select 1 from life_private.manual_members m join public.life_auth_links a on a.person_id=m.person_id left join life_private.account_classifications c on c.person_id=m.person_id
    where a.auth_user_id=auth.uid() and (m.member_group='office' or (m.member_group='instructor' and c.instructor_kind='INTERNAL')))
  and not exists(select 1 from life_private.member_entry_operators e where e.auth_user_id=auth.uid())
  and exists(select 1 from auth.identities i where i.user_id=auth.uid() and i.provider in ('kakao','google','custom:naver'))
  and not exists(select 1 from public.life_auth_links a join public.life_role_assignments r on r.person_id=a.person_id
    left join life_private.account_classifications c on c.person_id=a.person_id
    where a.auth_user_id=auth.uid() and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())
    and (r.role<>'INSTRUCTOR' or c.instructor_kind is distinct from 'EXTERNAL'))
$$;

create or replace function life_private.identity() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',p.id,'name',p.name,'office_position',c.office_position,'instructor_kind',c.instructor_kind,
 'member_group',(select m.member_group from life_private.manual_members m where m.person_id=p.id and m.member_group in ('office','instructor')),
 'member_entry_orgs',coalesce((select jsonb_agg(to_jsonb(e) order by e.org_name,e.org_id) from life_private.member_entry_orgs() e),'[]'::jsonb),
 'is_super_admin',exists(select 1 from life_private.member_entry_orgs() where is_super_admin),
 'roles',coalesce((select jsonb_agg(jsonb_build_object('role',r.role,'org_id',r.org_id)) from public.life_role_assignments r
 where r.person_id=p.id and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())),'[]'::jsonb))
 from public.life_people p left join life_private.account_classifications c on c.person_id=p.id where p.id=life_private.person_id()
$$;

create or replace function life_private.member_directory(p_group text,p_query text,p_page integer,p_person uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if life_private.person_id() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.life_role_assignments r where r.person_id=life_private.person_id() and r.role='SYSTEM_ADMIN' and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())) and not exists(select 1 from life_private.member_entry_orgs()) then raise exception 'FORBIDDEN'; end if;
  if p_group is null or p_group not in ('office','instructor','learner') or p_page is null or p_page not between 1 and 100000 or p_query is null or length(p_query)>100 then raise exception 'INVALID_INPUT'; end if;
  with scope as materialized (select * from life_private.member_scope_for(false)),
  managed as materialized (select person_id from life_private.member_scope()),
  filtered as materialized (
    select p.id,p.name,coalesce(u.email,mm.email) email,u.id auth_user_id,(mm.person_id is not null and u.id is null) is_manual,(mm.person_id is not null and u.email_confirmed_at is not null) account_verified,s.is_office,s.is_instructor,s.is_learner
    from scope s join public.life_people p on p.id=s.person_id
    left join public.life_auth_links a on a.person_id=p.id left join auth.users u on u.id=a.auth_user_id
    left join life_private.manual_members mm on mm.person_id=p.id
    where (case p_group when 'office' then s.is_office when 'instructor' then s.is_instructor else s.is_learner end)
      and (p_person is null or p.id=p_person)
      and (p_query='' or strpos(lower(p.name),lower(p_query))>0 or strpos(lower(coalesce(u.email,mm.email,'')),lower(p_query))>0)
  ), selected as (
    select * from filtered order by name,id limit 20 offset ((p_page-1)*20)
  ), page as (
    select s.id,s.name,s.email,s.is_manual,s.account_verified,s.is_office,s.is_instructor,s.is_learner,c.office_position,c.instructor_kind,
      m.office_phone,coalesce(m.mobile_phone,lc.phone) mobile_phone,m.instructor_phone,m.birth_date,
      coalesce(m.notes,'') notes,coalesce(m.revision,0) revision,
      exists(select 1 from managed w where w.person_id=s.id) can_manage,
      case when p_group='learner' then coalesce((
        select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name) order by o.starts_on,o.id)
        from public.life_enrollments e join public.life_offerings o on o.id=e.offering_id
        where e.person_id=s.id and e.status='ACTIVE'
          and o.starts_on < (date_trunc('year',timezone('Asia/Seoul',now()))+interval '1 year')::date
          and o.ends_on >= date_trunc('year',timezone('Asia/Seoul',now()))::date
      ),'[]'::jsonb) else '[]'::jsonb end current_courses
    from selected s left join life_private.account_classifications c on c.person_id=s.id
    left join life_private.member_profiles m on m.person_id=s.id
    left join life_private.learner_contacts lc on lc.user_id=s.auth_user_id
  )
  select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(page) order by name,id) from page),'[]'::jsonb),
    'total',(select count(*) from filtered),'page',p_page,'page_size',20,'current_year',extract(year from timezone('Asia/Seoul',now()))::int,
    'counts',jsonb_build_object('office',(select count(*) from scope where is_office),'instructor',(select count(*) from scope where is_instructor),'learner',(select count(*) from scope where is_learner))) into result;
  return result;
end $$;

notify pgrst,'reload schema';
commit;
