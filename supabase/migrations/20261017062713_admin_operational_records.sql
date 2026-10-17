begin;

-- Preserve original course/application/consent/approval rows. This private,
-- explicit classification survives renaming and can be reversed by its owner.
create table life_private.non_operational_offerings (
 offering_id uuid primary key references public.life_offerings(id),
 reason text not null check (length(btrim(reason)) between 1 and 500),
 classified_at timestamptz not null default now()
);
alter table life_private.non_operational_offerings enable row level security;
revoke all on life_private.non_operational_offerings from public,anon,authenticated,service_role;
comment on table life_private.non_operational_offerings is
 'Preserved verification records excluded from operational read models; not a deletion or status change.';
insert into life_private.non_operational_offerings(offering_id,reason)
select id,'기존 검증·테스트 과정의 운영 화면 제외'
from public.life_offerings where id in (
 '1420f824-721a-41d7-afd2-9d3d62206406',
 'e81e85df-4cc8-408f-b284-64954298fa78',
 '17ec60a5-a00e-4989-9a47-3dcfb29f099e',
 '4f2f7080-6225-4080-8ec2-0755f7ba5f40'
);

-- Only a classification boolean is exposed. Null keeps genuinely unlinked
-- application PDFs in the desk instead of dropping them through an inner join.
create function life_private.operational_offering(f uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select not exists(select 1 from life_private.non_operational_offerings x where x.offering_id=f)
$$;
revoke all on function life_private.operational_offering(uuid) from public,anon,authenticated,service_role;
grant execute on function life_private.operational_offering(uuid) to anon,authenticated;

create view life_private.operational_offerings with(security_invoker=true) as
 select o.* from public.life_offerings o where life_private.operational_offering(o.id);
revoke all on life_private.operational_offerings from public,anon,authenticated,service_role;

-- The existing catalog is security_invoker, so it retains existing RLS and
-- also requires this restrictive predicate. Existing permissive policies stay.
create policy life_operational_offerings_read on public.life_offerings
 as restrictive for select to anon,authenticated
 using (life_private.operational_offering(id));

-- Existing signatures, institution/MFA authorization and ACLs are retained.
-- Definer read models use the same classified relation before aggregation,
-- search, status selection, limits or pagination. Write/evidence RPCs stay intact.

-- Operational read: admin_learner_documents
CREATE OR REPLACE FUNCTION life_private.admin_learner_documents(k text DEFAULT NULL::text, s text DEFAULT NULL::text, q text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare authorized jsonb:=life_private.admin_learner_documents_base(k,s,q); ids uuid[];
begin
 select array_agg((x.value->>'id')::uuid) into ids from jsonb_array_elements(authorized->'requests') x(value);
 return authorized||jsonb_build_object(
  'requests',coalesce((with registration as materialized (select * from life_private.document_registration_states(ids))
   select jsonb_agg(x.value||jsonb_build_object('registration',r.registration) order by x.ordinality)
   from jsonb_array_elements(authorized->'requests') with ordinality x(value,ordinality)
   left join registration r on r.request_id=(x.value->>'id')::uuid),'[]'::jsonb),
  'offerings',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'org_id',o.org_id,'name',o.name,'status',o.status,'starts_on',o.starts_on,'ends_on',o.ends_on) order by o.starts_on desc,o.name)
   from life_private.operational_offerings o where life_private.manages(o.id) and o.status<>'ARCHIVED' and not o.academic_sealed
    and o.ends_on>=(now() at time zone 'Asia/Seoul')::date),'[]'::jsonb));
end$function$;

