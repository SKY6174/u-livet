begin;

-- Existing drafts need the new field before the exact-key schema changes.
update public.life_operation_documents
set content=jsonb_set(content,'{fields,completionAttendancePercent}','"80"'::jsonb),
    revision=revision+1,updated_at=now()
where kind='plan' and not (content->'fields' ? 'completionAttendancePercent');

alter function life_private.operation_schema(text) rename to operation_schema_before_completion;
create function life_private.operation_schema(k text) returns jsonb
language sql immutable set search_path='' as $$
 select case when k='plan' then
  jsonb_set(life_private.operation_schema_before_completion(k),'{fields}',
   (life_private.operation_schema_before_completion(k)->'fields') ||
   jsonb_build_array(jsonb_build_object('key','completionAttendancePercent',
    'label','수료 인정 최소 출석률 (%)','type','number','required',true,'max',12)))
 else life_private.operation_schema_before_completion(k) end
$$;

create or replace function life_private.operation_field(value jsonb,spec jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare s text;
begin
 if jsonb_typeof(value) is distinct from 'string' then return false;end if;
 s:=value#>>'{}';
 if length(s)>(spec->>'max')::integer then return false;end if;
 if s='' then return true;end if;
 if spec->>'type'='number' then
  return s~'^\d{1,9}(\.\d{1,2})?$'
   and (spec->>'key' not in ('ratio','satisfaction') or s::numeric<=100)
   and (spec->>'key'<>'completionAttendancePercent' or s::numeric between 80 and 100);
 end if;
 if spec->>'type'='date' then return s~'^\d{4}-\d{2}-\d{2}$' and to_char(s::date,'YYYY-MM-DD')=s;end if;
 if spec->>'type'='time' then return s~'^([01]\d|2[0-3]):[0-5]\d$';end if;
 return true;
 exception when others then return false;
end$$;

-- Historic submitted snapshots remain immutable; a missing field means 80%.
create function life_private.completion_attendance_threshold(f uuid) returns numeric
language sql stable security definer set search_path='' as $$
 select greatest(80::numeric,
  coalesce((select r.attendance_percent from public.life_offerings o
    join public.life_course_versions v on v.id=o.course_version_id
    join public.life_completion_rules r on r.policy_id=v.completion_policy_id
    where o.id=f and r.approved_at is not null),0),
  coalesce((select (s.content#>>'{fields,completionAttendancePercent}')::numeric
    from public.life_operation_submissions s
    where s.offering_id=f and s.kind='plan'
    order by s.submitted_at desc,s.id desc limit 1),0))
$$;

create function life_private.completion_plan_resubmitted() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.kind='plan' then
  update public.life_offerings set academic_revision=academic_revision+1 where id=new.offering_id;
 end if;
 return new;
end$$;
create trigger life_completion_plan_resubmitted
after insert on public.life_operation_submissions for each row
execute function life_private.completion_plan_resubmitted();

create or replace function life_private.calculate_completion(f uuid,p uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare
 o public.life_offerings; e public.life_enrollments; r public.life_completion_rules;
 policy uuid; threshold numeric; reasons jsonb:='[]'; evidence jsonb;
 sessions jsonb; assignments jsonb; quizzes jsonb;
 denom numeric; credited numeric; rate numeric; n integer; missing integer;
 failures integer:=0; x integer; result uuid;
begin
 select * into o from public.life_offerings where id=f for update;
 if not (life_private.manages(f) or life_private.reviews(f)) then raise exception 'FORBIDDEN';end if;
 select * into e from public.life_enrollments where offering_id=f and person_id=p;
 if e.id is null then raise exception 'NOT_FOUND';end if;
 select completion_policy_id into policy from public.life_course_versions where id=o.course_version_id;
 select * into r from public.life_completion_rules where policy_id=policy;
 threshold:=life_private.completion_attendance_threshold(f);
 select cr.id into result from public.life_completion_runs cr
 join public.life_completion_approvals ca on ca.run_id=cr.id
 where cr.enrollment_id=e.id and cr.input_revision=o.academic_revision
 order by ca.approved_at desc limit 1;
 if result is not null and life_private.policy_valid(policy,o.org_id,'COMPLETION') then return result;end if;
 if e.status<>'ACTIVE' then reasons:=reasons||jsonb_build_array('수강등록이 활성 상태가 아닙니다.');end if;
 if (now() at time zone 'Asia/Seoul')::date<=o.ends_on then reasons:=reasons||jsonb_build_array('과정 종료일이 지나지 않았습니다.');end if;
 if not o.academic_sealed then reasons:=reasons||jsonb_build_array('운영자료 마감이 필요합니다.');end if;
 if r.approved_at is null or not life_private.policy_valid(policy,o.org_id,'COMPLETION') then
  reasons:=reasons||jsonb_build_array('유효한 승인 계산 기준이 없습니다.');
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('session_id',s.id,'title',s.title,
  'starts_at',s.starts_at,'ends_at',s.ends_at,'minutes',extract(epoch from s.ends_at-s.starts_at)/60,
  'credited_minutes',a.credited_minutes,'attendance_revision',a.revision) order by s.starts_at),'[]'::jsonb),
  count(*),count(*) filter(where a.session_id is null or s.ends_at>now()),
  sum(extract(epoch from s.ends_at-s.starts_at)/60),sum(a.credited_minutes)
 into sessions,n,missing,denom,credited
 from public.life_class_sessions s
 left join public.life_attendance a on a.session_id=s.id and a.person_id=p
 where s.offering_id=f and s.status='SCHEDULED';
 if n=0 or missing>0 then
  reasons:=reasons||jsonb_build_array('회차 또는 공식 출결 기록이 누락되었습니다.');
 else
  rate:=100*credited/denom;
  if rate<threshold then failures:=failures+1;end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('assignment_id',a.id,'title',a.title,
  'submission_id',s.id,'revision',s.revision,'score',g.score)),'[]'::jsonb),
  count(*),count(*) filter(where s.id is null or g.submission_id is null or
   g.submission_revision<>s.revision or a.due_at>now()),
  count(*) filter(where g.score<r.assignment_min)
 into assignments,n,missing,x
 from public.life_assignments a
 left join public.life_submissions s on s.assignment_id=a.id and s.person_id=p
 left join public.life_submission_grades g on g.submission_id=s.id
 where a.offering_id=f and a.published;
 if r.assignment_min is not null then
  if n=0 or missing>0 then reasons:=reasons||jsonb_build_array('필수 과제의 마감·제출·채점을 확인해야 합니다.');
  else failures:=failures+x;end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('quiz_id',q.id,'title',q.title,
  'attempt_id',a.id,'status',a.status,'score',g.score)),'[]'::jsonb),
  count(*),count(*) filter(where a.id is null or a.status<>'SUBMITTED' or
   g.attempt_id is null or q.closes_at>now()),
  count(*) filter(where g.score<r.quiz_min)
 into quizzes,n,missing,x
 from public.life_quizzes q
 left join public.life_quiz_attempts a on a.quiz_id=q.id and a.person_id=p
 left join life_private.quiz_results g on g.attempt_id=a.id
 where q.offering_id=f;
 if r.quiz_min is not null then
  if n=0 or missing>0 then reasons:=reasons||jsonb_build_array('필수 시험의 마감·응시·제출을 확인해야 합니다.');
  else failures:=failures+x;end if;
 end if;
 evidence:=jsonb_build_object('policy_id',policy,'rules',to_jsonb(r),
  'attendance_threshold',threshold,'attendance_percent',round(rate,2),
  'sessions',sessions,'assignments',assignments,'quizzes',quizzes,'failed_criteria',failures);
 insert into public.life_completion_runs(enrollment_id,offering_id,person_id,input_revision,
  outcome,reasons,evidence,calculated_by)
 values(e.id,f,p,o.academic_revision,
  case when jsonb_array_length(reasons)>0 then 'NEEDS_REVIEW'
   when failures>0 then 'INELIGIBLE' else 'READY' end,
  case when jsonb_array_length(reasons)=0 and failures>0
   then jsonb_build_array('출석률 또는 승인된 항목별 최소 점수에 미달합니다.')
   else reasons end,evidence,life_private.person_id()) returning id into result;
 return result;
