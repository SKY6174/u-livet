begin;

create table life_private.member_profiles (
  person_id uuid primary key references public.life_people(id),
  office_phone text check (office_phone ~ '^0[0-9]{8,10}$'),
  mobile_phone text check (mobile_phone ~ '^\+82(10[0-9]{8}|1[16789][0-9]{7,8})$'),
  instructor_phone text check (instructor_phone ~ '^0[0-9]{8,10}$'),
  birth_date date check (birth_date >= date '1900-01-01'),
  notes text not null default '' check (length(notes) <= 2000),
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.life_people(id)
);
alter table life_private.member_profiles enable row level security;
revoke all on life_private.member_profiles from public, anon, authenticated, service_role;
create index life_members_active_name on public.life_people(name,id) where active;
create index if not exists life_member_teaching_person on public.life_offering_instructors(person_id,offering_id);
create index if not exists life_member_consent_person on public.life_consent_events(person_id,policy_id) where accepted;
create index if not exists life_member_application_person on public.life_applications(person_id,offering_id);
create index life_member_profile_editor on life_private.member_profiles(updated_by);

-- Include all organizations attached to the member, not just a chosen login tab.
create function life_private.member_affiliations() returns table(person_id uuid,org_id uuid)
language sql stable security definer set search_path='' as $$
  select r.person_id,r.org_id from public.life_role_assignments r
  where r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())
  union select c.person_id,p.org_id from public.life_consent_events c join public.life_policy_versions p on p.id=c.policy_id where c.accepted
  union select a.person_id,o.org_id from public.life_applications a join public.life_offerings o on o.id=a.offering_id
  union select i.person_id,o.org_id from public.life_offering_instructors i join public.life_offerings o on o.id=i.offering_id
  union select d.person_id,d.org_id from public.life_instructor_dossiers d
$$;
create function life_private.member_scope() returns table(person_id uuid,is_office boolean,is_instructor boolean,is_learner boolean)
language sql stable security definer set search_path='' as $$
  with admins as materialized (
    select distinct r.org_id from public.life_role_assignments r
    where r.person_id=(select life_private.person_id()) and r.role='SYSTEM_ADMIN'
      and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())
  ), permitted as (
    select a.person_id from life_private.member_affiliations() a
    group by a.person_id having bool_and(a.org_id in (select org_id from admins))
  ), roles as (
    select r.person_id,bool_or(r.role<>'INSTRUCTOR') office,bool_or(r.role='INSTRUCTOR') instructor
    from public.life_role_assignments r where r.valid_from<=now() and (r.valid_until is null or r.valid_until>now()) group by r.person_id
  )
  select p.id,coalesce(r.office,false),coalesce(r.instructor,false),
    (r.person_id is null or exists(select 1 from public.life_applications a where a.person_id=p.id))
  from permitted s join public.life_people p on p.id=s.person_id
  join public.life_auth_links a on a.person_id=p.id join auth.users u on u.id=a.auth_user_id
  left join roles r on r.person_id=p.id
  where p.active and u.deleted_at is null and exists(select 1 from admins)
$$;

create function life_private.member_directory(p_group text,p_query text,p_page integer,p_person uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if life_private.person_id() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.life_role_assignments r where r.person_id=life_private.person_id() and r.role='SYSTEM_ADMIN' and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())) then raise exception 'FORBIDDEN'; end if;
  if p_group is null or p_group not in ('office','instructor','learner') or p_page is null or p_page not between 1 and 100000 or p_query is null or length(p_query)>100 then raise exception 'INVALID_INPUT'; end if;
  with scope as materialized (select * from life_private.member_scope()),
  filtered as materialized (
    select p.id,p.name,u.email,u.id auth_user_id,s.is_office,s.is_instructor,s.is_learner
    from scope s join public.life_people p on p.id=s.person_id
    join public.life_auth_links a on a.person_id=p.id join auth.users u on u.id=a.auth_user_id
    where (case p_group when 'office' then s.is_office when 'instructor' then s.is_instructor else s.is_learner end)
      and (p_person is null or p.id=p_person)
      and (p_query='' or strpos(lower(p.name),lower(p_query))>0 or strpos(lower(coalesce(u.email,'')),lower(p_query))>0)
  ), selected as (
    select * from filtered order by name,id limit 20 offset ((p_page-1)*20)
  ), page as (
    select s.id,s.name,s.email,s.is_office,s.is_instructor,s.is_learner,c.office_position,c.instructor_kind,
      m.office_phone,coalesce(m.mobile_phone,lc.phone) mobile_phone,m.instructor_phone,m.birth_date,
      coalesce(m.notes,'') notes,coalesce(m.revision,0) revision
    from selected s left join life_private.account_classifications c on c.person_id=s.id
    left join life_private.member_profiles m on m.person_id=s.id
    left join life_private.learner_contacts lc on lc.user_id=s.auth_user_id
  )
  select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(page) order by name,id) from page),'[]'::jsonb),
    'total',(select count(*) from filtered),'page',p_page,'page_size',20,
    'counts',jsonb_build_object('office',(select count(*) from scope where is_office),'instructor',(select count(*) from scope where is_instructor),'learner',(select count(*) from scope where is_learner))) into result;
  return result;