-- Operational read: admin_learner_documents_base
CREATE OR REPLACE FUNCTION life_private.admin_learner_documents_base(k text DEFAULT NULL::text, s text DEFAULT NULL::text, q text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  p uuid:=life_private.person_id();
  normalized_query text:=nullif(btrim(q),'');
begin
  if (k is not null and k not in ('APPLICATION','SCHOLARSHIP','REFUND'))
    or (s is not null and s not in ('RECEIVED','REVIEWING','APPROVED','REJECTED','COMPLETED','CANCELLED'))
    or length(coalesce(q,''))>100 then raise exception 'INVALID_INPUT';end if;
  if p is null or not life_private.mfa_verified() then raise exception 'FORBIDDEN';end if;
  if not exists(
    select 1 from public.life_role_assignments ra
    where ra.person_id=p and ra.role in ('SYSTEM_ADMIN','COURSE_MANAGER','FINANCE')
      and ra.valid_from<=now() and (ra.valid_until is null or ra.valid_until>now())
  ) then raise exception 'FORBIDDEN';end if;

  return (
    with authorized_orgs as materialized (
      select distinct ra.org_id
      from public.life_role_assignments ra
      where ra.person_id=p and ra.role in ('SYSTEM_ADMIN','COURSE_MANAGER','FINANCE')
        and ra.valid_from<=now() and (ra.valid_until is null or ra.valid_until>now())
    ), selected_requests as materialized (
      select r.*
      from public.life_learner_document_requests r
      join authorized_orgs ao on ao.org_id=r.org_id
      where life_private.operational_offering(r.offering_id) and r.deleted_at is null and (k is null or r.kind=k) and (s is null or r.status=s)
        and (normalized_query is null or r.course_name ilike '%'||normalized_query||'%'
          or r.applicant_name ilike '%'||normalized_query||'%')
      order by r.submitted_at desc,r.id
      limit 500
    )
    select jsonb_build_object(
      'organizations',coalesce((
        select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name) order by o.name)
        from public.life_organizations o join authorized_orgs ao on ao.org_id=o.id
      ),'[]'::jsonb),
      'requests',coalesce((
        select jsonb_agg(row_to_json(x) order by x.submitted_at desc,x.id) from (
          select r.id,r.org_id,r.offering_id,r.kind,r.course_name,r.applicant_name,r.phone_masked,
            r.refund_occurrence,r.amount,r.status,r.current_note,r.revision,r.submitted_at,r.updated_at,
            r.resolved_at,rv.name reviewer_name,
            coalesce((
              select jsonb_agg(jsonb_build_object(
                'id',e.id,'from_status',e.from_status,'to_status',e.to_status,'note',e.note,
                'created_at',e.created_at,'actor_name',a.name
              ) order by e.created_at,e.id)
              from public.life_learner_document_events e
              left join public.life_people a on a.id=e.actor_id
              where e.request_id=r.id
            ),'[]'::jsonb) events
          from selected_requests r
          left join public.life_people rv on rv.id=r.reviewer_id
        ) x
      ),'[]'::jsonb)
    )
  );
end$function$;

