begin;

-- Explicit, reversible visibility classification; original identities, roles,
-- authentication credentials and course/evidence history remain untouched.
create table life_private.non_operational_members (
 person_id uuid primary key references public.life_people(id),
 reason text not null check (length(btrim(reason)) between 1 and 500),
 classified_at timestamptz not null default now()
);
alter table life_private.non_operational_members enable row level security;
revoke all on life_private.non_operational_members from public,anon,authenticated,service_role;
comment on table life_private.non_operational_members is
 'Preserved verification identities excluded from the operational member directory; not account deactivation.';
insert into life_private.non_operational_members(person_id,reason)
select id,'기존 검증용·dummy 인물의 운영 계정 명부 제외'
from public.life_people where id in (
 '07628cf8-cf33-423a-8b63-016ee5002273',
 '0e960882-683c-4c63-ae37-b0260d5ca914',
 '0f6fa79f-0e81-4cbd-b76d-529239b6f470',
 '16479893-ac9f-4967-9c8b-ea8cc14bf6d7',
 '1a143c5e-61e0-4b43-934a-f6d65c7e3389',
 '220f5402-9a26-4f43-81ca-e54aca10697a',
 '272c6cef-ed6b-4388-ae95-0a098e5a94a2',
 '286962a2-ac66-481b-bf01-fb6f9f31030b',
 '3678b2cb-1ab2-4299-aa3c-1a481f53f7cf',
 '4031c2ad-2a2c-41b7-bea0-dfab6e1640f7',
 '41c7b580-af92-4a39-9cc1-75fc3cddbd42',
 '47dfd445-67a3-45bb-a113-e4aae3e47614',
 '48aa866a-86a5-4ed0-a9fc-7c7678100a8e',
 '4f2385d0-46d9-4bbd-b575-f7332ba95488',
 '5b0af8e6-0afd-4a72-a80e-34bf95188150',
 '5ef6b78e-212b-44a1-928d-a3d1e7ad1606',
 '61c9fb37-656c-4e54-a912-97e6f45f625a',
 '71cdf638-50b0-4a85-8ecd-59f3fe5bbe6c',
 'add55bcf-5508-43cc-b78e-9496160aa1bc',
 'b51ec6fb-800d-4cbc-9503-2cdaf4ca6f31',
 'be89b0a0-4732-46b2-bab1-cfc36d03622f',
 'c0a63c00-959b-4b35-894f-7932478ecff1',
 'cb1562c7-a436-4abb-b9be-b6eb3346fd7b',
 'd090bd97-d722-4dd7-9092-0f5530523d48',
 'fffb0896-11b5-41fd-a5d0-3df1fb6bf7bf'
);

-- This read-only scope composes existing organization authorization. Do not
-- replace member_scope_for: write/authentication helpers also depend on it.
create function life_private.operational_member_scope()
returns table(person_id uuid,is_office boolean,is_instructor boolean,is_learner boolean)
language sql stable security definer set search_path='' as $$
 select s.* from life_private.member_scope_for(false) s
 where not exists(select 1 from life_private.non_operational_members x where x.person_id=s.person_id)
$$;
revoke all on function life_private.operational_member_scope() from public,anon,authenticated,service_role;

-- Preserve existing signatures, permission guards, input checks and ACLs.