end $$;
create function public.life_member_directory(p_group text default 'office',p_query text default '',p_page integer default 1,p_person uuid default null) returns jsonb
language sql stable security invoker set search_path='' as $$select life_private.member_directory(p_group,p_query,p_page,p_person)$$;

create function life_private.member_history(p_person uuid,p_group text,p_page integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if life_private.person_id() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_group is null or p_group not in ('instructor','learner') or p_page is null or p_page not between 1 and 100000 then raise exception 'INVALID_INPUT'; end if;
  if not exists(select 1 from life_private.member_scope() s where s.person_id=p_person and (case p_group when 'instructor' then s.is_instructor else s.is_learner end)) then raise exception 'FORBIDDEN'; end if;
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
create function public.life_member_history(p_person uuid,p_group text,p_page integer default 1) returns jsonb
language sql stable security invoker set search_path='' as $$select life_private.member_history(p_person,p_group,p_page)$$;

create function life_private.save_member(p_person uuid,p_group text,p_name text,p_position text,p_kind text,p_office_phone text,p_mobile_phone text,p_instructor_phone text,p_birth_date date,p_notes text,p_revision integer) returns void
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
    if p_kind='INTERNAL' and not exists(select 1 from auth.users where id=linked_user and email_confirmed_at is not null and lower(email) ~ '^[^@[:space:]]+@uc\.ac\.kr$') then raise exception 'SCHOOL_EMAIL_REQUIRED'; end if;
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
create function public.life_save_member(p_person uuid,p_group text,p_name text,p_position text,p_kind text,p_office_phone text,p_mobile_phone text,p_instructor_phone text,p_birth_date date,p_notes text,p_revision integer) returns void
language sql security invoker set search_path='' as $$select life_private.save_member(p_person,p_group,p_name,p_position,p_kind,p_office_phone,p_mobile_phone,p_instructor_phone,p_birth_date,p_notes,p_revision)$$;

create function life_private.delete_member(p_person uuid,p_revision integer) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=life_private.person_id(); current_revision integer;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if not life_private.mfa_recent() then raise exception 'MFA_REAUTH_REQUIRED'; end if;
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
create function public.life_delete_member(p_person uuid,p_revision integer) returns void
language sql security invoker set search_path='' as $$select life_private.delete_member(p_person,p_revision)$$;

revoke all on function life_private.member_affiliations(),life_private.member_scope() from public,anon,authenticated,service_role;
revoke all on function life_private.member_directory(text,text,integer,uuid),public.life_member_directory(text,text,integer,uuid),life_private.member_history(uuid,text,integer),public.life_member_history(uuid,text,integer),life_private.save_member(uuid,text,text,text,text,text,text,text,date,text,integer),public.life_save_member(uuid,text,text,text,text,text,text,text,date,text,integer),life_private.delete_member(uuid,integer),public.life_delete_member(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function life_private.member_directory(text,text,integer,uuid),public.life_member_directory(text,text,integer,uuid),life_private.member_history(uuid,text,integer),public.life_member_history(uuid,text,integer),life_private.save_member(uuid,text,text,text,text,text,text,text,date,text,integer),public.life_save_member(uuid,text,text,text,text,text,text,text,date,text,integer),life_private.delete_member(uuid,integer),public.life_delete_member(uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;
