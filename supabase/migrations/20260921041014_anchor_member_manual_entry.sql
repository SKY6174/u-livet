begin;

-- Three explicitly designated operators. Unbound slots cannot authorize a request.
create table life_private.member_entry_operators (
  org_id uuid not null references public.life_organizations(id),
  slot text not null check(slot in ('SUPER_ADMIN','OPERATIONS','RESEARCH')),
  designated_name text not null,
  verified_email text unique check(verified_email=lower(trim(verified_email))),
  auth_user_id uuid references auth.users(id),
  primary key(org_id,slot), unique(org_id,auth_user_id)
);
alter table life_private.member_entry_operators enable row level security;
revoke all on life_private.member_entry_operators from public,anon,authenticated,service_role;
create index member_entry_operator_user on life_private.member_entry_operators(auth_user_id);
insert into life_private.member_entry_operators(org_id,slot,designated_name,verified_email,auth_user_id)
select o.id,v.slot,v.name,case v.slot when 'SUPER_ADMIN' then 'kysong@uc.ac.kr' when 'RESEARCH' then 'yhlee4@uc.ac.kr' end,case when v.slot='SUPER_ADMIN' then (
  select u.id from auth.users u join public.life_auth_links a on a.auth_user_id=u.id
  join public.life_people p on p.id=a.person_id
  where lower(u.email)='kysong@uc.ac.kr' and u.email_confirmed_at is not null and u.deleted_at is null and p.active
    and exists(select 1 from public.life_role_assignments r where r.person_id=p.id and r.org_id=o.id and r.role='SYSTEM_ADMIN' and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now()))
) end
from public.life_organizations o cross join (values ('SUPER_ADMIN','송경영'),('OPERATIONS','현용환'),('RESEARCH','이연향')) v(slot,name)
where o.slug='uc-anchor';

-- Bind an approved address once, only after the account proves ownership.
create function life_private.bind_member_entry_operator() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.email_confirmed_at is not null and new.deleted_at is null then
    update life_private.member_entry_operators set auth_user_id=new.id
      where auth_user_id is null and verified_email=lower(new.email);
  end if;
  return new;
end $$;
revoke all on function life_private.bind_member_entry_operator() from public,anon,authenticated,service_role;
create trigger life_bind_member_entry_operator after insert or update of email,email_confirmed_at on auth.users
for each row execute function life_private.bind_member_entry_operator();
update life_private.member_entry_operators e set auth_user_id=u.id from auth.users u
where e.auth_user_id is null and e.verified_email=lower(u.email) and u.email_confirmed_at is not null and u.deleted_at is null;

create table life_private.manual_members (
  person_id uuid primary key references public.life_people(id),
  org_id uuid not null references public.life_organizations(id),
  member_group text not null check(member_group in ('office','instructor','learner')),
  email text not null check(email=lower(trim(email)) and length(email)<=254 and email ~ '^[^@[:space:]]+@[^@[:space:].]+(\.[^@[:space:].]+)+$'),
  request_id uuid not null unique,
  request_fingerprint text not null,
  created_by uuid not null references public.life_people(id),
  created_at timestamptz not null default now(),
  unique(email)
);
alter table life_private.manual_members enable row level security;
revoke all on life_private.manual_members from public,anon,authenticated,service_role;
create index manual_member_org on life_private.manual_members(org_id,member_group);
create index manual_member_creator on life_private.manual_members(created_by);
create index if not exists member_enrollment_person on public.life_enrollments(person_id,offering_id) where status='ACTIVE';

create or replace function life_private.login_context() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('audience',case
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
create or replace function life_private.kakao_learner_session() returns boolean
language sql stable security definer set search_path='' as $$
  select life_private.oauth_session()
  and not exists(select 1 from life_private.member_entry_operators e where e.auth_user_id=auth.uid())
  and exists(select 1 from auth.identities i where i.user_id=auth.uid() and i.provider in ('kakao','google','custom:naver'))
  and not exists(select 1 from public.life_auth_links a join public.life_role_assignments r on r.person_id=a.person_id
    left join life_private.account_classifications c on c.person_id=a.person_id
    where a.auth_user_id=auth.uid() and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())
    and (r.role<>'INSTRUCTOR' or c.instructor_kind is distinct from 'EXTERNAL'))
$$;
create or replace function life_private.staff_mfa_required() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from life_private.member_entry_operators e where e.auth_user_id=auth.uid())
 or exists(select 1 from public.life_auth_links a join public.life_role_assignments r on r.person_id=a.person_id
 where a.auth_user_id=auth.uid() and r.role<>'INSTRUCTOR' and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now()))
$$;