-- Operational member read: member_directory
CREATE OR REPLACE FUNCTION life_private.member_directory(p_group text, p_query text, p_page integer, p_person uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
  if life_private.person_id() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.life_role_assignments r where r.person_id=life_private.person_id() and r.role='SYSTEM_ADMIN' and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())) and not exists(select 1 from life_private.member_entry_orgs()) then raise exception 'FORBIDDEN'; end if;
  if p_group is null or p_group not in ('office','instructor','learner') or p_page is null or p_page not between 1 and 100000 or p_query is null or length(p_query)>100 then raise exception 'INVALID_INPUT'; end if;
  with scope as materialized (select * from life_private.operational_member_scope()),
  managed as materialized (select person_id from life_private.member_scope()),
  filtered as materialized (
    select p.id,p.name,coalesce(u.email,mm.email) email,u.id auth_user_id,(mm.person_id is not null and u.id is null) is_manual,(mm.person_id is not null and u.email_confirmed_at is not null) account_verified,
      exists(select 1 from life_private.member_entry_operators e where e.auth_user_id=u.id and e.slot='SUPER_ADMIN') is_super_admin,
      case when p_group='office' then case c.office_position
        when 'DIRECTOR' then 1 when 'DIVISION_HEAD' then 2 when 'CENTER_HEAD' then 3 when 'OPERATIONS_HEAD' then 4
        when 'PRINCIPAL_RESEARCHER' then 5 when 'SENIOR_RESEARCHER' then 6 when 'RESEARCHER' then 7 else 8 end else 0 end position_order,
      s.is_office,s.is_instructor,s.is_learner,
      (pool.person_id is not null and mm.person_id is null and u.id is null) is_pool_only,pool.org_id pool_org_id
    from scope s join public.life_people p on p.id=s.person_id
    left join public.life_auth_links a on a.person_id=p.id left join auth.users u on u.id=a.auth_user_id
    left join life_private.manual_members mm on mm.person_id=p.id
    left join life_private.account_classifications c on c.person_id=p.id
    left join lateral (select x.person_id,x.org_id from life_private.instructor_pool x where x.person_id=p.id and x.status='ACTIVE' order by x.org_id limit 1) pool on true
    where (case p_group when 'office' then s.is_office when 'instructor' then s.is_instructor else s.is_learner end)
      and (p_person is null or p.id=p_person)
      and (p_query='' or strpos(lower(p.name),lower(p_query))>0 or strpos(lower(coalesce(u.email,mm.email,'')),lower(p_query))>0)
  ), selected as (
    select * from filtered order by position_order,case when p_group='office' then name end collate pg_catalog."ko-x-icu",name,id limit 20 offset ((p_page-1)*20)
  ), page as (
    select s.id,s.name,s.email,s.position_order,s.is_manual,s.account_verified,s.is_super_admin,
      s.is_office,s.is_instructor,s.is_learner,s.is_pool_only,s.pool_org_id,c.office_position,coalesce(c.instructor_kind,pool.kind) instructor_kind,
      m.office_phone,coalesce(m.mobile_phone,lc.phone) mobile_phone,coalesce(m.instructor_phone,pool.phone) instructor_phone,m.birth_date,
      coalesce(m.notes,pool.notes,'') notes,coalesce(m.revision,0) revision,
      exists(select 1 from managed w where w.person_id=s.id) can_manage,
      (exists(select 1 from managed w where w.person_id=s.id) or life_private.chief_member_self_edit(s.id,p_group)) can_edit,
      case when p_group='learner' then coalesce((
        select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name) order by o.starts_on,o.id)
        from public.life_enrollments e join life_private.operational_offerings o on o.id=e.offering_id
        where e.person_id=s.id and e.status='ACTIVE'
          and o.starts_on < (date_trunc('year',timezone('Asia/Seoul',now()))+interval '1 year')::date
          and o.ends_on >= date_trunc('year',timezone('Asia/Seoul',now()))::date
      ),'[]'::jsonb) else '[]'::jsonb end current_courses
    from selected s left join life_private.account_classifications c on c.person_id=s.id
    left join life_private.member_profiles m on m.person_id=s.id
    left join life_private.learner_contacts lc on lc.user_id=s.auth_user_id
    left join lateral (select x.kind,x.phone,x.notes from life_private.instructor_pool x where x.person_id=s.id and x.status='ACTIVE' and x.org_id=s.pool_org_id limit 1) pool on true
  )
  select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(page)-'position_order' order by position_order,case when p_group='office' then name end collate pg_catalog."ko-x-icu",name,id) from page),'[]'::jsonb),
    'total',(select count(*) from filtered),'page',p_page,'page_size',20,'current_year',extract(year from timezone('Asia/Seoul',now()))::int,
    'counts',jsonb_build_object('office',(select count(*) from scope where is_office),'instructor',(select count(*) from scope where is_instructor),'learner',(select count(*) from scope where is_learner))) into result;
  return result;
end $function$;

