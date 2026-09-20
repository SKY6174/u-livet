begin;

-- Publishing an introduction does not grant access to the archived work record.
alter table public.life_offerings
  add column public_introduction boolean not null default false;

create function life_private.course_introductions(f uuid default null)
returns table (
  id uuid, name text, academy text, summary text, curriculum text,
  mode text, location text, capacity integer, tuition integer,
  selection_method text, status text, apply_from timestamptz,
  apply_until timestamptz, starts_on date, ends_on date, year_label text,
  completion_policy_id uuid, created_at timestamptz
)
language sql stable security definer set search_path='' as $$
  select o.id, o.name, c.academy, v.summary, v.curriculum,
    o.mode, o.location, o.capacity, o.tuition, o.selection_method, o.status,
    o.apply_from, o.apply_until, o.starts_on, o.ends_on, y.label,
    case when o.status in ('PUBLISHED','CLOSED') then v.completion_policy_id end,
    o.created_at
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
  completion_policy_id uuid, created_at timestamptz
)
language sql stable security invoker set search_path='' as $$
  select * from life_private.course_introductions(f)
$$;

revoke all on function life_private.course_introductions(uuid),
  public.life_course_introductions(uuid) from public, anon, authenticated, service_role;
grant execute on function life_private.course_introductions(uuid),
  public.life_course_introductions(uuid) to anon, authenticated;

-- Explicitly approved existing introductions only; future archives stay private.
with published as (
  update public.life_offerings set public_introduction=true
  where org_id='10000000-0000-4000-8000-000000000001'
    and status='ARCHIVED' and not public_introduction
    and id in ('361eda75-8153-4b2b-86dc-3724a5105f17',
      '6f436e94-61df-4822-bea3-eccbf25b4c5b',
      '1e1e0bb6-f2b2-4b2a-b99f-127e462db915')
  returning id, org_id
)
insert into public.life_audit_events(org_id, actor_id, action, entity_id, details)
select org_id, null, 'COURSE_INTRODUCTION_PUBLISHED', id,
  jsonb_build_object('authorization_source','explicit_user_request',
    'scope','course_introduction_only','reports_public',false,
    'execution_context','database_migration')
from published;

notify pgrst,'reload schema';
commit;