end$$;

-- Previously computed READY rows must be recalculated under the new 80% floor.
update public.life_offerings o set academic_revision=academic_revision+1
where exists(select 1 from public.life_completion_runs r where r.offering_id=o.id);

create index if not exists life_completion_refunds_invoice_requested
on public.life_refunds(invoice_id,requested_at desc);
create index if not exists life_completion_refund_documents_offering_person
on public.life_learner_document_requests(offering_id,person_id,submitted_at desc)
where kind='REFUND';

create or replace function life_private.completion_board(f uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare threshold numeric;
begin
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
  from public.life_enrollments e
  join public.life_people p on p.id=e.person_id
  join public.life_offerings o on o.id=e.offering_id
  left join lateral(select * from public.life_completion_runs
    where enrollment_id=e.id order by calculated_at desc,id desc limit 1) r on true
  left join public.life_completion_approvals a on a.run_id=r.id
  left join lateral(
   select count(*)::integer total,
    count(*) filter(where s.ends_at<=now())::integer finished,
    count(*) filter(where s.ends_at<=now() and at.session_id is not null)::integer recorded,
    round(100*sum(at.credited_minutes) filter(where s.ends_at<=now()) /
     nullif(sum(extract(epoch from s.ends_at-s.starts_at)/60)
      filter(where s.ends_at<=now()),0),2) rate
   from public.life_class_sessions s
   left join public.life_attendance at on at.session_id=s.id and at.person_id=p.id
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
end$$;

revoke all on function life_private.operation_schema(text),
 life_private.completion_attendance_threshold(uuid),
 life_private.completion_plan_resubmitted() from public,anon,authenticated,service_role;

notify pgrst,'reload schema';
commit;
