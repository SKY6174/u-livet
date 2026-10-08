begin;

-- Only add the already-public organization ID to the public introduction.
-- The public scope and private work-record permissions stay unchanged.
drop function public.life_course_introductions(uuid);
drop function life_private.course_introductions(uuid);

create function life_private.course_introductions(f uuid default null)
returns table (
  id uuid, name text, academy text, summary text, curriculum text,
  mode text, location text, capacity integer, tuition integer,
  selection_method text, status text, apply_from timestamptz,
  apply_until timestamptz, starts_on date, ends_on date, year_label text,
  completion_policy_id uuid, created_at timestamptz, org_id uuid
)
language sql stable security definer set search_path='' as $$
  select o.id, o.name, c.academy, v.summary, v.curriculum,
    o.mode, o.location, o.capacity, o.tuition, o.selection_method, o.status,
    o.apply_from, o.apply_until, o.starts_on, o.ends_on, y.label,
    case when o.status in ('PUBLISHED','CLOSED') then v.completion_policy_id end,
    o.created_at, o.org_id
  from public.life_offerings o
  join public.life_course_versions v on v.id=o.course_version_id and v.org_id=o.org_id
  join public.life_courses c on c.id=v.course_id and c.org_id=o.org_id
  join public.life_project_years y on y.id=o.project_year_id and y.org_id=o.org_id
  where (f is null or o.id=f)
    and (o.status in ('PUBLISHED','CLOSED')
      or (o.status='ARCHIVED' and o.public_introduction))
$$;

create function public.life_course_introductions(f uuid default null)
returns table (
  id uuid, name text, academy text, summary text, curriculum text,
  mode text, location text, capacity integer, tuition integer,
  selection_method text, status text, apply_from timestamptz,
  apply_until timestamptz, starts_on date, ends_on date, year_label text,
  completion_policy_id uuid, created_at timestamptz, org_id uuid
)
language sql stable security invoker set search_path='' as $$
  select * from life_private.course_introductions(f)
$$;

revoke all on function life_private.course_introductions(uuid),
  public.life_course_introductions(uuid) from public, anon, authenticated, service_role;
grant execute on function life_private.course_introductions(uuid),
  public.life_course_introductions(uuid) to anon, authenticated;

notify pgrst,'reload schema';
commit;
