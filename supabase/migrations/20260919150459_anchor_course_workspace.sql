begin;

-- Aggregate only the current manager's organizations. No participant/file bodies
-- or bank details leave this read API; the existing scoped write RPCs are reused.
create function life_private.course_workspace(f uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not life_private.mfa_verified() then raise exception 'FORBIDDEN'; end if;
 if f is not null and not life_private.manages(f) then raise exception 'FORBIDDEN'; end if;
 with managed_orgs as materialized (
   select id from public.life_organizations where life_private.has_role(id,'COURSE_MANAGER')
 ), scoped as materialized (
   select o.* from public.life_offerings o join managed_orgs m on m.id=o.org_id where f is null or o.id=f
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
   from public.life_enrollments e
   left join lateral (
     select cr.id,cr.outcome,cr.input_revision,cr.evidence from public.life_completion_runs cr
     where cr.offering_id=o.id and cr.person_id=e.person_id and cr.enrollment_id=e.id
     order by cr.calculated_at desc,cr.id desc limit 1
   ) latest on true
   left join public.life_completion_approvals approval on approval.run_id=latest.id
   where e.offering_id=o.id and e.status='ACTIVE'
 ) members
 cross join lateral (
   select count(*) as scheduled,count(*) filter(where s.ends_at<=now()) as ended,
     coalesce(round(sum(extract(epoch from s.ends_at-s.starts_at)/3600),2),0) as hours
   from public.life_class_sessions s where s.offering_id=o.id and s.status='SCHEDULED'
 ) sessions
 cross join lateral (
   select count(*) as recorded from public.life_attendance a
   join public.life_class_sessions s on s.id=a.session_id
   join public.life_enrollments e on e.offering_id=s.offering_id and e.person_id=a.person_id and e.status='ACTIVE'
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
   select count(*) as total,count(*) filter(where coalesce(entry->>'paidOn','')='') as unpaid
   from jsonb_array_elements(coalesce(r.payload->'scholarships','[]'::jsonb)) entry
 ) scholarships
 ) summaries;
 return result;
end $$;

create function public.life_course_workspace(f uuid default null) returns jsonb
language sql stable security invoker set search_path='' as $$select life_private.course_workspace(f)$$;
revoke all on function life_private.course_workspace(uuid),public.life_course_workspace(uuid) from public,anon,authenticated,service_role;
grant execute on function life_private.course_workspace(uuid),public.life_course_workspace(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
