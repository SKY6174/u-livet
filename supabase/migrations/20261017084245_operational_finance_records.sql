begin;

-- Operational projections only. Original money, allocations, states and snapshots
-- remain the source of truth for all financial writes and balance calculations.
create view life_private.operational_invoices with (security_invoker=true) as
 select i.* from public.life_invoices i
 where life_private.operational_offering(i.offering_id)
 and not exists(select 1 from life_private.non_operational_members m where m.person_id=i.person_id);

create view life_private.operational_refunds with (security_invoker=true) as
 select r.* from public.life_refunds r
 join life_private.operational_invoices i on i.id=r.invoice_id;

create view life_private.operational_refund_transfers with (security_invoker=true) as
 select t.* from public.life_refund_transfers t
 join life_private.operational_refunds r on r.id=t.refund_id;

-- Keep the bank transaction amount and compute a separate operational amount.
-- Subtract hidden allocations, never turn them into apparently unallocated cash.
-- A partial/unallocated normal payment must remain available for reconciliation.
create view life_private.operational_payments with (security_invoker=true) as
 select p.*,p.amount-hidden.amount as operational_amount
 from public.life_payments p
 cross join lateral (
  select coalesce(sum(a.amount),0)::bigint as amount
  from public.life_payment_allocations a
  where a.payment_id=p.id
  and not exists(select 1 from life_private.operational_invoices i where i.id=a.invoice_id)
 ) hidden
 where not exists(select 1 from life_private.non_operational_members m where m.person_id=p.person_id)
 and p.amount-hidden.amount<>0;

-- ID-based exclusion preserves unmatched historical person references.
create view life_private.operational_scholarship_rows with (security_invoker=true) as
 select r.offering_id,s.entry
 from public.life_course_reports r
 cross join lateral jsonb_array_elements(coalesce(r.payload->'scholarships','[]'::jsonb)) s(entry)
 where life_private.operational_offering(r.offering_id)
 and not exists(select 1 from life_private.non_operational_members m where m.person_id::text=s.entry->>'personId');

revoke all on life_private.operational_invoices,life_private.operational_refunds,
 life_private.operational_refund_transfers,life_private.operational_payments,
 life_private.operational_scholarship_rows from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION life_private.finance_overview(as_staff boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
 if life_private.person_id() is null then raise exception 'AUTH_REQUIRED';end if;
 if as_staff is null then raise exception 'INVALID_INPUT';end if;
 select jsonb_build_object(
 'permissions',coalesce((select jsonb_agg(jsonb_build_object('org_id',org_id,'permission',permission)) from public.life_finance_grants where person_id=life_private.person_id() and valid_from<=now() and valid_until>now() and life_private.has_role(org_id,'FINANCE')),'[]'::jsonb),
 'invoices',coalesce((select jsonb_agg(to_jsonb(z) order by z.created_at desc) from (
 select i.*,o.name as offering_name,p.name as person_name,pv.title as policy_title,pv.version as policy_version,pv.body as policy_body,c.instructions,
 t.paid,t.refunded,t.reserved,t.credited,i.amount-t.credited-t.paid+t.refunded as balance,
 coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.life_payment_reports r where r.invoice_id=i.id),'[]'::jsonb) as reports,
 coalesce((select jsonb_agg(to_jsonb(a)) from public.life_payment_allocations a where a.invoice_id=i.id),'[]'::jsonb) as allocations,
 coalesce((select jsonb_agg(to_jsonb(r)) from public.life_refund_rules r where r.policy_id=i.policy_id),'[]'::jsonb) as rules,
 coalesce((select jsonb_agg(to_jsonb(x) order by x.requested_at desc) from (select r.*,rr.label as rule_label,rr.basis as rule_basis,rr.numerator,rr.denominator,
 coalesce((select jsonb_agg(to_jsonb(tr) order by tr.started_at) from life_private.operational_refund_transfers tr where tr.refund_id=r.id),'[]'::jsonb) as transfers
 from life_private.operational_refunds r left join public.life_refund_rules rr on rr.id=r.rule_id where r.invoice_id=i.id)x),'[]'::jsonb) as refunds,
 coalesce((select jsonb_agg(jsonb_build_object('action',e.action,'details',e.details,'created_at',e.created_at) order by e.id) from public.life_finance_events e where e.invoice_id=i.id),'[]'::jsonb) as events
 from life_private.operational_invoices i join life_private.operational_offerings o on o.id=i.offering_id join public.life_people p on p.id=i.person_id
 join public.life_policy_versions pv on pv.id=i.policy_id join public.life_offering_finance c on c.offering_id=i.offering_id cross join lateral life_private.fin_totals(i.id)t
 where (as_staff and life_private.fin_staff(i.org_id)) or (not as_staff and i.person_id=life_private.person_id())
 order by i.created_at desc limit 100)z),'[]'::jsonb),
 'payments',coalesce((select jsonb_agg(to_jsonb(z) order by z.created_at desc) from (
 select p.*,pp.name as person_name,p.amount-coalesce((select sum(a.amount) from public.life_payment_allocations a where a.payment_id=p.id),0) as unallocated
 from life_private.operational_payments p join public.life_people pp on pp.id=p.person_id where (as_staff and life_private.fin_staff(p.org_id)) or (not as_staff and p.person_id=life_private.person_id()) order by p.created_at desc limit 100)z),'[]'::jsonb)
 ) into result;return result;
end $function$
;

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
   select count(*) as total,count(*) filter(where coalesce(s.entry->>'paidOn','')='') as unpaid
   from life_private.operational_scholarship_rows s where s.offering_id=o.id
 ) scholarships
 ) summaries;
 return result;
end $function$
;

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
    from public.life_class_sessions s left join public.life_attendance t on t.session_id=s.id and t.person_id=actor
    where s.offering_id=o.id),'[]'::jsonb) else '[]'::jsonb end,
  'lessons',case when e.status='ACTIVE' then coalesce((select jsonb_agg(jsonb_build_object(
    'id',l.id,'title',l.title,'position',l.position,'read',exists(select 1 from public.life_lesson_reads lr where lr.lesson_id=l.id and lr.person_id=actor)) order by l.position)
    from public.life_lessons l where l.offering_id=o.id and l.published),'[]'::jsonb) else '[]'::jsonb end
 ) item
 from public.life_applications a join life_private.operational_offerings o on o.id=a.offering_id
 join public.life_course_versions v on v.id=o.course_version_id join public.life_courses c on c.id=v.course_id
 left join public.life_enrollments e on e.application_id=a.id and e.person_id=actor
 where a.person_id=actor
 ) x),'[]'::jsonb),
 'scholarships',coalesce((select jsonb_agg(jsonb_build_object('offering_id',sr.offering_id,'name',o.name,
    'category',s->>'category','amount',s->'amount','paid_on',s->>'paidOn') order by o.ends_on desc)
  from life_private.operational_scholarship_rows sr join life_private.operational_offerings o on o.id=sr.offering_id
  cross join lateral (select sr.entry as s) scholarship
  where s->>'personId'=actor::text and exists(select 1 from public.life_enrollments e where e.offering_id=sr.offering_id and e.person_id=actor)),'[]'::jsonb),
 'organizations',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name) order by o.name)
  from life_private.learning_request_orgs() o),'[]'::jsonb),
 'requests',coalesce((select jsonb_agg(to_jsonb(r)-'person_id' order by r.created_at desc) from public.life_learning_requests r where r.person_id=actor),'[]'::jsonb)
 ) into result;
 return result;
end $function$
;

notify pgrst,'reload schema';
commit;
