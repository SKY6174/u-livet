begin;

-- A designated chief may edit their own office profile without acquiring
-- SYSTEM_ADMIN rights over every organization in which they operate courses.
create or replace function life_private.chief_member_self_edit(p_person uuid,p_group text) returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce(p_group='office' and p_person=life_private.person_id() and exists(
    select 1 from life_private.member_entry_operators e
    where e.slot='SUPER_ADMIN' and e.auth_user_id=auth.uid()
      and life_private.has_role(e.org_id,'SYSTEM_ADMIN')
  ),false)
$$;
revoke all on function life_private.chief_member_self_edit(uuid,text) from public,anon,authenticated,service_role;

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
    select p.id,p.name,coalesce(u.email,mm.email) email,u.id auth_user_id,(mm.person_id is not null and u.id is null) is_manual,(mm.person_id is not null and u.email_confirmed_at is not null) account_verified,
      exists(select 1 from life_private.member_entry_operators e where e.auth_user_id=u.id and e.slot='SUPER_ADMIN') is_super_admin,
      case when p_group='office' then case c.office_position
        when 'DIRECTOR' then 1 when 'DIVISION_HEAD' then 2 when 'CENTER_HEAD' then 3 when 'OPERATIONS_HEAD' then 4
        when 'PRINCIPAL_RESEARCHER' then 5 when 'SENIOR_RESEARCHER' then 6 when 'RESEARCHER' then 7 else 8 end else 0 end position_order,
      s.is_office,s.is_instructor,s.is_learner
    from scope s join public.life_people p on p.id=s.person_id
    left join public.life_auth_links a on a.person_id=p.id left join auth.users u on u.id=a.auth_user_id
    left join life_private.manual_members mm on mm.person_id=p.id
    left join life_private.account_classifications c on c.person_id=p.id
    where (case p_group when 'office' then s.is_office when 'instructor' then s.is_instructor else s.is_learner end)
      and (p_person is null or p.id=p_person)
      and (p_query='' or strpos(lower(p.name),lower(p_query))>0 or strpos(lower(coalesce(u.email,mm.email,'')),lower(p_query))>0)
  ), selected as (
    select * from filtered order by position_order,case when p_group='office' then name end collate pg_catalog."ko-x-icu",name,id limit 20 offset ((p_page-1)*20)
  ), page as (
    select s.id,s.name,s.email,s.position_order,s.is_manual,s.account_verified,s.is_super_admin,
      s.is_office,s.is_instructor,s.is_learner,c.office_position,c.instructor_kind,
      m.office_phone,coalesce(m.mobile_phone,lc.phone) mobile_phone,m.instructor_phone,m.birth_date,
      coalesce(m.notes,'') notes,coalesce(m.revision,0) revision,
      exists(select 1 from managed w where w.person_id=s.id) can_manage,
      (exists(select 1 from managed w where w.person_id=s.id) or life_private.chief_member_self_edit(s.id,p_group)) can_edit,
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
  select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(page)-'position_order' order by position_order,case when p_group='office' then name end collate pg_catalog."ko-x-icu",name,id) from page),'[]'::jsonb),
    'total',(select count(*) from filtered),'page',p_page,'page_size',20,'current_year',extract(year from timezone('Asia/Seoul',now()))::int,
    'counts',jsonb_build_object('office',(select count(*) from scope where is_office),'instructor',(select count(*) from scope where is_instructor),'learner',(select count(*) from scope where is_learner))) into result;
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
  if not found and life_private.chief_member_self_edit(p_person,p_group) then
    select * into s from life_private.member_scope_for(false) where person_id=p_person;
  end if;
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

notify pgrst,'reload schema';
commit;