create function life_private.member_entry_orgs() returns table(org_id uuid,org_name text,is_super_admin boolean)
language sql stable security definer set search_path='' as $$
  select e.org_id,o.name,e.slot='SUPER_ADMIN'
  from life_private.member_entry_operators e join public.life_organizations o on o.id=e.org_id
  join auth.users u on u.id=e.auth_user_id
  where e.auth_user_id=auth.uid() and u.email_confirmed_at is not null and u.deleted_at is null
    and life_private.person_id() is not null
$$;

create or replace function life_private.identity() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',p.id,'name',p.name,'office_position',c.office_position,'instructor_kind',c.instructor_kind,
 'member_entry_orgs',coalesce((select jsonb_agg(to_jsonb(e) order by e.org_name,e.org_id) from life_private.member_entry_orgs() e),'[]'::jsonb),
 'is_super_admin',exists(select 1 from life_private.member_entry_orgs() where is_super_admin),
 'roles',coalesce((select jsonb_agg(jsonb_build_object('role',r.role,'org_id',r.org_id)) from public.life_role_assignments r
 where r.person_id=p.id and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())),'[]'::jsonb))
 from public.life_people p left join life_private.account_classifications c on c.person_id=p.id where p.id=life_private.person_id()
$$;

create or replace function life_private.member_affiliations() returns table(person_id uuid,org_id uuid)
language sql stable security definer set search_path='' as $$
  select r.person_id,r.org_id from public.life_role_assignments r
  where r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())
  union select c.person_id,p.org_id from public.life_consent_events c join public.life_policy_versions p on p.id=c.policy_id where c.accepted
  union select a.person_id,o.org_id from public.life_applications a join public.life_offerings o on o.id=a.offering_id
  union select i.person_id,o.org_id from public.life_offering_instructors i join public.life_offerings o on o.id=i.offering_id
  union select d.person_id,d.org_id from public.life_instructor_dossiers d
  union select m.person_id,m.org_id from life_private.manual_members m
  union select a.person_id,e.org_id from life_private.member_entry_operators e join public.life_auth_links a on a.auth_user_id=e.auth_user_id
$$;
create or replace function life_private.member_scope_for(p_write boolean) returns table(person_id uuid,is_office boolean,is_instructor boolean,is_learner boolean)
language sql stable security definer set search_path='' as $$
  with admins as materialized (
    select distinct r.org_id from public.life_role_assignments r
    where r.person_id=(select life_private.person_id()) and r.role='SYSTEM_ADMIN'
      and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())
    union select org_id from life_private.member_entry_orgs() where not p_write
  ), permitted as (
    select a.person_id from life_private.member_affiliations() a
    group by a.person_id having bool_and(a.org_id in (select org_id from admins))
  ), roles as (
    select r.person_id,bool_or(r.role<>'INSTRUCTOR') office,bool_or(r.role='INSTRUCTOR') instructor
    from public.life_role_assignments r where r.valid_from<=now() and (r.valid_until is null or r.valid_until>now()) group by r.person_id
  )
  select p.id,(coalesce(r.office,false) or coalesce(m.member_group='office',false) or exists(select 1 from life_private.member_entry_operators e where e.auth_user_id=u.id)),(coalesce(r.instructor,false) or coalesce(m.member_group='instructor',false)),
    ((r.person_id is null and m.person_id is null and not exists(select 1 from life_private.member_entry_operators e where e.auth_user_id=u.id)) or coalesce(m.member_group='learner',false) or exists(select 1 from public.life_applications a where a.person_id=p.id))
  from permitted s join public.life_people p on p.id=s.person_id
  left join public.life_auth_links a on a.person_id=p.id left join auth.users u on u.id=a.auth_user_id
  left join life_private.manual_members m on m.person_id=p.id
  left join roles r on r.person_id=p.id
  where p.active and (u.id is not null or m.person_id is not null) and u.deleted_at is null and exists(select 1 from admins)
