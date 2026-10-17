begin;

-- Explicit ID classifications affect operational reads, never academic writes,
-- original scores/revisions, frozen evidence, approvals or issuance validity.
create function life_private.operational_academic_context(f uuid,p uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select life_private.operational_offering(f)
 and not exists(select 1 from life_private.non_operational_members m where m.person_id=p)
$$;
revoke all on function life_private.operational_academic_context(uuid,uuid) from public,anon,authenticated,service_role;
-- Restrictive SELECT policies need this boolean, not access to classifications.
grant execute on function life_private.operational_academic_context(uuid,uuid) to authenticated;

create view life_private.operational_enrollments with(security_invoker=true) as
 select e.* from public.life_enrollments e
 where life_private.operational_academic_context(e.offering_id,e.person_id);
create view life_private.operational_attendance with(security_invoker=true) as
 select a.* from public.life_attendance a join public.life_class_sessions s on s.id=a.session_id
 where life_private.operational_academic_context(s.offering_id,a.person_id);
create view life_private.operational_submissions with(security_invoker=true) as
 select s.* from public.life_submissions s join public.life_assignments a on a.id=s.assignment_id
 where life_private.operational_academic_context(a.offering_id,s.person_id);
create view life_private.operational_submission_grades with(security_invoker=true) as
 select g.* from public.life_submission_grades g join life_private.operational_submissions s on s.id=g.submission_id;
create view life_private.operational_quiz_attempts with(security_invoker=true) as
 select a.* from public.life_quiz_attempts a join public.life_quizzes q on q.id=a.quiz_id
 where life_private.operational_academic_context(q.offering_id,a.person_id);
create view life_private.operational_quiz_results with(security_invoker=true) as
 select r.* from life_private.quiz_results r join life_private.operational_quiz_attempts a on a.id=r.attempt_id;
create view life_private.operational_completion_runs with(security_invoker=true) as
 select r.* from public.life_completion_runs r join life_private.operational_enrollments e on e.id=r.enrollment_id
 where life_private.operational_academic_context(r.offering_id,r.person_id);
create view life_private.operational_completion_approvals with(security_invoker=true) as
 select a.* from public.life_completion_approvals a join life_private.operational_completion_runs r on r.id=a.run_id;
create view life_private.operational_qr_checkins with(security_invoker=true) as
 select q.* from life_private.qr_attendance_checkins q join public.life_class_sessions s on s.id=q.session_id
 where life_private.operational_academic_context(s.offering_id,q.person_id);
revoke all on life_private.operational_enrollments,life_private.operational_attendance,
 life_private.operational_submissions,life_private.operational_submission_grades,
 life_private.operational_quiz_attempts,life_private.operational_quiz_results,
 life_private.operational_completion_runs,life_private.operational_completion_approvals,
 life_private.operational_qr_checkins from public,anon,authenticated,service_role;

-- Existing ownership/institution/MFA policies and all grants remain in force.
-- Child grades/approvals inherit the same filter through their existing parent
-- EXISTS policies. No INSERT/UPDATE/DELETE or privileged write helper changes.
create policy life_operational_enrollments_read on public.life_enrollments
 as restrictive for select to authenticated
 using(life_private.operational_academic_context(offering_id,person_id));
create policy life_operational_attendance_read on public.life_attendance
 as restrictive for select to authenticated
 using(exists(select 1 from public.life_class_sessions s where s.id=session_id
 and life_private.operational_academic_context(s.offering_id,person_id)));
create policy life_operational_submissions_read on public.life_submissions
 as restrictive for select to authenticated
 using(exists(select 1 from public.life_assignments a where a.id=assignment_id
 and life_private.operational_academic_context(a.offering_id,person_id)));
create policy life_operational_completion_runs_read on public.life_completion_runs
 as restrictive for select to authenticated
 using(life_private.operational_academic_context(offering_id,person_id));


-- Operational read: attendance_book
CREATE OR REPLACE FUNCTION life_private.attendance_book(f uuid, staff boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p uuid:=life_private.person_id(); result jsonb;
begin
 if not life_private.operational_offering(f) then raise exception 'FORBIDDEN';end if;
 if p is null or not (case when staff then life_private.teaches(f) or life_private.manages(f) else life_private.enrolled(f) end) then raise exception 'FORBIDDEN'; end if;
 select jsonb_build_object(
  'offering',jsonb_build_object('id',o.id,'name',o.name,'starts_on',o.starts_on,'ends_on',o.ends_on),
  'viewer_id',p,'generated_at',now(),
  'members',coalesce((select jsonb_agg(jsonb_build_object('person_id',e.person_id,'name',person.name) order by person.name,e.person_id)
    from life_private.operational_enrollments e join public.life_people person on person.id=e.person_id
    where e.offering_id=f and e.status='ACTIVE' and (staff or e.person_id=p)),'[]'::jsonb),
  'sessions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'starts_at',s.starts_at,'ends_at',s.ends_at,
    'status',s.status,'replaces_id',s.replaces_id,'reason',s.reason) order by s.starts_at,s.id)
    from public.life_class_sessions s where s.offering_id=f),'[]'::jsonb),
  'attendance',coalesce((select jsonb_agg(jsonb_build_object('session_id',a.session_id,'person_id',a.person_id,
    'credited_minutes',a.credited_minutes,'reason',a.reason,'revision',a.revision,'recorded_at',a.recorded_at))
    from public.life_class_sessions s join life_private.operational_attendance a on a.session_id=s.id
    join life_private.operational_enrollments e on e.offering_id=f and e.person_id=a.person_id and e.status='ACTIVE'
    where s.offering_id=f and (staff or a.person_id=p)),'[]'::jsonb)
 ) into result from life_private.operational_offerings o where o.id=f;
 if result is null then raise exception 'FORBIDDEN'; end if;
 return result;
