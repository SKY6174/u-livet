-- Include the current responsible instructor in the already authorized,
-- organization-and-year scoped budget overview. The manager page no longer
-- needs to load the full operation document list for this single value.
create or replace function life_private.course_budget_overview(o uuid, y integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not life_private.course_budget_allowed(o) then raise exception 'FORBIDDEN'; end if;
  return jsonb_build_object(
    'courses', coalesce((
      select jsonb_agg(to_jsonb(g) || jsonb_build_object(
        'source_id', b.source_id,
        'initial_instructor_name', p.name,
        'initial_instructor_verified', exists (
          select 1 from public.life_auth_links link where link.person_id = g.initial_instructor_id
        ),
        'initial_responsible_name', responsible.name,
        'initial_responsible_verified', exists (
          select 1 from public.life_auth_links link where link.person_id = g.initial_responsible_id
        ),
        'current_responsible_name', current_responsible.name,
        'budget', jsonb_build_object(
          'program_id', coalesce(b.program_id, ''), 'revision', coalesce(b.revision, 0),
          'updated_at', b.updated_at, 'materials', b.materials, 'printing', b.printing,
          'instructors', b.instructors, 'operations', b.operations, 'support', b.support,
          'scholarships', b.scholarships
        )
      ) order by g.sort_order)
      from public.life_course_guides g
      left join public.life_course_budgets b on b.guide_id = g.id and b.org_id = o
      left join public.life_people p on p.id = g.initial_instructor_id and p.active
      left join public.life_people responsible on responsible.id = g.initial_responsible_id and responsible.active
      left join public.life_operation_responsibilities current_assignment on current_assignment.offering_id = g.offering_id
      left join public.life_people current_responsible on current_responsible.id = current_assignment.person_id
      where g.year = y and g.org_id = o
    ), '[]'::jsonb),
    'workbooks', coalesce((
      select jsonb_agg(v order by v.created_at desc) from (
        select w.id, w.file_name, w.sheet_name, w.created_at,
          jsonb_array_length(w.rows) as row_count, w.header_row
        from public.life_budget_workbooks w
        where w.org_id = o and w.year = y
        order by w.created_at desc limit 50
      ) v
    ), '[]'::jsonb)
  );
end $$;