-- Operational read: annual_board
CREATE OR REPLACE FUNCTION life_private.annual_board(y uuid, a text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_year public.life_project_years;v_frame jsonb;
begin
 select * into v_year from public.life_project_years where id=y;
 if v_year.id is null or not life_private.annual_read(v_year.org_id) then raise exception 'FORBIDDEN';end if;
 v_frame:=life_private.annual_frame(y);
 return jsonb_build_object('year',to_jsonb(v_year),'generated_at',now(),'can_prepare',life_private.annual_can(v_year.org_id,'PREPARE'),'can_approve',life_private.annual_can(v_year.org_id,'APPROVE'),
 'academies',coalesce((select jsonb_agg(distinct c.academy) from life_private.operational_offerings o join public.life_course_versions v on v.id=o.course_version_id join public.life_courses c on c.id=v.course_id where o.project_year_id=y),'[]'::jsonb),
 'facts',case when a is null then v_frame->'snapshot'->'facts' else life_private.annual_facts(y,a) end,'metrics',v_frame->'snapshot'->'metrics',
 'reports',coalesce((select jsonb_agg(to_jsonb(x) order by version desc) from (select id,version,status,created_at,approved_at,reason,supersedes_id,fingerprint<>v_frame->>'fingerprint' stale from public.life_performance_reports where year_id=y order by version desc limit 100)x),'[]'::jsonb));
end $function$;

-- Operational read: application_detail
CREATE OR REPLACE FUNCTION life_private.application_detail(a uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v public.life_applications; manager boolean; result jsonb;
begin
 select * into v from public.life_applications where id=a;
 manager:=life_private.manages(v.offering_id);
 if v.id is null or life_private.person_id() is null or (not manager and v.person_id is distinct from life_private.person_id()) then raise exception 'FORBIDDEN'; end if;
 if not life_private.operational_offering(v.offering_id) then raise exception 'FORBIDDEN'; end if;
 select jsonb_build_object('application',jsonb_build_object('id',v.id,'person_id',p.id,'name',p.name,'active',p.active,'offering_id',o.id,'course_name',o.name,'status',v.status,'submitted_at',v.submitted_at,'enrollment_status',e.status),
 'contact',jsonb_build_object('email',coalesce(u.email,mm.email),'phone',coalesce(mp.mobile_phone,lc.phone)),
 'history',coalesce((select jsonb_agg(x order by x.created_at,x.id) from (
   select r.id,r.previous_status,r.next_status,r.reason,r.created_at,actor.name actor_name from life_private.application_reviews r join public.life_people actor on actor.id=r.actor_id where r.application_id=a
   union all
   select -ev.id,null,substring(ev.action from 13),'',ev.created_at,actor.name from public.life_audit_events ev left join public.life_people actor on actor.id=ev.actor_id
   where ev.entity_id=a and ev.action in ('APPLICATION_ACCEPTED','APPLICATION_REJECTED','APPLICATION_CANCELLED')
     and not exists(select 1 from life_private.application_reviews r where r.application_id=a and r.created_at between ev.created_at-interval '1 second' and ev.created_at+interval '1 second')
 ) x),'[]'::jsonb)) into result
 from public.life_people p join life_private.operational_offerings o on o.id=v.offering_id
 left join public.life_enrollments e on e.application_id=a
 left join public.life_auth_links l on l.person_id=p.id left join auth.users u on u.id=l.auth_user_id
 left join life_private.manual_members mm on mm.person_id=p.id left join life_private.member_profiles mp on mp.person_id=p.id
 left join life_private.learner_contacts lc on lc.user_id=l.auth_user_id where p.id=v.person_id;
 return result;
end $function$;

-- Operational read: course_introductions
CREATE OR REPLACE FUNCTION life_private.course_introductions(f uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, name text, academy text, summary text, curriculum text, mode text, location text, capacity integer, tuition integer, selection_method text, status text, apply_from timestamp with time zone, apply_until timestamp with time zone, starts_on date, ends_on date, year_label text, completion_policy_id uuid, created_at timestamp with time zone, org_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select o.id, o.name, c.academy, v.summary, v.curriculum,
    o.mode, o.location, o.capacity, o.tuition, o.selection_method, o.status,
    o.apply_from, o.apply_until, o.starts_on, o.ends_on, y.label,
    case when o.status in ('PUBLISHED','CLOSED') then v.completion_policy_id end,
    o.created_at, o.org_id
  from life_private.operational_offerings o
  join public.life_course_versions v on v.id=o.course_version_id and v.org_id=o.org_id
  join public.life_courses c on c.id=v.course_id and c.org_id=o.org_id
  join public.life_project_years y on y.id=o.project_year_id and y.org_id=o.org_id
  where (f is null or o.id=f)
    and (o.status in ('PUBLISHED','CLOSED')
      or (o.status='ARCHIVED' and o.public_introduction))
$function$;

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
end $function$;

-- Operational read: finance_overview
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
 coalesce((select jsonb_agg(to_jsonb(tr) order by tr.started_at) from public.life_refund_transfers tr where tr.refund_id=r.id),'[]'::jsonb) as transfers
 from public.life_refunds r left join public.life_refund_rules rr on rr.id=r.rule_id where r.invoice_id=i.id)x),'[]'::jsonb) as refunds,
 coalesce((select jsonb_agg(jsonb_build_object('action',e.action,'details',e.details,'created_at',e.created_at) order by e.id) from public.life_finance_events e where e.invoice_id=i.id),'[]'::jsonb) as events
 from public.life_invoices i join life_private.operational_offerings o on o.id=i.offering_id join public.life_people p on p.id=i.person_id
 join public.life_policy_versions pv on pv.id=i.policy_id join public.life_offering_finance c on c.offering_id=i.offering_id cross join lateral life_private.fin_totals(i.id)t
 where (as_staff and life_private.fin_staff(i.org_id)) or (not as_staff and i.person_id=life_private.person_id())
 order by i.created_at desc limit 100)z),'[]'::jsonb),
 'payments',coalesce((select jsonb_agg(to_jsonb(z) order by z.created_at desc) from (
 select p.*,pp.name as person_name,p.amount-coalesce((select sum(a.amount) from public.life_payment_allocations a where a.payment_id=p.id),0) as unallocated
 from public.life_payments p join public.life_people pp on pp.id=p.person_id where (as_staff and life_private.fin_staff(p.org_id)) or (not as_staff and p.person_id=life_private.person_id()) order by p.created_at desc limit 100)z),'[]'::jsonb)
 ) into result;return result;