end $function$
;

-- Operational read: qr_checkins
CREATE OR REPLACE FUNCTION life_private.qr_checkins(f uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p uuid := life_private.person_id(); staff boolean := life_private.teaches(f) or life_private.manages(f);
begin
 if not life_private.operational_offering(f) then raise exception 'FORBIDDEN';end if;
  if p is null or not (staff or life_private.enrolled(f)) then raise exception 'FORBIDDEN'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('session_id', q.session_id,
    'person_id', q.person_id, 'checked_in_at', q.checked_in_at, 'checked_out_at', q.checked_out_at) order by q.checked_in_at)
    from life_private.operational_qr_checkins q join public.life_class_sessions c on c.id = q.session_id
    join life_private.operational_enrollments e on e.person_id = q.person_id and e.offering_id = f and e.status = 'ACTIVE'
    where c.offering_id = f and (staff or q.person_id = p)), '[]'::jsonb);
end $function$
;

-- Operational read: exam_room
CREATE OR REPLACE FUNCTION life_private.exam_room(f uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not life_private.operational_offering(f) then raise exception 'FORBIDDEN';end if;
 if not (life_private.enrolled(f) or life_private.teaches(f)) then raise exception 'FORBIDDEN'; end if;
 return jsonb_build_object('quizzes',coalesce((select jsonb_agg(to_jsonb(q)-'questions' order by q.opens_at) from public.life_quizzes q where offering_id=f),'[]'::jsonb),
 'attempts',coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object('status',case when a.status='OPEN' and now()>=a.expires_at then 'EXPIRED' else a.status end,'score',case when life_private.teaches(f) or now()>=q.closes_at then r.score end)) from life_private.operational_quiz_attempts a join public.life_quizzes q on q.id=a.quiz_id left join life_private.operational_quiz_results r on r.attempt_id=a.id where q.offering_id=f and (a.person_id=life_private.person_id() or life_private.teaches(f))),'[]'::jsonb));
end $function$
;

