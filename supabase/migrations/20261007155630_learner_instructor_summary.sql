begin;

-- Keep existing approval, consent, role and assignment predicates for public names.
create or replace function life_private.id_public_instructors(f uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
   'name',p.name,'specialty',v.payload->>'specialty','introduction',v.payload->>'public_intro',
   'responsible',r.person_id is not null
 ) order by (r.person_id is not null) desc,p.name,p.id),'[]'::jsonb)
 from public.life_offerings o
 join public.life_offering_instructors a on a.offering_id=o.id
 join public.life_people p on p.id=a.person_id
 join public.life_instructor_dossiers d on d.person_id=p.id and d.org_id=o.org_id
 join lateral(select payload from public.life_instructor_dossier_versions
   where dossier_id=d.id order by version desc limit 1)v on true
 left join public.life_operation_responsibilities r
   on r.offering_id=a.offering_id and r.person_id=a.person_id
 where o.id=f and o.status in ('PUBLISHED','CLOSED')
   and (a.valid_until is null or a.valid_until>now())
   and d.public_enabled and life_private.id_dossier_current(d.org_id,p.id)
   and life_private.policy_valid(d.public_policy_id,d.org_id,'INSTRUCTOR_PUBLIC')
   and exists(select 1 from public.life_role_assignments
     where person_id=p.id and org_id=o.org_id and role='INSTRUCTOR'
       and valid_from<=now() and (valid_until is null or valid_until>now()))
$$;

-- A single narrow call for catalogue cards, retaining the public-profile boundary.
create function life_private.course_instructor_names(f uuid[])
returns table(offering_id uuid,name text,responsible boolean)
language sql stable security definer set search_path='' as $$
 select o.id,instructor->>'name',coalesce((instructor->>'responsible')::boolean,false)
 from public.life_offerings o
 cross join lateral jsonb_array_elements(life_private.id_public_instructors(o.id)) instructor
 where o.id=any(f) and o.status in ('PUBLISHED','CLOSED')
 order by o.id,coalesce((instructor->>'responsible')::boolean,false) desc,instructor->>'name'
$$;
create function public.life_course_instructor_names(f uuid[])
returns table(offering_id uuid,name text,responsible boolean)
language sql stable security invoker set search_path='' as $$
 select * from life_private.course_instructor_names(f)
$$;
revoke all on function life_private.course_instructor_names(uuid[]),
 public.life_course_instructor_names(uuid[]) from public,anon,authenticated,service_role;
grant execute on function life_private.course_instructor_names(uuid[]),
 public.life_course_instructor_names(uuid[]) to anon,authenticated;

-- Add exact responsibility flags without changing the existing learner-name array.
create or replace function life_private.my_learning() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=life_private.person_id(); result jsonb;
begin
 if auth.uid() is null or actor is null then raise exception 'FORBIDDEN';end if;
 select jsonb_build_object(
 'courses',coalesce((select jsonb_agg(x.item order by x.submitted_at desc) from (
 select a.submitted_at,jsonb_build_object(
  'application_id',a.id,'status',a.status,'submitted_at',a.submitted_at,
  'id',o.id,'name',o.name,'academy',c.academy,'course_id',c.id,'mode',o.mode,'location',o.location,
  'starts_on',o.starts_on,'ends_on',o.ends_on,'active',coalesce(e.status='ACTIVE',false),
  'instructors',case when e.status='ACTIVE' then coalesce((select jsonb_agg(p.name order by p.name)
    from public.life_offering_instructors i join public.life_people p on p.id=i.person_id
    where i.offering_id=o.id and (i.valid_until is null or i.valid_until>now())),'[]'::jsonb) else '[]'::jsonb end,
  'instructor_roster',case when e.status='ACTIVE' then coalesce((
    select jsonb_agg(jsonb_build_object('name',p.name,'responsible',r.person_id is not null)
      order by (r.person_id is not null) desc,p.name,p.id)
    from public.life_offering_instructors i
    join public.life_people p on p.id=i.person_id
    left join public.life_operation_responsibilities r
      on r.offering_id=i.offering_id and r.person_id=i.person_id
    where i.offering_id=o.id and (i.valid_until is null or i.valid_until>now())
  ),'[]'::jsonb) else '[]'::jsonb end,
  'completion', (select jsonb_build_object('title',p.title,'version',p.version,'body',p.body,
    'attendance_percent',r.attendance_percent,'assignment_min',r.assignment_min,'quiz_min',r.quiz_min)
    from public.life_policy_versions p left join public.life_completion_rules r on r.policy_id=p.id and r.approved_at is not null
    where p.id=v.completion_policy_id and p.org_id=o.org_id and p.status='APPROVED'),
  'sessions',case when e.status='ACTIVE' then coalesce((select jsonb_agg(jsonb_build_object(
    'id',s.id,'title',s.title,'starts_at',s.starts_at,'ends_at',s.ends_at,'status',s.status,
    'replaces_id',s.replaces_id,'reason',s.reason,'credited_minutes',t.credited_minutes) order by s.starts_at,s.id)
    from public.life_class_sessions s left join public.life_attendance t on t.session_id=s.id and t.person_id=actor
    where s.offering_id=o.id),'[]'::jsonb) else '[]'::jsonb end,
  'lessons',case when e.status='ACTIVE' then coalesce((select jsonb_agg(jsonb_build_object(
    'id',l.id,'title',l.title,'position',l.position,'read',exists(select 1 from public.life_lesson_reads lr where lr.lesson_id=l.id and lr.person_id=actor)) order by l.position)
    from public.life_lessons l where l.offering_id=o.id and l.published),'[]'::jsonb) else '[]'::jsonb end
 ) item
 from public.life_applications a join public.life_offerings o on o.id=a.offering_id
 join public.life_course_versions v on v.id=o.course_version_id join public.life_courses c on c.id=v.course_id
 left join public.life_enrollments e on e.application_id=a.id and e.person_id=actor
 where a.person_id=actor
 ) x),'[]'::jsonb),
 'scholarships',coalesce((select jsonb_agg(jsonb_build_object('offering_id',r.offering_id,'name',o.name,
    'category',s->>'category','amount',s->'amount','paid_on',s->>'paidOn') order by o.ends_on desc)
  from public.life_course_reports r join public.life_offerings o on o.id=r.offering_id
  cross join lateral jsonb_array_elements(coalesce(r.payload->'scholarships','[]'::jsonb)) s
  where s->>'personId'=actor::text and exists(select 1 from public.life_enrollments e where e.offering_id=r.offering_id and e.person_id=actor)),'[]'::jsonb),
 'organizations',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name) order by o.name)
  from life_private.learning_request_orgs() o),'[]'::jsonb),
 'requests',coalesce((select jsonb_agg(to_jsonb(r)-'person_id' order by r.created_at desc) from public.life_learning_requests r where r.person_id=actor),'[]'::jsonb)
 ) into result;
 return result;
end $$;

notify pgrst,'reload schema';
commit;