end $function$;

-- Operational read: management_application_rows
CREATE OR REPLACE FUNCTION life_private.management_application_rows()
 RETURNS TABLE(id uuid, person_id uuid, name text, active boolean, offering_id uuid, course_name text, status text, submitted_at timestamp with time zone, enrollment_status text, document_id uuid, document_status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 with documents as (
  select d.*,row_number() over(partition by d.person_id,d.offering_id order by case when d.status in ('REJECTED','CANCELLED') then 1 else 0 end,d.submitted_at desc,d.id) position
  from public.life_learner_document_requests d where life_private.operational_offering(d.offering_id) and d.kind='APPLICATION' and d.deleted_at is null
   and ((d.offering_id is not null and life_private.manages(d.offering_id)) or (d.offering_id is null and life_private.has_role(d.org_id,'COURSE_MANAGER')))
 )
 select a.id,a.person_id,p.name,p.active,a.offering_id,o.name,a.status,a.submitted_at,e.status,d.id,d.status
 from public.life_applications a join life_private.operational_offerings o on o.id=a.offering_id join public.life_people p on p.id=a.person_id
 left join public.life_enrollments e on e.application_id=a.id
 left join documents d on d.person_id=a.person_id and d.offering_id=a.offering_id and d.position=1
 where life_private.manages(o.id)
 union all
 select d.id,d.person_id,p.name,p.active,d.offering_id,coalesce(o.name,d.course_name),d.status,d.submitted_at,null,d.id,d.status
 from documents d join public.life_people p on p.id=d.person_id left join life_private.operational_offerings o on o.id=d.offering_id
 where (d.offering_id is null or d.position=1) and not exists(select 1 from public.life_applications a where a.person_id=d.person_id and a.offering_id=d.offering_id)
$function$;

-- Operational read: management_courses
CREATE OR REPLACE FUNCTION life_private.management_courses()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name) order by o.starts_on desc,o.name),'[]'::jsonb)
 from life_private.operational_offerings o where life_private.manages(o.id)
$function$;

-- Operational read: message_options
CREATE OR REPLACE FUNCTION life_private.message_options()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if life_private.person_id() is null then raise exception 'AUTH_REQUIRED';end if;
 return jsonb_build_object(
 'offerings',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'org_id',o.org_id,'name',o.name) order by o.created_at desc) from life_private.operational_offerings o where life_private.manages(o.id)),'[]'::jsonb),
 'templates',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'org_id',t.org_id,'title',t.title,'kind',t.kind,'audience',t.audience,'version',t.version,'body',t.body) order by t.title) from public.life_message_templates t where enabled and life_private.has_role(org_id,'COURSE_MANAGER')),'[]'::jsonb)
 );
end $function$;