-- Operational read: completion_board
CREATE OR REPLACE FUNCTION life_private.completion_board(f uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare threshold numeric;
begin
 if not life_private.operational_offering(f) then raise exception 'FORBIDDEN';end if;
 if not (life_private.manages(f) or life_private.reviews(f)) then raise exception 'FORBIDDEN';end if;
 threshold:=life_private.completion_attendance_threshold(f);
 return coalesce((
  select jsonb_agg(jsonb_build_object(
   'person_id',p.id,'name',p.name,'enrollment_status',e.status,
   'run',to_jsonb(r),'approval',to_jsonb(a),
   'stale',r.input_revision is distinct from o.academic_revision
     or not life_private.policy_valid((r.evidence->>'policy_id')::uuid,o.org_id,'COMPLETION'),
   'attendance_percent',att.rate,
   'attendance_threshold',threshold,
   'attendance_complete',att.total>0 and att.finished=att.total and att.recorded=att.total,
   'attendance_eligible',e.status='ACTIVE' and att.total>0 and att.finished=att.total
      and att.recorded=att.total and att.rate>=threshold,
   'refund',rf.data,'refund_document',rd.data) order by p.name)
  from life_private.operational_enrollments e
  join public.life_people p on p.id=e.person_id
  join life_private.operational_offerings o on o.id=e.offering_id
  left join lateral(select * from life_private.operational_completion_runs
    where enrollment_id=e.id order by calculated_at desc,id desc limit 1) r on true
  left join life_private.operational_completion_approvals a on a.run_id=r.id
  left join lateral(
   select count(*)::integer total,
    count(*) filter(where s.ends_at<=now())::integer finished,
    count(*) filter(where s.ends_at<=now() and at.session_id is not null)::integer recorded,
    round(100*sum(at.credited_minutes) filter(where s.ends_at<=now()) /
     nullif(sum(extract(epoch from s.ends_at-s.starts_at)/60)
      filter(where s.ends_at<=now()),0),2) rate
   from public.life_class_sessions s
   left join life_private.operational_attendance at on at.session_id=s.id and at.person_id=p.id
   where s.offering_id=f and s.status='SCHEDULED') att on true
  left join lateral(
   select jsonb_build_object('status',q.status,'requested_at',q.requested_at) data
   from public.life_refunds q join public.life_invoices i on i.id=q.invoice_id
   where i.offering_id=f and i.person_id=p.id and q.status<>'REJECTED'
    and (q.requested_at at time zone 'Asia/Seoul')::date>=o.starts_on
   order by q.requested_at desc,q.id desc limit 1) rf on true
  left join lateral(
   select jsonb_build_object('status',d.status,'submitted_at',d.submitted_at) data
   from public.life_learner_document_requests d
   where d.offering_id=f and d.person_id=p.id and d.kind='REFUND'
    and d.refund_occurrence<>'before-start' and d.status not in ('REJECTED','CANCELLED')
   order by d.submitted_at desc,d.id desc limit 1) rd on true
  where e.offering_id=f),'[]'::jsonb);
end$function$
;

-- Operational read: completion_history
CREATE OR REPLACE FUNCTION life_private.completion_history()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select coalesce(jsonb_agg(jsonb_build_object('offering_id',o.id,'name',o.name,'outcome',r.outcome,'reasons',r.reasons,'calculated_at',r.calculated_at,'approved_at',a.approved_at,'stale',r.input_revision is distinct from o.academic_revision or not life_private.policy_valid((r.evidence->>'policy_id')::uuid,o.org_id,'COMPLETION'))),'[]'::jsonb)
 from life_private.operational_enrollments e join life_private.operational_offerings o on o.id=e.offering_id
 left join lateral(select * from life_private.operational_completion_runs where enrollment_id=e.id order by calculated_at desc,id desc limit 1) r on true
 left join life_private.operational_completion_approvals a on a.run_id=r.id where e.person_id=life_private.person_id()
$function$
;

-- Operational read: instructor_completion
CREATE OR REPLACE FUNCTION life_private.instructor_completion(f uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not life_private.operational_offering(f) then raise exception 'FORBIDDEN';end if;
 if life_private.person_id() is null or not life_private.teaches(f) then raise exception 'FORBIDDEN'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('person_id',p.id,'name',p.name,'outcome',r.outcome,
   'reasons',r.reasons,'approved_at',a.approved_at,'stale',r.id is not null and
   (r.input_revision is distinct from o.academic_revision or not o.academic_sealed
    or not life_private.policy_valid((r.evidence->>'policy_id')::uuid,o.org_id,'COMPLETION'))) order by p.name)
 from life_private.operational_enrollments e join public.life_people p on p.id=e.person_id join life_private.operational_offerings o on o.id=e.offering_id
 left join lateral(select * from life_private.operational_completion_runs where enrollment_id=e.id order by calculated_at desc,id desc limit 1) r on true
 left join life_private.operational_completion_approvals a on a.run_id=r.id where e.offering_id=f and e.status='ACTIVE'),'[]'::jsonb);
