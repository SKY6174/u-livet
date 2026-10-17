begin;

-- Resolve request-constant identity and active instructor scope once.
-- Existing academic exclusions, history, signatures, privileges and write paths stay intact.
CREATE OR REPLACE FUNCTION life_private.instructor_home_summary()
 RETURNS TABLE(offering_id uuid, learner_count bigint, ended_sessions bigint, attendance_records bigint, unanswered_questions bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with actor as materialized (select life_private.person_id() id),
  instructor_orgs as materialized (
    select distinct r.org_id from public.life_role_assignments r cross join actor p
    where r.person_id=p.id and r.role='INSTRUCTOR'
      and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())
  )
  select o.id,
    (select count(*) from life_private.operational_enrollments e where e.offering_id = o.id and e.status = 'ACTIVE'),
    (select count(*) from public.life_class_sessions s
      where s.offering_id = o.id and s.status = 'SCHEDULED' and s.ends_at <= now()),
    (select count(*) from life_private.operational_attendance a
      join public.life_class_sessions s on s.id = a.session_id
      where s.offering_id = o.id and s.status = 'SCHEDULED' and s.ends_at <= now()),
    (select count(*) from life_private.class_questions q where q.offering_id = o.id and q.answer_text is null)
  from public.life_offering_instructors i
  join life_private.operational_offerings o on o.id = i.offering_id
  cross join actor p
  join instructor_orgs allowed on allowed.org_id=o.org_id
  where i.person_id = p.id
    and (i.valid_until is null or i.valid_until > now())
  order by o.starts_on desc, o.id;
$function$
;

CREATE OR REPLACE FUNCTION life_private.completion_history()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select coalesce(jsonb_agg(jsonb_build_object('offering_id',o.id,'name',o.name,'outcome',r.outcome,'reasons',r.reasons,'calculated_at',r.calculated_at,'approved_at',a.approved_at,'stale',r.input_revision is distinct from o.academic_revision or not life_private.policy_valid((r.evidence->>'policy_id')::uuid,o.org_id,'COMPLETION'))),'[]'::jsonb)
 from life_private.operational_enrollments e join life_private.operational_offerings o on o.id=e.offering_id
 left join lateral(select * from life_private.operational_completion_runs where enrollment_id=e.id order by calculated_at desc,id desc limit 1) r on true
 left join life_private.operational_completion_approvals a on a.run_id=r.id where e.person_id=(select life_private.person_id())
$function$
;

commit;