-- Operational member read: member_directory_filtered
CREATE OR REPLACE FUNCTION life_private.member_directory_filtered(p_group text, p_query text, p_page integer, p_year integer, p_kind text, p_sort text, p_direction text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
  if life_private.person_id() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.life_role_assignments r where r.person_id=life_private.person_id() and r.role='SYSTEM_ADMIN' and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now()))
    and not exists(select 1 from life_private.member_entry_orgs()) then raise exception 'FORBIDDEN'; end if;
  if p_group is null or p_group not in ('office','instructor','learner')
    or p_query is null or length(p_query)>100 or p_page is null or p_page not between 1 and 100000
    or (p_year is not null and (p_group='office' or p_year not between 2025 and 2029))
    or (p_kind is not null and (p_group<>'instructor' or p_kind not in ('INTERNAL','EXTERNAL')))
    or p_sort is null or p_sort not in ('default','name','email','phone','position','kind','birth_date')
    or (p_sort='position' and p_group<>'office') or (p_sort='kind' and p_group<>'instructor')
    or (p_sort='birth_date' and p_group<>'learner')
    or p_direction is null or p_direction not in ('asc','desc') then raise exception 'INVALID_INPUT'; end if;

  with scope as materialized (select * from life_private.operational_member_scope()),
  managed as materialized (select person_id from life_private.member_scope()),
  filtered as materialized (
    select p.id,p.name,coalesce(u.email,mm.email) email,u.id auth_user_id,
      (mm.person_id is not null and u.id is null) is_manual,
      (mm.person_id is not null and u.email_confirmed_at is not null) account_verified,
      exists(select 1 from life_private.member_entry_operators e where e.auth_user_id=u.id and e.slot='SUPER_ADMIN') is_super_admin,
      case c.office_position when 'DIRECTOR' then 1 when 'DIVISION_HEAD' then 2 when 'CENTER_HEAD' then 3
        when 'OPERATIONS_HEAD' then 4 when 'PRINCIPAL_RESEARCHER' then 5 when 'SENIOR_RESEARCHER' then 6
        when 'RESEARCHER' then 7 else 8 end position_order,
      case coalesce(c.instructor_kind,pool.kind) when 'INTERNAL' then 1 when 'EXTERNAL' then 2 else 3 end kind_order,
      s.is_office,s.is_instructor,s.is_learner,
      (pool.person_id is not null and mm.person_id is null and u.id is null) is_pool_only,pool.org_id pool_org_id,
      c.office_position,coalesce(c.instructor_kind,pool.kind) instructor_kind,
      m.office_phone,coalesce(m.mobile_phone,lc.phone) mobile_phone,
      coalesce(m.instructor_phone,pool.phone) instructor_phone,m.birth_date,
      coalesce(m.notes,pool.notes,'') notes,coalesce(m.revision,0) revision
    from scope s join public.life_people p on p.id=s.person_id
    left join public.life_auth_links a on a.person_id=p.id left join auth.users u on u.id=a.auth_user_id
    left join life_private.manual_members mm on mm.person_id=p.id
    left join life_private.account_classifications c on c.person_id=p.id
    left join life_private.member_profiles m on m.person_id=p.id
    left join life_private.learner_contacts lc on lc.user_id=u.id
    left join lateral (select x.person_id,x.org_id,x.kind,x.phone,x.notes from life_private.instructor_pool x
      where x.person_id=p.id and x.status='ACTIVE' order by x.org_id limit 1) pool on true
    where (case p_group when 'office' then s.is_office when 'instructor' then s.is_instructor else s.is_learner end)
      and (p_query='' or strpos(lower(p.name),lower(p_query))>0 or strpos(lower(coalesce(u.email,mm.email,'')),lower(p_query))>0)
      and (p_kind is null or coalesce(c.instructor_kind,pool.kind)=p_kind)
      and (p_year is null or (p_group='learner' and exists (
        select 1 from public.life_enrollments e join life_private.operational_offerings o on o.id=e.offering_id
        join public.life_project_years y on y.id=o.project_year_id
        where e.person_id=p.id and e.status='ACTIVE' and extract(year from y.starts_on)::integer=p_year
      )) or (p_group='instructor' and exists (
        select 1 from public.life_offering_instructors i join life_private.operational_offerings o on o.id=i.offering_id
        join public.life_project_years y on y.id=o.project_year_id
        where i.person_id=p.id and extract(year from y.starts_on)::integer=p_year
      )))
  ), ranked as (
    select f.*,row_number() over (order by
      case when (p_sort='default' and p_group='office' or p_sort='position') and p_direction='asc' then position_order end asc nulls last,
      case when (p_sort='default' and p_group='office' or p_sort='position') and p_direction='desc' then position_order end desc nulls last,
      case when p_sort='kind' and p_direction='asc' then kind_order end asc nulls last,
      case when p_sort='kind' and p_direction='desc' then kind_order end desc nulls last,
      case when p_sort in ('default','name') and p_direction='desc' then name end collate pg_catalog."ko-x-icu" desc nulls last,
      case when p_sort in ('default','name') and p_direction='asc' then name end collate pg_catalog."ko-x-icu" asc nulls last,
      case when p_sort='email' and p_direction='asc' then lower(email) end asc nulls last,
      case when p_sort='email' and p_direction='desc' then lower(email) end desc nulls last,
      case when p_sort='phone' and p_direction='asc' then coalesce(case when p_group='instructor' then instructor_phone else mobile_phone end,'') end asc nulls last,
      case when p_sort='phone' and p_direction='desc' then coalesce(case when p_group='instructor' then instructor_phone else mobile_phone end,'') end desc nulls last,
      case when p_sort='birth_date' and p_direction='asc' then birth_date end asc nulls last,
      case when p_sort='birth_date' and p_direction='desc' then birth_date end desc nulls last,
      name collate pg_catalog."ko-x-icu",id) sort_index from filtered f
  ), selected as (
    select * from ranked where sort_index between (p_page-1)*20+1 and p_page*20
  ), page as (
    select s.id,s.name,s.email,s.is_manual,s.account_verified,s.is_super_admin,
      s.is_office,s.is_instructor,s.is_learner,s.is_pool_only,s.pool_org_id,s.office_position,s.instructor_kind,
      s.office_phone,s.mobile_phone,s.instructor_phone,s.birth_date,s.notes,s.revision,s.sort_index,
      exists(select 1 from managed w where w.person_id=s.id) can_manage,
      (exists(select 1 from managed w where w.person_id=s.id) or life_private.chief_member_self_edit(s.id,p_group)) can_edit,
      case when p_group='learner' then coalesce((
        select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name) order by o.starts_on,o.id)
        from public.life_enrollments e join life_private.operational_offerings o on o.id=e.offering_id
        left join public.life_project_years y on y.id=o.project_year_id
        where e.person_id=s.id and e.status='ACTIVE'
          and ((p_year is not null and extract(year from y.starts_on)::integer=p_year)
            or (p_year is null and o.starts_on < (date_trunc('year',timezone('Asia/Seoul',now()))+interval '1 year')::date
              and o.ends_on >= date_trunc('year',timezone('Asia/Seoul',now()))::date))
      ),'[]'::jsonb) else '[]'::jsonb end current_courses
    from selected s
  )
  select jsonb_build_object(
    'items',coalesce((select jsonb_agg(to_jsonb(page)-'sort_index' order by sort_index) from page),'[]'::jsonb),
    'total',(select count(*) from filtered),'page',p_page,'page_size',20,
    'current_year',coalesce(p_year,extract(year from timezone('Asia/Seoul',now()))::integer),
    'counts',jsonb_build_object('office',(select count(*) from scope where is_office),
      'instructor',(select count(*) from scope where is_instructor),'learner',(select count(*) from scope where is_learner))) into result;
  return result;