end $function$
;

-- Operational read: instructor_home_summary
CREATE OR REPLACE FUNCTION life_private.instructor_home_summary()
 RETURNS TABLE(offering_id uuid, learner_count bigint, ended_sessions bigint, attendance_records bigint, unanswered_questions bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  where i.person_id = life_private.person_id()
    and (i.valid_until is null or i.valid_until > now())
    and life_private.has_role(o.org_id, 'INSTRUCTOR')
  order by o.starts_on desc, o.id;
$function$
;

-- Operational read: course_workspace
CREATE OR REPLACE FUNCTION life_private.course_workspace(f uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
 if auth.uid() is null or not life_private.mfa_verified() then raise exception 'FORBIDDEN'; end if;
 if f is not null and not life_private.manages(f) then raise exception 'FORBIDDEN'; end if;
 with managed_orgs as materialized (
   select id from public.life_organizations where life_private.has_role(id,'COURSE_MANAGER')
 ), scoped as materialized (
   select o.* from life_private.operational_offerings o join managed_orgs m on m.id=o.org_id where f is null or o.id=f
 )
 select coalesce(jsonb_agg(item order by created_at desc, id),'[]'::jsonb) into result
 from (
 select o.id,o.created_at,jsonb_build_object(
   'id',o.id,'org_id',o.org_id,'name',o.name,'status',o.status,'capacity',o.capacity,
   'starts_on',o.starts_on,'ends_on',o.ends_on,'year_label',y.label,'academy',c.academy,'location',o.location,
   'instructors',(select count(*) from public.life_offering_instructors i where i.offering_id=o.id and (i.valid_until is null or i.valid_until>now())),
   'application_pending',(select count(*) from public.life_applications a where a.offering_id=o.id and a.status in ('SUBMITTED','WAITLISTED')),
   'enrolled',members.enrolled,'completed',members.completed,'completion_pending',members.pending,
   'scheduled_sessions',sessions.scheduled,'ended_sessions',sessions.ended,'education_hours',sessions.hours,
   'attendance_expected',members.enrolled*sessions.ended,'attendance_recorded',attendance.recorded,
   'missing_attendance',greatest(members.enrolled*sessions.ended-attendance.recorded,0),
   'teaching_logs',teaching.total,'teaching_pending',teaching.pending,
   'report_revision',r.revision,'report_updated_at',r.updated_at,'operator',coalesce(r.payload->>'operator',''),
   'report_missing',(select coalesce(jsonb_agg(label),'[]'::jsonb) from (values
      ('operator','운영 담당자'),('professor','담당 교수'),('program','프로그램명'),('reportDate','보고일'),('content','주요 내용')
    ) fields(key,label) where btrim(coalesce(r.payload->>key,''))=''),
   'document_kinds',files.kinds,'result_file_id',files.result_id,
   'fee_count',fees.total,'fee_unpaid',fees.unpaid,'fee_total',fees.amount,
   'scholarship_count',scholarships.total,'scholarship_unpaid',scholarships.unpaid,
   'budget_spent',(select coalesce(sum((b->>'spent')::numeric),0) from jsonb_array_elements(coalesce(r.payload->'budgets','[]'::jsonb)) b),
   'source',case when o.status='ARCHIVED' and r.payload->'sourceReport' is not null then jsonb_build_object(
     'enrolled',(r.payload#>>'{sourceReport,enrolled}')::integer,
     'completed',(r.payload#>>'{sourceReport,completed}')::integer,
     'hours',(r.payload#>>'{sourceReport,educationHours}')::numeric,
     'classes',(r.payload#>>'{sourceReport,classCount}')::integer,
     'scholarship_amount',(r.payload#>>'{sourceReport,scholarshipAmount}')::numeric) else null end
 ) as item
 from scoped o join public.life_project_years y on y.id=o.project_year_id
 join public.life_course_versions v on v.id=o.course_version_id join public.life_courses c on c.id=v.course_id
 left join public.life_course_reports r on r.offering_id=o.id
 cross join lateral (
   select count(*) as enrolled,
     count(*) filter(where latest.outcome='READY' and approval.run_id is not null and
       latest.input_revision=o.academic_revision and life_private.policy_valid((latest.evidence->>'policy_id')::uuid,o.org_id,'COMPLETION')) as completed,
     count(*) filter(where latest.id is null or latest.input_revision is distinct from o.academic_revision or
       not life_private.policy_valid((latest.evidence->>'policy_id')::uuid,o.org_id,'COMPLETION') or
       latest.outcome='NEEDS_REVIEW' or (latest.outcome='READY' and approval.run_id is null)) as pending
   from life_private.operational_enrollments e
   left join lateral (
     select cr.id,cr.outcome,cr.input_revision,cr.evidence from life_private.operational_completion_runs cr
     where cr.offering_id=o.id and cr.person_id=e.person_id and cr.enrollment_id=e.id
     order by cr.calculated_at desc,cr.id desc limit 1
   ) latest on true
   left join life_private.operational_completion_approvals approval on approval.run_id=latest.id
   where e.offering_id=o.id and e.status='ACTIVE'
 ) members
 cross join lateral (
   select count(*) as scheduled,count(*) filter(where s.ends_at<=now()) as ended,
     coalesce(round(sum(extract(epoch from s.ends_at-s.starts_at)/3600),2),0) as hours
   from public.life_class_sessions s where s.offering_id=o.id and s.status='SCHEDULED'
 ) sessions
 cross join lateral (
   select count(*) as recorded from life_private.operational_attendance a
   join public.life_class_sessions s on s.id=a.session_id
   join life_private.operational_enrollments e on e.offering_id=s.offering_id and e.person_id=a.person_id and e.status='ACTIVE'
   where s.offering_id=o.id and s.status='SCHEDULED' and s.ends_at<=now()
 ) attendance
 cross join lateral (
   select count(*) as total,count(*) filter(where not coalesce(l.approved_revision=l.revision and l.session_snapshot=to_jsonb(s),false)) as pending
   from public.life_teaching_logs l join public.life_class_sessions s on s.id=l.session_id
   where s.offering_id=o.id and s.status='SCHEDULED'
 ) teaching
 cross join lateral (
   select coalesce(jsonb_agg(distinct kind) filter(where kind<>'photo'),'[]'::jsonb) as kinds,
     (max(id::text) filter(where kind='result'))::uuid as result_id
   from public.life_report_files where offering_id=o.id
 ) files
 cross join lateral (
   select count(*) as total,count(*) filter(where coalesce(entry->>'paidOn','')='') as unpaid,
     coalesce(sum(floor((entry->>'hours')::numeric*(entry->>'rate')::numeric)),0) as amount
   from jsonb_array_elements(coalesce(r.payload->'fees','[]'::jsonb)) entry
 ) fees
 cross join lateral (
   select count(*) as total,count(*) filter(where coalesce(s.entry->>'paidOn','')='') as unpaid
   from life_private.operational_scholarship_rows s where s.offering_id=o.id
 ) scholarships
 ) summaries;
 return result;
end $function$
;

-- Operational read: course_report
CREATE OR REPLACE FUNCTION life_private.course_report(f uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not life_private.operational_offering(f) then raise exception 'FORBIDDEN';end if;
 if auth.uid() is null or not life_private.manages(f) then raise exception 'FORBIDDEN';end if;
 return jsonb_build_object(
 'report',(select to_jsonb(r)-'offering_id'-'updated_by' from public.life_course_reports r where offering_id=f),
 'members',life_private.completion_board(f),
 'sessions',coalesce((select jsonb_agg(s order by starts_at) from public.life_class_sessions s where offering_id=f),'[]'::jsonb),
 'attendance',coalesce((select jsonb_agg(a) from life_private.operational_attendance a join public.life_class_sessions s on s.id=a.session_id where s.offering_id=f),'[]'::jsonb),
 'teaching',coalesce((select jsonb_agg(to_jsonb(l)||jsonb_build_object('name',p.name,'topic',l.notes,'confirmed_at',l.submitted_at,'current',coalesce(l.approved_revision=l.revision and l.session_snapshot=to_jsonb(s),false)) order by s.starts_at,p.name) from public.life_teaching_logs l join public.life_class_sessions s on s.id=l.session_id join public.life_people p on p.id=l.person_id where s.offering_id=f and s.status='SCHEDULED'),'[]'::jsonb),
 'files',coalesce((select jsonb_agg(jsonb_build_object('id',id,'kind',kind,'filename',filename,'mime',mime,'size',size,'caption',caption,'created_at',created_at) order by created_at) from public.life_report_files where offering_id=f),'[]'::jsonb));
end $function$
;

-- Operational read: my_learning
CREATE OR REPLACE FUNCTION life_private.my_learning()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    from public.life_class_sessions s left join life_private.operational_attendance t on t.session_id=s.id and t.person_id=actor
    where s.offering_id=o.id),'[]'::jsonb) else '[]'::jsonb end,
  'lessons',case when e.status='ACTIVE' then coalesce((select jsonb_agg(jsonb_build_object(
    'id',l.id,'title',l.title,'position',l.position,'read',exists(select 1 from public.life_lesson_reads lr where lr.lesson_id=l.id and lr.person_id=actor)) order by l.position)
    from public.life_lessons l where l.offering_id=o.id and l.published),'[]'::jsonb) else '[]'::jsonb end
 ) item
 from public.life_applications a join life_private.operational_offerings o on o.id=a.offering_id
 join public.life_course_versions v on v.id=o.course_version_id join public.life_courses c on c.id=v.course_id
 left join life_private.operational_enrollments e on e.application_id=a.id and e.person_id=actor
 where a.person_id=actor and life_private.operational_academic_context(a.offering_id,a.person_id)
 ) x),'[]'::jsonb),
 'scholarships',coalesce((select jsonb_agg(jsonb_build_object('offering_id',sr.offering_id,'name',o.name,
    'category',s->>'category','amount',s->'amount','paid_on',s->>'paidOn') order by o.ends_on desc)
  from life_private.operational_scholarship_rows sr join life_private.operational_offerings o on o.id=sr.offering_id
  cross join lateral (select sr.entry as s) scholarship
  where s->>'personId'=actor::text and exists(select 1 from life_private.operational_enrollments e where e.offering_id=sr.offering_id and e.person_id=actor)),'[]'::jsonb),
 'organizations',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name) order by o.name)
  from life_private.learning_request_orgs() o),'[]'::jsonb),
 'requests',coalesce((select jsonb_agg(to_jsonb(r)-'person_id' order by r.created_at desc) from public.life_learning_requests r where r.person_id=actor),'[]'::jsonb)
 ) into result;
 return result;