-- Operational read: message_overview
CREATE OR REPLACE FUNCTION life_private.message_overview(j uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if life_private.person_id() is null then raise exception 'AUTH_REQUIRED';end if;
 if j is not null and not exists(select 1 from public.life_message_jobs where id=j and life_private.has_role(org_id,'COURSE_MANAGER')) then raise exception 'FORBIDDEN';end if;
 return coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at desc) from (
 select x.id,x.offering_id,x.status,x.mode,x.scheduled_at,x.created_at,x.expires_at,x.body,o.name,t.title,t.version,t.kind,t.audience,
 (select count(*) from public.life_message_deliveries where job_id=x.id) total,
 coalesce((select jsonb_object_agg(state,n) from (select state,count(*) n from public.life_message_deliveries where job_id=x.id group by state)s),'{}'::jsonb) counts,
 coalesce((select jsonb_object_agg(reason,n) from (select reason,count(*) n from public.life_message_deliveries where job_id=x.id and state='SKIPPED' group by reason)s),'{}'::jsonb) exclusions,
 case when j is not null then coalesce((select jsonb_agg(to_jsonb(s)) from (select d.state,d.reason,c.masked_label label from public.life_message_deliveries d left join life_private.message_contacts c on c.id=d.contact_id where d.job_id=x.id order by d.id limit 5)s),'[]'::jsonb) else '[]'::jsonb end samples,
 case when j is not null then coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from (select e.id,e.action,e.created_at from public.life_message_events e where e.job_id=x.id order by e.id desc limit 100)e),'[]'::jsonb) else '[]'::jsonb end events
 from public.life_message_jobs x join life_private.operational_offerings o on o.id=x.offering_id join public.life_message_templates t on t.id=x.template_id
 where (j is null or x.id=j) and life_private.has_role(x.org_id,'COURSE_MANAGER') order by x.created_at desc limit 100
 )q),'[]'::jsonb);
end $function$;

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
    'members',coalesce((select jsonb_agg(jsonb_build_object('person_id',p.id,'name',p.name) order by p.name,p.id) from public.life_enrollments e join public.life_people p on p.id=e.person_id where e.offering_id=f and e.status='ACTIVE'),'[]'::jsonb),
    'documents',coalesce((select jsonb_agg(to_jsonb(d)-'offering_id'-'updated_by'-'reviewed_by'-'submitted_by') from public.life_operation_documents d where d.offering_id=f),'[]'::jsonb),
    'legacy',(select r.payload-'participants'-'scholarships'-'fees' from public.life_course_reports r where r.offering_id=f),
    'sessions',coalesce((select jsonb_agg(jsonb_build_object('title',s.title,'starts_at',s.starts_at,'ends_at',s.ends_at) order by s.starts_at) from public.life_class_sessions s where s.offering_id=f and s.status='SCHEDULED'),'[]'::jsonb),
    'submissions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'kind',s.kind,'revision',s.revision,'submitted_at',s.submitted_at,'name',p.name) order by s.submitted_at desc) from public.life_operation_submissions s join public.life_people p on p.id=s.submitted_by where s.offering_id=f),'[]'::jsonb)
  );
end$function$;

-- Operational read: operation_list
CREATE OR REPLACE FUNCTION life_private.operation_list()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_person uuid;
  v_manager_orgs uuid[];
  v_instructor_orgs uuid[];