end $function$;

-- Operational member read: member_excel_export
CREATE OR REPLACE FUNCTION life_private.member_excel_export(p_group text, p_query text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb; row_count integer;
begin
  if life_private.person_id() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.life_role_assignments r where r.person_id=life_private.person_id() and r.role='SYSTEM_ADMIN' and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now()))
     and not exists(select 1 from life_private.member_entry_orgs()) then raise exception 'FORBIDDEN'; end if;
  if p_group is null or p_group not in ('office','instructor','learner') or p_query is null or length(p_query)>100 then raise exception 'INVALID_INPUT'; end if;

  with scope as materialized (select * from life_private.operational_member_scope()),
  rows as (
    select p.id person_id,p.name,coalesce(u.email,mm.email) email,c.office_position position,c.instructor_kind kind,
      m.office_phone,coalesce(m.mobile_phone,lc.phone) mobile_phone,m.instructor_phone,m.birth_date,
      coalesce(m.notes,'') notes,coalesce(m.revision,0) revision,
      case when p_group='office' then case c.office_position
        when 'DIRECTOR' then 1 when 'DIVISION_HEAD' then 2 when 'CENTER_HEAD' then 3 when 'OPERATIONS_HEAD' then 4
        when 'PRINCIPAL_RESEARCHER' then 5 when 'SENIOR_RESEARCHER' then 6 when 'RESEARCHER' then 7 else 8 end else 0 end position_order
    from scope s join public.life_people p on p.id=s.person_id
    left join public.life_auth_links a on a.person_id=p.id left join auth.users u on u.id=a.auth_user_id
    left join life_private.manual_members mm on mm.person_id=p.id
    left join life_private.account_classifications c on c.person_id=p.id
    left join life_private.member_profiles m on m.person_id=p.id
    left join life_private.learner_contacts lc on lc.user_id=u.id
    where (case p_group when 'office' then s.is_office when 'instructor' then s.is_instructor else s.is_learner end)
      and (p_query='' or strpos(lower(p.name),lower(p_query))>0 or strpos(lower(coalesce(u.email,mm.email,'')),lower(p_query))>0)
    order by position_order,case when p_group='office' then p.name end collate pg_catalog."ko-x-icu",p.name,p.id
    limit 1001
  )
  select count(*)::integer,coalesce(jsonb_agg(to_jsonb(rows)-'position_order' order by position_order,case when p_group='office' then name end collate pg_catalog."ko-x-icu",name,person_id),'[]'::jsonb)
  into row_count,result from rows;
  if row_count>1000 then raise exception 'EXPORT_LIMIT'; end if;
  return result;