end $function$
;

-- Operational read: operation_context
CREATE OR REPLACE FUNCTION life_private.operation_context(f uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not life_private.operation_access(f) or not life_private.operational_offering(f) then raise exception 'FORBIDDEN'; end if;
  return jsonb_build_object(
    'manager',life_private.operation_manager(f),
    'course',(select jsonb_build_object('id',o.id,'name',o.name,'academy',c.academy,'starts_on',o.starts_on,'ends_on',o.ends_on,'capacity',o.capacity,'summary',v.summary,'curriculum',v.curriculum,'location',o.location,'status',o.status,'org_id',o.org_id) from life_private.operational_offerings o join public.life_course_versions v on v.id=o.course_version_id join public.life_courses c on c.id=v.course_id where o.id=f),
    'responsible',(
      select jsonb_build_object(
        'person_id',r.person_id,
        'name',p.name,
        'affiliation',coalesce(nullif(trim(pool.affiliation),''),organization.name),
        'revision',r.revision
      )
      from public.life_operation_responsibilities r
      join public.life_people p on p.id=r.person_id
      join life_private.operational_offerings offering on offering.id=r.offering_id
      join public.life_organizations organization on organization.id=offering.org_id
      left join life_private.instructor_pool pool
        on pool.org_id=offering.org_id
       and pool.person_id=r.person_id
       and pool.status='ACTIVE'
      where r.offering_id=f
    ),
    'candidates',case when life_private.operation_manager(f) then coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name) order by p.name) from public.life_offering_instructors i join public.life_people p on p.id=i.person_id join life_private.operational_offerings o on o.id=i.offering_id where i.offering_id=f and p.active and (i.valid_until is null or i.valid_until>now()) and life_private.instructor_eligible(o.org_id,p.id)),'[]'::jsonb) else '[]'::jsonb end,
    'members',coalesce((select jsonb_agg(jsonb_build_object('person_id',p.id,'name',p.name) order by p.name,p.id) from life_private.operational_enrollments e join public.life_people p on p.id=e.person_id where e.offering_id=f and e.status='ACTIVE'),'[]'::jsonb),
    'documents',coalesce((select jsonb_agg(to_jsonb(d)-'offering_id'-'updated_by'-'reviewed_by'-'submitted_by') from public.life_operation_documents d where d.offering_id=f),'[]'::jsonb),
    'legacy',(select r.payload-'participants'-'scholarships'-'fees' from public.life_course_reports r where r.offering_id=f),
    'sessions',coalesce((select jsonb_agg(jsonb_build_object('title',s.title,'starts_at',s.starts_at,'ends_at',s.ends_at) order by s.starts_at) from public.life_class_sessions s where s.offering_id=f and s.status='SCHEDULED'),'[]'::jsonb),
    'submissions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'kind',s.kind,'revision',s.revision,'submitted_at',s.submitted_at,'name',p.name) order by s.submitted_at desc) from public.life_operation_submissions s join public.life_people p on p.id=s.submitted_by where s.offering_id=f),'[]'::jsonb)
  );