$$;
create or replace function life_private.member_scope() returns table(person_id uuid,is_office boolean,is_instructor boolean,is_learner boolean)
language sql stable security definer set search_path='' as $$select * from life_private.member_scope_for(true)$$;

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
    select p.id,p.name,coalesce(u.email,mm.email) email,u.id auth_user_id,(mm.person_id is not null and u.id is null) is_manual,s.is_office,s.is_instructor,s.is_learner
    from scope s join public.life_people p on p.id=s.person_id
    left join public.life_auth_links a on a.person_id=p.id left join auth.users u on u.id=a.auth_user_id
    left join life_private.manual_members mm on mm.person_id=p.id
    where (case p_group when 'office' then s.is_office when 'instructor' then s.is_instructor else s.is_learner end)
      and (p_person is null or p.id=p_person)
      and (p_query='' or strpos(lower(p.name),lower(p_query))>0 or strpos(lower(coalesce(u.email,mm.email,'')),lower(p_query))>0)
  ), selected as (
    select * from filtered order by name,id limit 20 offset ((p_page-1)*20)
  ), page as (
    select s.id,s.name,s.email,s.is_manual,s.is_office,s.is_instructor,s.is_learner,c.office_position,c.instructor_kind,
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
create or replace function life_private.member_history(p_person uuid,p_group text,p_page integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if life_private.person_id() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_group is null or p_group not in ('instructor','learner') or p_page is null or p_page not between 1 and 100000 then raise exception 'INVALID_INPUT'; end if;
  if not exists(select 1 from life_private.member_scope_for(false) s where s.person_id=p_person and (case p_group when 'instructor' then s.is_instructor else s.is_learner end)) then raise exception 'FORBIDDEN'; end if;
  with history as materialized (
    select o.id,o.name,o.starts_on,o.ends_on,
      case when i.valid_until is not null and i.valid_until<=now() then 'TEACHING_ENDED' else 'TEACHING' end status
    from public.life_offering_instructors i join public.life_offerings o on o.id=i.offering_id
    where p_group='instructor' and i.person_id=p_person
    union all
    select o.id,o.name,o.starts_on,o.ends_on,coalesce(case e.status when 'ACTIVE' then 'ENROLLED' when 'WITHDRAWN' then 'WITHDRAWN' end,a.status)
    from public.life_applications a join public.life_offerings o on o.id=a.offering_id
    left join public.life_enrollments e on e.application_id=a.id
    where p_group='learner' and a.person_id=p_person
  ), page as (select * from history order by starts_on desc,id limit 20 offset ((p_page-1)*20))
  select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(page) order by starts_on desc,id) from page),'[]'::jsonb),'total',(select count(*) from history),'page',p_page,'page_size',20) into result;
  return result;
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
  if p_group='office' and p_position is not null and p_position not in ('DIRECTOR','CENTER_HEAD','RESEARCHER') then raise exception 'INVALID_INPUT'; end if;
  if p_group='instructor' then
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
create or replace function life_private.delete_member(p_person uuid,p_revision integer) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=life_private.person_id(); current_revision integer;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if not life_private.mfa_recent() then raise exception 'MFA_REAUTH_REQUIRED'; end if;
  if exists(select 1 from life_private.member_entry_operators e join public.life_auth_links a on a.auth_user_id=e.auth_user_id where a.person_id=p_person and e.slot='SUPER_ADMIN') then raise exception 'SUPER_ADMIN_PROTECTED'; end if;
  if p_person=actor then raise exception 'SELF_DELETE_FORBIDDEN'; end if;
  perform 1 from public.life_people where id=p_person and active for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not exists(select 1 from life_private.member_scope() where person_id=p_person) then raise exception 'FORBIDDEN'; end if;
  select revision into current_revision from life_private.member_profiles where person_id=p_person;
  if p_revision is distinct from coalesce(current_revision,0) then raise exception 'REVISION_CONFLICT'; end if;
  insert into public.life_audit_events(org_id,actor_id,action,entity_id)
    select org_id,actor,'MEMBER_DEACTIVATED',p_person from life_private.member_affiliations() where person_id=p_person;
  update public.life_people set active=false where id=p_person;
end $$;

create function life_private.create_member(p_request uuid,p_org uuid,p_group text,p_name text,p_email text,p_position text,p_kind text,p_office_phone text,p_mobile_phone text,p_instructor_phone text,p_birth_date date,p_notes text) returns uuid
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
    or (p_group='office' and p_position is not null and p_position not in ('DIRECTOR','CENTER_HEAD','RESEARCHER'))
    or (p_group='instructor' and (p_kind is null or p_kind not in ('INTERNAL','EXTERNAL'))) then raise exception 'INVALID_INPUT'; end if;
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
create function public.life_create_member(p_request uuid,p_org uuid,p_group text,p_name text,p_email text,p_position text,p_kind text,p_office_phone text,p_mobile_phone text,p_instructor_phone text,p_birth_date date,p_notes text) returns uuid
language sql security invoker set search_path='' as $$select life_private.create_member(p_request,p_org,p_group,p_name,p_email,p_position,p_kind,p_office_phone,p_mobile_phone,p_instructor_phone,p_birth_date,p_notes)$$;
revoke all on function life_private.member_entry_orgs(),life_private.member_scope_for(boolean) from public,anon,authenticated,service_role;
revoke all on function life_private.create_member(uuid,uuid,text,text,text,text,text,text,text,text,date,text),public.life_create_member(uuid,uuid,text,text,text,text,text,text,text,text,date,text) from public,anon,authenticated,service_role;
grant execute on function life_private.create_member(uuid,uuid,text,text,text,text,text,text,text,text,date,text),public.life_create_member(uuid,uuid,text,text,text,text,text,text,text,text,date,text) to authenticated;
notify pgrst,'reload schema';
commit;