begin
  if auth.uid() is null or not life_private.mfa_verified() then
    raise exception 'FORBIDDEN';
  end if;

  v_person := life_private.person_id();
  if v_person is null then
    return '[]'::jsonb;
  end if;

  select
    coalesce(array_agg(distinct role_assignment.org_id) filter (
      where role_assignment.role in ('COURSE_MANAGER', 'SYSTEM_ADMIN')
    ), '{}'::uuid[]),
    coalesce(array_agg(distinct role_assignment.org_id) filter (
      where role_assignment.role = 'INSTRUCTOR'
    ), '{}'::uuid[])
  into v_manager_orgs, v_instructor_orgs
  from public.life_role_assignments role_assignment
  where role_assignment.person_id = v_person
    and role_assignment.valid_from <= now()
    and (role_assignment.valid_until is null or role_assignment.valid_until > now());

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
        'manager', o.org_id = any(v_manager_orgs),
        'responsible', person.name,
        'plan_status', plan.status,
        'result_status', result.status
      ) order by o.starts_on desc, o.name
    )
    from life_private.operational_offerings o
    join public.life_organizations organization on organization.id = o.org_id
    join public.life_project_years project_year on project_year.id = o.project_year_id
    join public.life_course_versions version on version.id = o.course_version_id
    join public.life_courses course on course.id = version.course_id
    left join public.life_operation_responsibilities responsibility on responsibility.offering_id = o.id
    left join public.life_people person on person.id = responsibility.person_id
    left join public.life_operation_documents plan on plan.offering_id = o.id and plan.kind = 'plan'
    left join public.life_operation_documents result on result.offering_id = o.id and result.kind = 'result'
    where o.org_id = any(v_manager_orgs)
      or (
        responsibility.person_id = v_person
        and o.org_id = any(v_instructor_orgs)
        and exists (
          select 1
          from public.life_offering_instructors assignment
          where assignment.offering_id = o.id
            and assignment.person_id = v_person
            and (assignment.valid_until is null or assignment.valid_until > now())
        )
      )
  ), '[]'::jsonb);
end;
$function$;

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
 exists(select 1 from public.life_completion_runs hr join public.life_completion_approvals ha on ha.run_id=hr.id where hr.enrollment_id=e.id) previously_approved
 from public.life_enrollments e join cohort o on o.id=e.offering_id left join lateral(select * from public.life_completion_runs rr where rr.enrollment_id=e.id order by rr.calculated_at desc,rr.id desc limit 1)r on true left join public.life_completion_approvals ca on ca.run_id=r.id
 ), quality as (
 select o.id,life_private.annual_survey_summary(o.id) survey,
 (select jsonb_build_object('id',r.id,'revision',r.revision,'decision',r.decision,'summary',r.summary,'created_at',r.created_at) from public.life_course_reviews r where r.offering_id=o.id order by r.revision desc limit 1) review,
 (select count(*) from public.life_improvement_actions i join public.life_course_reviews r on r.id=i.review_id where r.offering_id=o.id and i.status<>'VERIFIED') improvements_open,
 (select count(*) from public.life_improvement_actions i join public.life_course_reviews r on r.id=i.review_id where r.offering_id=o.id and i.status<>'VERIFIED' and i.due_on<(now() at time zone 'Asia/Seoul')::date) improvements_overdue
 from cohort o
 ), totals as (
 select jsonb_build_object('offerings',(select count(*) from cohort where status<>'DRAFT'),'planned_offerings',(select count(*) from cohort where status='DRAFT'),
 'course_origins',(select count(distinct course_id) from cohort where status<>'DRAFT'),
 'applications',(select count(*) from public.life_applications ap join cohort o on o.id=ap.offering_id),
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
 'applications',coalesce((select jsonb_agg(to_jsonb(ap) order by ap.id) from public.life_applications ap join cohort o on o.id=ap.offering_id),'[]'::jsonb),
 'quality',coalesce((select jsonb_agg(to_jsonb(q) order by id) from quality q),'[]'::jsonb),
 'actions',coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.life_improvement_actions i join public.life_course_reviews r on r.id=i.review_id join cohort o on o.id=r.offering_id),'[]'::jsonb)) value
 ) select jsonb_build_object('query_version','COHORT_CURRENT_V1','totals',totals.value,'offerings',coalesce((select jsonb_agg(to_jsonb(r) order by starts_on,id) from rows r),'[]'::jsonb),'fingerprint',encode(extensions.digest(convert_to(proof.value::text,'UTF8'),'sha256'),'hex')) from totals,proof
$function$;

