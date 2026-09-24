-- Include authoritative institution, project year and academy values in the
-- already permission-scoped operation document list.
create or replace function life_private.operation_list()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not life_private.mfa_verified() then
    raise exception 'FORBIDDEN';
  end if;

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
        'manager', life_private.operation_manager(o.id),
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
    where life_private.operation_access(o.id)
  ), '[]'::jsonb);
end;
$$;
