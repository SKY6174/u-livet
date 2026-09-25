-- Resolve the caller and active organization roles once per list request.
-- The public RPC contract and its existing grants remain unchanged.
create or replace function life_private.operation_list()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $function$
declare
  v_person uuid;
  v_manager_orgs uuid[];
  v_instructor_orgs uuid[];
begin
  if auth.uid() is null or not life_private.mfa_verified() then
    raise exception 'FORBIDDEN';
  end if;

  v_person := life_private.person_id();
  if v_person is null then
    return '[]'::jsonb;
  end if;

  select
    coalesce(array_agg(distinct role_assignment.org_id) filter (
      where role_assignment.role in ('COURSE_MANAGER', 'SYSTEM_ADMIN')
    ), '{}'::uuid[]),
    coalesce(array_agg(distinct role_assignment.org_id) filter (
      where role_assignment.role = 'INSTRUCTOR'
    ), '{}'::uuid[])
  into v_manager_orgs, v_instructor_orgs
  from public.life_role_assignments role_assignment
  where role_assignment.person_id = v_person
    and role_assignment.valid_from <= now()
    and (role_assignment.valid_until is null or role_assignment.valid_until > now());

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'name', o.name,
        'org_id', o.org_id,
        'org_name', organization.name,
        'year', extract(year from project_year.starts_on)::integer,
        'year_label', project_year.label,
        'academy', course.academy,
        'capacity', o.capacity,
        'location', o.location,
        'starts_on', o.starts_on,
        'ends_on', o.ends_on,
        'manager', o.org_id = any(v_manager_orgs),
        'responsible', person.name,
        'plan_status', plan.status,
        'result_status', result.status
      ) order by o.starts_on desc, o.name
    )
    from public.life_offerings o
    join public.life_organizations organization on organization.id = o.org_id
    join public.life_project_years project_year on project_year.id = o.project_year_id
    join public.life_course_versions version on version.id = o.course_version_id
    join public.life_courses course on course.id = version.course_id
    left join public.life_operation_responsibilities responsibility on responsibility.offering_id = o.id
    left join public.life_people person on person.id = responsibility.person_id
    left join public.life_operation_documents plan on plan.offering_id = o.id and plan.kind = 'plan'
    left join public.life_operation_documents result on result.offering_id = o.id and result.kind = 'result'
    where o.org_id = any(v_manager_orgs)
      or (
        responsibility.person_id = v_person
        and o.org_id = any(v_instructor_orgs)
        and exists (
          select 1
          from public.life_offering_instructors assignment
          where assignment.offering_id = o.id
            and assignment.person_id = v_person
            and (assignment.valid_until is null or assignment.valid_until > now())
        )
      )
  ), '[]'::jsonb);
end;
$function$;