-- Operational read: badge_options
CREATE OR REPLACE FUNCTION life_private.badge_options()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if life_private.person_id() is null then raise exception 'AUTH_REQUIRED';end if;
 return jsonb_build_object(
 'offerings',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'org_id',o.org_id,'manager',life_private.manages(o.id)) order by o.created_at desc) from life_private.operational_offerings o where life_private.badge_staff(o.org_id)),'[]'::jsonb),
 'issuers',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'org_id',a.org_id,'name',a.organization_name,'test_only',a.test_only,'can_issue',life_private.can_issue(a.id,'BADGE'))) from public.life_issuer_authorizations a where life_private.badge_staff(a.org_id) and life_private.issuer_valid(a.id)),'[]'::jsonb),
 'policies',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'org_id',p.org_id,'title',p.title,'version',p.version,'body',p.body)) from public.life_policy_versions p where life_private.badge_staff(p.org_id) and life_private.policy_valid(p.id,p.org_id,'BADGE')),'[]'::jsonb));
end $function$;

-- Operational read: certificate_list
CREATE OR REPLACE FUNCTION life_private.certificate_list()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'offering_id',r.offering_id,'org_id',o.org_id,'evidence',life_private.certificate_evidence(r.offering_id,r.person_id,r.kind),'person_id',r.person_id,'person_name',p.name,'course_name',o.name,'kind',r.kind,'status',r.status,'reason',r.reason,'requested_at',r.requested_at,'issue_id',i.id,'number',i.certificate_no,'state',case when i.id is not null then life_private.cert_effective(i.id) end,'last_error',i.last_error) order by r.requested_at desc),'[]'::jsonb)
 from public.life_certificate_requests r join life_private.operational_offerings o on o.id=r.offering_id join public.life_people p on p.id=r.person_id left join public.life_certificate_issues i on i.request_id=r.id
 where r.person_id=life_private.person_id() or life_private.certificate_staff(o.org_id)
$function$;

-- Operational read: instructor_home_summary
CREATE OR REPLACE FUNCTION life_private.instructor_home_summary()
 RETURNS TABLE(offering_id uuid, learner_count bigint, ended_sessions bigint, attendance_records bigint, unanswered_questions bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select o.id,
    (select count(*) from public.life_enrollments e where e.offering_id = o.id and e.status = 'ACTIVE'),
    (select count(*) from public.life_class_sessions s
      where s.offering_id = o.id and s.status = 'SCHEDULED' and s.ends_at <= now()),
    (select count(*) from public.life_attendance a
      join public.life_class_sessions s on s.id = a.session_id
      where s.offering_id = o.id and s.status = 'SCHEDULED' and s.ends_at <= now()),
    (select count(*) from life_private.class_questions q where q.offering_id = o.id and q.answer_text is null)
  from public.life_offering_instructors i
  join life_private.operational_offerings o on o.id = i.offering_id
  where i.person_id = life_private.person_id()
    and (i.valid_until is null or i.valid_until > now())
    and life_private.has_role(o.org_id, 'INSTRUCTOR')
  order by o.starts_on desc, o.id;
$function$;

-- Operational read: teaching_records
CREATE OR REPLACE FUNCTION life_private.teaching_records()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'session_id',s.id,'offering_id',o.id,'course_name',o.name,
 'session_title',s.title,'starts_at',s.starts_at,'ends_at',s.ends_at,'person_id',l.person_id,'person_name',p.name,
 'minutes',l.minutes,'notes',l.notes,'revision',l.revision,'approved_at',l.approved_at,
 'segments',l.segments,'signature',l.signature,'signed_at',l.signed_at,'signed_revision',l.signed_revision,
 'current',coalesce(l.approved_revision=l.revision and l.session_snapshot=to_jsonb(s),false)) order by l.submitted_at desc),'[]'::jsonb)
 from public.life_teaching_logs l join public.life_people p on p.id=l.person_id
 join public.life_class_sessions s on s.id=l.session_id join life_private.operational_offerings o on o.id=s.offering_id
 where l.person_id=life_private.person_id() or life_private.manages(o.id)
$function$;

notify pgrst,'reload schema';
commit;