end $function$;

-- Operational member read: member_excel_export_filtered
CREATE OR REPLACE FUNCTION life_private.member_excel_export_filtered(p_group text, p_query text, p_year integer, p_kind text, p_sort text, p_direction text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb; row_count integer;
begin
  -- Reuse the directory's input and permission checks before exporting a larger result set.
  perform life_private.member_directory_filtered(p_group,p_query,1,p_year,p_kind,p_sort,p_direction);
  with scope as materialized (select * from life_private.operational_member_scope()),
  filtered as materialized (
    select p.id person_id,p.name,coalesce(u.email,mm.email) email,c.office_position position,
      coalesce(c.instructor_kind,pool.kind) kind,m.office_phone,
      coalesce(m.mobile_phone,lc.phone) mobile_phone,coalesce(m.instructor_phone,pool.phone) instructor_phone,
      m.birth_date,coalesce(m.notes,pool.notes,'') notes,coalesce(m.revision,0) revision,
      case c.office_position when 'DIRECTOR' then 1 when 'DIVISION_HEAD' then 2 when 'CENTER_HEAD' then 3
        when 'OPERATIONS_HEAD' then 4 when 'PRINCIPAL_RESEARCHER' then 5 when 'SENIOR_RESEARCHER' then 6
        when 'RESEARCHER' then 7 else 8 end position_order,
      case coalesce(c.instructor_kind,pool.kind) when 'INTERNAL' then 1 when 'EXTERNAL' then 2 else 3 end kind_order
    from scope s join public.life_people p on p.id=s.person_id
    left join public.life_auth_links a on a.person_id=p.id left join auth.users u on u.id=a.auth_user_id
    left join life_private.manual_members mm on mm.person_id=p.id
    left join life_private.account_classifications c on c.person_id=p.id
    left join life_private.member_profiles m on m.person_id=p.id
    left join life_private.learner_contacts lc on lc.user_id=u.id
    left join lateral (select x.kind,x.phone,x.notes from life_private.instructor_pool x
      where x.person_id=p.id and x.status='ACTIVE' order by x.org_id limit 1) pool on true
    where (case p_group when 'office' then s.is_office when 'instructor' then s.is_instructor else s.is_learner end)
      and (p_query='' or strpos(lower(p.name),lower(p_query))>0 or strpos(lower(coalesce(u.email,mm.email,'')),lower(p_query))>0)
      and (p_kind is null or coalesce(c.instructor_kind,pool.kind)=p_kind)
      and (p_year is null or (p_group='learner' and exists (
        select 1 from public.life_enrollments e join life_private.operational_offerings o on o.id=e.offering_id
        join public.life_project_years y on y.id=o.project_year_id
        where e.person_id=p.id and e.status='ACTIVE' and extract(year from y.starts_on)::integer=p_year
      )) or (p_group='instructor' and exists (
        select 1 from public.life_offering_instructors i join life_private.operational_offerings o on o.id=i.offering_id
        join public.life_project_years y on y.id=o.project_year_id
        where i.person_id=p.id and extract(year from y.starts_on)::integer=p_year
      )))
  ), ranked as (
    select f.*,row_number() over (order by
      case when (p_sort='default' and p_group='office' or p_sort='position') and p_direction='asc' then position_order end asc nulls last,
      case when (p_sort='default' and p_group='office' or p_sort='position') and p_direction='desc' then position_order end desc nulls last,
      case when p_sort='kind' and p_direction='asc' then kind_order end asc nulls last,
      case when p_sort='kind' and p_direction='desc' then kind_order end desc nulls last,
      case when p_sort in ('default','name') and p_direction='desc' then name end collate pg_catalog."ko-x-icu" desc nulls last,
      case when p_sort in ('default','name') and p_direction='asc' then name end collate pg_catalog."ko-x-icu" asc nulls last,
      case when p_sort='email' and p_direction='asc' then lower(email) end asc nulls last,
      case when p_sort='email' and p_direction='desc' then lower(email) end desc nulls last,
      case when p_sort='phone' and p_direction='asc' then coalesce(case when p_group='instructor' then instructor_phone else mobile_phone end,'') end asc nulls last,
      case when p_sort='phone' and p_direction='desc' then coalesce(case when p_group='instructor' then instructor_phone else mobile_phone end,'') end desc nulls last,
      case when p_sort='birth_date' and p_direction='asc' then birth_date end asc nulls last,
      case when p_sort='birth_date' and p_direction='desc' then birth_date end desc nulls last,
      name collate pg_catalog."ko-x-icu",person_id) sort_index from filtered f
  ), rows as (select * from ranked order by sort_index limit 1001)
  select count(*)::integer,
    coalesce(jsonb_agg(to_jsonb(rows)-'position_order'-'kind_order'-'sort_index' order by sort_index),'[]'::jsonb)
    into row_count,result from rows;
  if row_count>1000 then raise exception 'EXPORT_LIMIT'; end if;
  return result;
end $function$;

-- Operational member read: member_history
CREATE OR REPLACE FUNCTION life_private.member_history(p_person uuid, p_group text, p_page integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
  if life_private.person_id() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_group is null or p_group not in ('instructor','learner') or p_page is null or p_page not between 1 and 100000 then raise exception 'INVALID_INPUT'; end if;
  if not exists(select 1 from life_private.operational_member_scope() s where s.person_id=p_person and (case p_group when 'instructor' then s.is_instructor else s.is_learner end)) then raise exception 'FORBIDDEN'; end if;
  with history as materialized (
    select o.id,o.name,o.starts_on,o.ends_on,
      case when i.valid_until is not null and i.valid_until<=now() then 'TEACHING_ENDED' else 'TEACHING' end status
    from public.life_offering_instructors i join life_private.operational_offerings o on o.id=i.offering_id
    where p_group='instructor' and i.person_id=p_person
    union all
    select o.id,o.name,o.starts_on,o.ends_on,coalesce(case e.status when 'ACTIVE' then 'ENROLLED' when 'WITHDRAWN' then 'WITHDRAWN' end,a.status)
    from public.life_applications a join life_private.operational_offerings o on o.id=a.offering_id
    left join public.life_enrollments e on e.application_id=a.id
    where p_group='learner' and a.person_id=p_person
  ), page as (select * from history order by starts_on desc,id limit 20 offset ((p_page-1)*20))
  select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(page) order by starts_on desc,id) from page),'[]'::jsonb),'total',(select count(*) from history),'page',p_page,'page_size',20) into result;
  return result;
end $function$;

notify pgrst,'reload schema';
commit;