end$function$
;

-- Operational read: annual_facts
CREATE OR REPLACE FUNCTION life_private.annual_facts(y uuid, a text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 with cohort as (
 select o.*,c.academy,c.id course_id,v.completion_policy_id,py.starts_on year_start,py.ends_on year_end
 from life_private.operational_offerings o join public.life_course_versions v on v.id=o.course_version_id join public.life_courses c on c.id=v.course_id join public.life_project_years py on py.id=o.project_year_id
 where o.project_year_id=y and (a is null or c.academy=a)
 ), enrollment as (
 select e.*,r.id run_id,r.input_revision,r.outcome,r.evidence->>'policy_id' run_policy,ca.approved_at,
 coalesce(e.status='ACTIVE' and r.outcome='READY' and ca.run_id is not null and r.input_revision=o.academic_revision and o.academic_sealed and (r.evidence->>'policy_id')::uuid=o.completion_policy_id and life_private.policy_valid(o.completion_policy_id,o.org_id,'COMPLETION'),false) completed,
 e.status='ACTIVE' and o.ends_on<(now() at time zone 'Asia/Seoul')::date and (r.id is null or r.input_revision<>o.academic_revision or r.outcome='NEEDS_REVIEW' or (r.outcome='READY' and ca.run_id is null)) unresolved,
 exists(select 1 from life_private.operational_completion_runs hr join life_private.operational_completion_approvals ha on ha.run_id=hr.id where hr.enrollment_id=e.id) previously_approved
 from life_private.operational_enrollments e join cohort o on o.id=e.offering_id left join lateral(select * from life_private.operational_completion_runs rr where rr.enrollment_id=e.id order by rr.calculated_at desc,rr.id desc limit 1)r on true left join life_private.operational_completion_approvals ca on ca.run_id=r.id
 ), quality as (
 select o.id,life_private.annual_survey_summary(o.id) survey,
 (select jsonb_build_object('id',r.id,'revision',r.revision,'decision',r.decision,'summary',r.summary,'created_at',r.created_at) from public.life_course_reviews r where r.offering_id=o.id order by r.revision desc limit 1) review,
 (select count(*) from public.life_improvement_actions i join public.life_course_reviews r on r.id=i.review_id where r.offering_id=o.id and i.status<>'VERIFIED') improvements_open,
 (select count(*) from public.life_improvement_actions i join public.life_course_reviews r on r.id=i.review_id where r.offering_id=o.id and i.status<>'VERIFIED' and i.due_on<(now() at time zone 'Asia/Seoul')::date) improvements_overdue
 from cohort o
 ), totals as (
 select jsonb_build_object('offerings',(select count(*) from cohort where status<>'DRAFT'),'planned_offerings',(select count(*) from cohort where status='DRAFT'),
 'course_origins',(select count(distinct course_id) from cohort where status<>'DRAFT'),
 'applications',(select count(*) from public.life_applications ap join cohort o on o.id=ap.offering_id and life_private.operational_academic_context(ap.offering_id,ap.person_id)),
 'enrolled_people',count(distinct person_id),'enrollments',count(*),'active',count(*) filter(where status='ACTIVE'),'withdrawn',count(*) filter(where status='WITHDRAWN'),
 'completed_people',count(distinct person_id) filter(where completed),'completions',count(*) filter(where completed),'completion_rate',round(100.0*count(*) filter(where completed)/nullif(count(*),0),2),
 'completion_review',count(*) filter(where unresolved or (previously_approved and not completed)),
 'unresolved',count(*) filter(where unresolved),'stale_completions',count(*) filter(where previously_approved and not completed),
 'boundary_issues',(select count(*) from cohort where status<>'DRAFT' and (starts_on<year_start or ends_on>year_end)),
 'improvements_open',(select coalesce(sum(improvements_open),0) from quality),'improvements_overdue',(select coalesce(sum(improvements_overdue),0) from quality)) value from enrollment
 ), rows as (
 select o.id,o.name,o.academy,o.status,o.starts_on,o.ends_on,o.academic_revision,
 (select count(*) from enrollment e where e.offering_id=o.id) enrollments,
 (select count(*) from enrollment e where e.offering_id=o.id and completed) completions,q.survey,q.review,q.improvements_open,q.improvements_overdue
 from cohort o join quality q on q.id=o.id
 ), proof as (
 select jsonb_build_object('offerings',coalesce((select jsonb_agg(to_jsonb(o) order by id) from cohort o),'[]'::jsonb),
 'enrollments',coalesce((select jsonb_agg(to_jsonb(e) order by id) from enrollment e),'[]'::jsonb),
 'applications',coalesce((select jsonb_agg(to_jsonb(ap) order by ap.id) from public.life_applications ap join cohort o on o.id=ap.offering_id and life_private.operational_academic_context(ap.offering_id,ap.person_id)),'[]'::jsonb),
 'quality',coalesce((select jsonb_agg(to_jsonb(q) order by id) from quality q),'[]'::jsonb),
 'actions',coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.life_improvement_actions i join public.life_course_reviews r on r.id=i.review_id join cohort o on o.id=r.offering_id),'[]'::jsonb)) value
 ) select jsonb_build_object('query_version','COHORT_CURRENT_V1','totals',totals.value,'offerings',coalesce((select jsonb_agg(to_jsonb(r) order by starts_on,id) from rows r),'[]'::jsonb),'fingerprint',encode(extensions.digest(convert_to(proof.value::text,'UTF8'),'sha256'),'hex')) from totals,proof
$function$
;

-- Operational read: roster
CREATE OR REPLACE FUNCTION life_private.roster(f uuid)
 RETURNS TABLE(application_id uuid, person_id uuid, name text, status text, submitted_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not life_private.operational_offering(f) then raise exception 'FORBIDDEN';end if;
  if not (life_private.manages(f) or life_private.teaches(f)) then raise exception 'FORBIDDEN'; end if;
  return query select a.id,p.id,p.name,a.status,a.submitted_at from public.life_applications a join public.life_people p on p.id=a.person_id
    where a.offering_id=f and life_private.operational_academic_context(a.offering_id,a.person_id) and (life_private.manages(f) or a.status='ACCEPTED') order by a.submitted_at;
end $function$
;

notify pgrst,'reload schema';
commit;
