begin;

-- Classification must not depend on whether a learner can currently read a
-- session/unpublished assignment. Their own normal historical records remain
-- readable under the existing ownership policy after withdrawal.
create function life_private.operational_attendance_reference(s uuid,p uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select life_private.operational_academic_context(c.offering_id,p)
 from public.life_class_sessions c where c.id=s),false)
$$;
create function life_private.operational_submission_reference(a uuid,p uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select life_private.operational_academic_context(t.offering_id,p)
 from public.life_assignments t where t.id=a),false)
$$;
revoke all on function life_private.operational_attendance_reference(uuid,uuid),
 life_private.operational_submission_reference(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function life_private.operational_attendance_reference(uuid,uuid),
 life_private.operational_submission_reference(uuid,uuid) to authenticated;
alter policy life_operational_attendance_read on public.life_attendance
 using(life_private.operational_attendance_reference(session_id,person_id));
alter policy life_operational_submissions_read on public.life_submissions
 using(life_private.operational_submission_reference(assignment_id,person_id));

notify pgrst,'reload schema';
commit;
