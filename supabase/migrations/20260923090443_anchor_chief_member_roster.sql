begin;

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
      -- The designated chief belongs in their own office roster even when they
      -- also operate courses for another organization. Keep write scope strict.
      or (not p_write and exists(
        select 1 from life_private.member_entry_operators e
        join public.life_auth_links l on l.auth_user_id=e.auth_user_id
        where e.slot='SUPER_ADMIN' and l.person_id=a.person_id and e.org_id in (select org_id from admins)
      ))
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
      exists(select 1 from life_private.member_entry_operators e where e.auth_user_id=u.id and e.slot='SUPER_ADMIN') is_super_admin,s.is_office,s.is_instructor,s.is_learner
    from scope s join public.life_people p on p.id=s.person_id
    left join public.life_auth_links a on a.person_id=p.id left join auth.users u on u.id=a.auth_user_id
    left join life_private.manual_members mm on mm.person_id=p.id
    where (case p_group when 'office' then s.is_office when 'instructor' then s.is_instructor else s.is_learner end)
      and (p_person is null or p.id=p_person)
      and (p_query='' or strpos(lower(p.name),lower(p_query))>0 or strpos(lower(coalesce(u.email,mm.email,'')),lower(p_query))>0)
  ), selected as (
    select * from filtered order by name,id limit 20 offset ((p_page-1)*20)
  ), page as (
    select s.id,s.name,s.email,s.is_manual,s.account_verified,s.is_super_admin,s.is_office,s.is_instructor,s.is_learner,c.office_position,c.instructor_kind,
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
