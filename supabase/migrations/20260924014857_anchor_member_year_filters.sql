begin;

create function life_private.member_directory_filtered(
  p_group text, p_query text, p_page integer, p_year integer,
  p_kind text, p_sort text, p_direction text
) returns jsonb language plpgsql stable security definer set search_path='' as $$
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

  with scope as materialized (select * from life_private.member_scope_for(false)),
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
        select 1 from public.life_enrollments e join public.life_offerings o on o.id=e.offering_id
        join public.life_project_years y on y.id=o.project_year_id
        where e.person_id=p.id and e.status='ACTIVE' and extract(year from y.starts_on)::integer=p_year
      )) or (p_group='instructor' and exists (
        select 1 from public.life_offering_instructors i join public.life_offerings o on o.id=i.offering_id
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
        from public.life_enrollments e join public.life_offerings o on o.id=e.offering_id
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
end $$;

create function public.life_member_directory_filtered(
  p_group text,p_query text,p_page integer,p_year integer,p_kind text,p_sort text,p_direction text
) returns jsonb language sql stable security invoker set search_path='' as $$
  select life_private.member_directory_filtered(p_group,p_query,p_page,p_year,p_kind,p_sort,p_direction)
$$;

revoke all on function life_private.member_directory_filtered(text,text,integer,integer,text,text,text),
  public.life_member_directory_filtered(text,text,integer,integer,text,text,text)
  from public,anon,authenticated,service_role;
grant execute on function life_private.member_directory_filtered(text,text,integer,integer,text,text,text),
  public.life_member_directory_filtered(text,text,integer,integer,text,text,text) to authenticated;

create function life_private.member_excel_export_filtered(
  p_group text,p_query text,p_year integer,p_kind text,p_sort text,p_direction text
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; row_count integer;
begin
  -- Reuse the directory's input and permission checks before exporting a larger result set.
  perform life_private.member_directory_filtered(p_group,p_query,1,p_year,p_kind,p_sort,p_direction);
  with scope as materialized (select * from life_private.member_scope_for(false)),
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
        select 1 from public.life_enrollments e join public.life_offerings o on o.id=e.offering_id
        join public.life_project_years y on y.id=o.project_year_id
        where e.person_id=p.id and e.status='ACTIVE' and extract(year from y.starts_on)::integer=p_year
      )) or (p_group='instructor' and exists (
        select 1 from public.life_offering_instructors i join public.life_offerings o on o.id=i.offering_id
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
end $$;

create function public.life_member_excel_export_filtered(
  p_group text,p_query text,p_year integer,p_kind text,p_sort text,p_direction text
) returns jsonb language sql stable security invoker set search_path='' as $$
  select life_private.member_excel_export_filtered(p_group,p_query,p_year,p_kind,p_sort,p_direction)
$$;

revoke all on function life_private.member_excel_export_filtered(text,text,integer,text,text,text),
  public.life_member_excel_export_filtered(text,text,integer,text,text,text)
  from public,anon,authenticated,service_role;
grant execute on function life_private.member_excel_export_filtered(text,text,integer,text,text,text),
  public.life_member_excel_export_filtered(text,text,integer,text,text,text) to authenticated;

notify pgrst,'reload schema';
commit;
