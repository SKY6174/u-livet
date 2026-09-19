begin;
alter table public.life_offerings add column academic_revision bigint not null default 1;
alter table public.life_offerings add column academic_sealed boolean not null default false;

create table public.life_class_sessions (
 id uuid primary key default gen_random_uuid(), offering_id uuid not null references public.life_offerings,
 title text not null check(length(trim(title)) between 1 and 200), starts_at timestamptz not null, ends_at timestamptz not null,
 status text not null default 'SCHEDULED' check(status in ('SCHEDULED','CANCELLED')),
 replaces_id uuid unique references public.life_class_sessions, reason text not null default '',
 check(ends_at>starts_at and ends_at-starts_at<=interval '24 hours')
);
create index life_sessions_offering on public.life_class_sessions(offering_id);
create table public.life_attendance (
 session_id uuid not null references public.life_class_sessions, person_id uuid not null references public.life_people,
 credited_minutes numeric not null check(credited_minutes>=0), reason text not null check(length(trim(reason)) between 1 and 1000),
 revision integer not null default 1, recorded_by uuid not null references public.life_people, recorded_at timestamptz not null default now(),
 primary key(session_id,person_id)
);
create table public.life_quizzes (
 id uuid primary key default gen_random_uuid(), offering_id uuid not null references public.life_offerings,
 title text not null check(length(trim(title)) between 1 and 200), opens_at timestamptz not null, closes_at timestamptz not null,
 duration_minutes integer not null check(duration_minutes between 1 and 180), questions jsonb not null,
 check(closes_at>opens_at), check(jsonb_typeof(questions)='array' and jsonb_array_length(questions) between 1 and 20)
);
create index life_quizzes_offering on public.life_quizzes(offering_id);
create table life_private.quiz_keys (quiz_id uuid primary key references public.life_quizzes, answers jsonb not null);
create table public.life_quiz_attempts (
 id uuid primary key default gen_random_uuid(), quiz_id uuid not null references public.life_quizzes,
 person_id uuid not null references public.life_people, started_at timestamptz not null default now(), expires_at timestamptz not null,
 questions jsonb not null, answers jsonb not null default '[]', status text not null default 'OPEN' check(status in ('OPEN','SUBMITTED','EXPIRED')),
 submitted_at timestamptz, unique(quiz_id,person_id)
);
create table life_private.quiz_results (attempt_id uuid primary key references public.life_quiz_attempts, score numeric not null check(score between 0 and 100));

create table public.life_completion_rules (
 policy_id uuid primary key references public.life_policy_versions, attendance_percent numeric check(attendance_percent between 0 and 100),
 assignment_min numeric check(assignment_min between 0 and 100), quiz_min numeric check(quiz_min between 0 and 100),
 created_by uuid not null references public.life_people, created_at timestamptz not null default now(),
 approved_by uuid references public.life_people, approved_at timestamptz,
 check(num_nonnulls(attendance_percent,assignment_min,quiz_min)>0),
 check((approved_by is null)=(approved_at is null)), check(approved_by is distinct from created_by)
);
create table public.life_completion_runs (
 id uuid primary key default gen_random_uuid(), enrollment_id uuid not null references public.life_enrollments,
 offering_id uuid not null references public.life_offerings, person_id uuid not null references public.life_people,
 input_revision bigint not null, outcome text not null check(outcome in ('READY','INELIGIBLE','NEEDS_REVIEW')),
 reasons jsonb not null, evidence jsonb not null, calculated_by uuid not null references public.life_people, calculated_at timestamptz not null default now()
);
create index life_runs_latest on public.life_completion_runs(offering_id,person_id,calculated_at desc);
create table public.life_completion_approvals (
 run_id uuid primary key references public.life_completion_runs, approved_by uuid not null references public.life_people,
 approved_at timestamptz not null default now()
);

create function life_private.reviews(f uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select life_private.has_role(org_id,'CERTIFIER') from public.life_offerings where id=f),false)
$$;
create function life_private.learning_staff(f uuid) returns boolean language sql stable security definer set search_path='' as $$
 select life_private.manages(f) or life_private.teaches(f) or life_private.reviews(f)
$$;
-- A transaction changing any evidence locks the offering and advances its revision.
-- Confirmations take the same lock. Later edits leave historic approvals intact but stale.
create function life_private.academic_changed() returns trigger language plpgsql security definer set search_path='' as $$
declare r jsonb:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end; f uuid; unseal boolean:=false;
begin
 case tg_table_name
 when 'life_attendance' then select offering_id into f from public.life_class_sessions where id=(r->>'session_id')::uuid;
 when 'life_submissions' then select offering_id into f from public.life_assignments where id=(r->>'assignment_id')::uuid;
 when 'life_submission_grades' then select a.offering_id into f from public.life_submissions s join public.life_assignments a on a.id=s.assignment_id where s.id=(r->>'submission_id')::uuid;
 when 'life_quiz_attempts' then select offering_id into f from public.life_quizzes where id=(r->>'quiz_id')::uuid;
 else f:=(r->>'offering_id')::uuid;
 end case;
 unseal:=tg_table_name in ('life_class_sessions','life_quizzes','life_assignments');
 update public.life_offerings set academic_revision=academic_revision+1,academic_sealed=case when unseal then false else academic_sealed end where id=f;
 if tg_table_name in ('life_attendance','life_submission_grades') then
  insert into public.life_audit_events(org_id,actor_id,action,entity_id,details)
  select org_id,life_private.person_id(),case when tg_table_name='life_attendance' then 'ATTENDANCE_' else 'GRADE_' end||tg_op,coalesce(r->>'session_id',r->>'submission_id')::uuid,
    jsonb_build_object('before',case when tg_op<>'INSERT' then to_jsonb(old) end,'after',case when tg_op<>'DELETE' then to_jsonb(new) end) from public.life_offerings where id=f;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['life_class_sessions','life_attendance','life_assignments','life_submissions','life_submission_grades','life_quizzes','life_quiz_attempts','life_enrollments'] loop
 execute format('create trigger life_academic_changed before insert or update or delete on public.%I for each row execute function life_private.academic_changed()',t);
 end loop;
end $$;
create function life_private.rules_frozen() returns trigger language plpgsql set search_path='' as $$
begin
 if old.approved_at is not null then raise exception 'APPROVED_POLICY_IMMUTABLE'; end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger life_rules_frozen before update or delete on public.life_completion_rules for each row execute function life_private.rules_frozen();
create function life_private.rules_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.life_offerings o set academic_revision=academic_revision+1 from public.life_course_versions v where v.id=o.course_version_id and v.completion_policy_id=new.policy_id;
 return new;
end $$;
create trigger life_rules_changed after insert or update on public.life_completion_rules for each row execute function life_private.rules_changed();
create function life_private.course_policy_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.completion_policy_id is distinct from new.completion_policy_id then
 update public.life_offerings set academic_revision=academic_revision+1,academic_sealed=false where course_version_id=new.id;
 end if; return new;
end $$;
create trigger life_course_policy_changed after update on public.life_course_versions for each row execute function life_private.course_policy_changed();

create function life_private.schedule_class(f uuid,title text,starts_at timestamptz,ends_at timestamptz,replaces uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare o public.life_offerings; result uuid;
begin
 select * into o from public.life_offerings where id=f for update;
 if not life_private.teaches(f) then raise exception 'FORBIDDEN'; end if;
 if (starts_at at time zone 'Asia/Seoul')::date<o.starts_on or (ends_at at time zone 'Asia/Seoul')::date>o.ends_on then raise exception 'SESSION_OUTSIDE_COURSE'; end if;
 if replaces is not null and not exists(select 1 from public.life_class_sessions where id=replaces and offering_id=f and status='CANCELLED') then raise exception 'INVALID_REPLACEMENT'; end if;
 insert into public.life_class_sessions(offering_id,title,starts_at,ends_at,replaces_id) values(f,title,starts_at,ends_at,replaces) returning id into result;
 return result;
end $$;
create function public.life_schedule_class(f uuid,title text,starts_at timestamptz,ends_at timestamptz,replaces uuid) returns uuid language sql security invoker set search_path='' as $$select life_private.schedule_class(f,title,starts_at,ends_at,replaces)$$;
create function life_private.cancel_class(s uuid,reason text) returns void language plpgsql security definer set search_path='' as $$
declare f uuid;
begin
 select offering_id into f from public.life_class_sessions where id=s;
 if f is null or not life_private.teaches(f) then raise exception 'FORBIDDEN'; end if;
 if reason is null or length(trim(reason)) not between 1 and 1000 then raise exception 'INVALID_INPUT'; end if;
 update public.life_class_sessions set status='CANCELLED',reason=trim(cancel_class.reason) where id=s and status<>'CANCELLED';
 insert into public.life_audit_events(org_id,actor_id,action,entity_id,details) select org_id,life_private.person_id(),'CLASS_CANCELLED',s,jsonb_build_object('reason',reason) from public.life_offerings where id=f;
end $$;
create function public.life_cancel_class(s uuid,reason text) returns void language sql security invoker set search_path='' as $$select life_private.cancel_class(s,reason)$$;
create function life_private.record_attendance(s uuid,p uuid,minutes numeric,reason text,expected_revision integer) returns void language plpgsql security definer set search_path='' as $$
declare c public.life_class_sessions; prior public.life_attendance;
begin
 select * into c from public.life_class_sessions where id=s for update;
 if c.id is null or not life_private.teaches(c.offering_id) then raise exception 'FORBIDDEN'; end if;
 if p=life_private.person_id() then raise exception 'SELF_APPROVAL_FORBIDDEN'; end if;
 if c.status<>'SCHEDULED' or c.ends_at>now() then raise exception 'CLASS_NOT_FINISHED'; end if;
 if not exists(select 1 from public.life_enrollments where offering_id=c.offering_id and person_id=p and status='ACTIVE') then raise exception 'FORBIDDEN'; end if;
 if minutes is null or minutes<0 or minutes>extract(epoch from c.ends_at-c.starts_at)/60 then raise exception 'INVALID_INPUT'; end if;
 select * into prior from public.life_attendance where session_id=s and person_id=p;
 if coalesce(prior.revision,0) is distinct from expected_revision then raise exception 'REVISION_CHANGED'; end if;
 insert into public.life_attendance(session_id,person_id,credited_minutes,reason,recorded_by) values(s,p,minutes,reason,life_private.person_id())
 on conflict(session_id,person_id) do update set credited_minutes=excluded.credited_minutes,reason=excluded.reason,recorded_by=excluded.recorded_by,recorded_at=now(),revision=public.life_attendance.revision+1;
end $$;
create function public.life_record_attendance(s uuid,p uuid,minutes numeric,reason text,expected_revision integer) returns void language sql security invoker set search_path='' as $$select life_private.record_attendance(s,p,minutes,reason,expected_revision)$$;

create function life_private.create_quiz(f uuid,title text,opens_at timestamptz,closes_at timestamptz,duration_minutes integer,questions jsonb,answer_key jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare q jsonb; a jsonb; n integer; i integer:=0; result uuid; clean jsonb:='[]';
begin
 if not life_private.teaches(f) then raise exception 'FORBIDDEN'; end if;
 if questions is null or jsonb_typeof(questions)<>'array' or jsonb_array_length(questions) not between 1 and 20 or answer_key is null or jsonb_typeof(answer_key)<>'array' or jsonb_array_length(answer_key)<>jsonb_array_length(questions) or closes_at<=now() then raise exception 'INVALID_INPUT'; end if;
 for q in select * from jsonb_array_elements(questions) loop
  if jsonb_typeof(q->'text') is distinct from 'string' or length(trim(q->>'text')) not between 1 and 2000 or jsonb_typeof(q->'options') is distinct from 'array' then raise exception 'INVALID_INPUT'; end if;
  n:=jsonb_array_length(q->'options');
  if n not between 2 and 6 then raise exception 'INVALID_INPUT'; end if;
  for a in select * from jsonb_array_elements(q->'options') loop
   if jsonb_typeof(a)<>'string' or length(trim(a#>>'{}')) not between 1 and 500 then raise exception 'INVALID_INPUT'; end if;
  end loop;
  if jsonb_typeof(answer_key->i)<>'number' or coalesce((answer_key->>i)~'^[0-5]$',false)=false or (answer_key->>i)::int>=n then raise exception 'INVALID_INPUT'; end if;
  -- Whitelist only public fields: even unexpected answer/explanation fields never reach learners.
  clean:=clean||jsonb_build_array(jsonb_build_object('text',q->>'text','options',q->'options')); i:=i+1;
 end loop;
 insert into public.life_quizzes(offering_id,title,opens_at,closes_at,duration_minutes,questions) values(f,title,opens_at,closes_at,duration_minutes,clean) returning id into result;
 insert into life_private.quiz_keys values(result,answer_key);
 return result;
end $$;
create function public.life_create_quiz(f uuid,title text,opens_at timestamptz,closes_at timestamptz,duration_minutes integer,questions jsonb,answer_key jsonb) returns uuid language sql security invoker set search_path='' as $$select life_private.create_quiz(f,title,opens_at,closes_at,duration_minutes,questions,answer_key)$$;
create function life_private.start_quiz(q uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v public.life_quizzes; a uuid; p uuid:=life_private.person_id();
begin
 select * into v from public.life_quizzes where id=q for update;
 if v.id is null or not life_private.enrolled(v.offering_id) then raise exception 'FORBIDDEN'; end if;
 select id into a from public.life_quiz_attempts where quiz_id=q and person_id=p;
 if a is not null then return a; end if;
 if now()<v.opens_at or now()>=v.closes_at then raise exception 'EXAM_CLOSED'; end if;
 insert into public.life_quiz_attempts(quiz_id,person_id,expires_at,questions) values(q,p,least(v.closes_at,now()+make_interval(mins=>v.duration_minutes)),v.questions) returning id into a;
 return a;
end $$;
create function public.life_start_quiz(q uuid) returns uuid language sql security invoker set search_path='' as $$select life_private.start_quiz(q)$$;
create function life_private.answer_quiz(a uuid,answers jsonb,finalize boolean) returns text language plpgsql security definer set search_path='' as $$
declare v public.life_quiz_attempts; f uuid; keys jsonb; i integer; n integer; correct integer:=0;
begin
 select * into v from public.life_quiz_attempts where id=a for update;
 select offering_id into f from public.life_quizzes where id=v.quiz_id;
 if v.id is null or v.person_id is distinct from life_private.person_id() or not life_private.enrolled(f) then raise exception 'FORBIDDEN'; end if;
 if v.status<>'OPEN' then return v.status; end if;
 if clock_timestamp()>=v.expires_at then update public.life_quiz_attempts set status='EXPIRED' where id=a; return 'EXPIRED'; end if;
 n:=jsonb_array_length(v.questions);
 if answers is null or jsonb_typeof(answers)<>'array' or jsonb_array_length(answers)<>n or finalize is null then raise exception 'INVALID_INPUT'; end if;
 select k.answers into keys from life_private.quiz_keys k where quiz_id=v.quiz_id;
 for i in 0..n-1 loop
  if answers->i<>'null'::jsonb and (jsonb_typeof(answers->i)<>'number' or coalesce((answers->>i)~'^[0-5]$',false)=false or (answers->>i)::int>=jsonb_array_length(v.questions->i->'options')) then raise exception 'INVALID_INPUT'; end if;
  if answers->i=keys->i then correct:=correct+1; end if;
 end loop;
 update public.life_quiz_attempts set answers=answer_quiz.answers,status=case when finalize then 'SUBMITTED' else 'OPEN' end,submitted_at=case when finalize then now() end where id=a;
 if finalize then insert into life_private.quiz_results values(a,round(100.0*correct/n,2)); end if;
 return case when finalize then 'SUBMITTED' else 'OPEN' end;
end $$;
create function public.life_answer_quiz(a uuid,answers jsonb,finalize boolean) returns text language sql security invoker set search_path='' as $$select life_private.answer_quiz(a,answers,finalize)$$;
create function life_private.exam_room(f uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not (life_private.enrolled(f) or life_private.teaches(f)) then raise exception 'FORBIDDEN'; end if;
 return jsonb_build_object('quizzes',coalesce((select jsonb_agg(to_jsonb(q)-'questions' order by q.opens_at) from public.life_quizzes q where offering_id=f),'[]'::jsonb),
 'attempts',coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object('status',case when a.status='OPEN' and now()>=a.expires_at then 'EXPIRED' else a.status end,'score',case when life_private.teaches(f) or now()>=q.closes_at then r.score end)) from public.life_quiz_attempts a join public.life_quizzes q on q.id=a.quiz_id left join life_private.quiz_results r on r.attempt_id=a.id where q.offering_id=f and (a.person_id=life_private.person_id() or life_private.teaches(f))),'[]'::jsonb));
end $$;
create function public.life_exam_room(f uuid) returns jsonb language sql stable security invoker set search_path='' as $$select life_private.exam_room(f)$$;

create function life_private.propose_rules(policy uuid,attendance numeric,assignment_score numeric,quiz_score numeric) returns void language plpgsql security definer set search_path='' as $$
declare v public.life_policy_versions;
begin
 select * into v from public.life_policy_versions where id=policy;
 if v.id is null or not life_private.has_role(v.org_id,'COURSE_MANAGER') then raise exception 'FORBIDDEN'; end if;
 if not life_private.policy_valid(policy,v.org_id,'COMPLETION') then raise exception 'APPROVED_POLICY_REQUIRED'; end if;
 insert into public.life_completion_rules(policy_id,attendance_percent,assignment_min,quiz_min,created_by) values(policy,attendance,assignment_score,quiz_score,life_private.person_id())
 on conflict(policy_id) do update set attendance_percent=excluded.attendance_percent,assignment_min=excluded.assignment_min,quiz_min=excluded.quiz_min,created_by=excluded.created_by,created_at=now();
 insert into public.life_audit_events(org_id,actor_id,action,entity_id,details) values(v.org_id,life_private.person_id(),'RULES_PROPOSED',policy,jsonb_build_object('attendance',attendance,'assignment_min',assignment_score,'quiz_min',quiz_score));
end $$;
create function public.life_propose_rules(policy uuid,attendance numeric,assignment_score numeric,quiz_score numeric) returns void language sql security invoker set search_path='' as $$select life_private.propose_rules(policy,attendance,assignment_score,quiz_score)$$;
create function life_private.approve_rules(policy uuid,expected_created_at timestamptz) returns void language plpgsql security definer set search_path='' as $$
declare r public.life_completion_rules; o uuid;
begin
 select org_id into o from public.life_policy_versions where id=policy;
 if o is null or not life_private.has_role(o,'CERTIFIER') then raise exception 'FORBIDDEN'; end if;
 select * into r from public.life_completion_rules where policy_id=policy for update;
 if r.policy_id is null or r.created_at is distinct from expected_created_at then raise exception 'REVISION_CHANGED'; end if;
 if r.created_by=life_private.person_id() then raise exception 'SELF_APPROVAL_FORBIDDEN'; end if;
 if not life_private.policy_valid(policy,o,'COMPLETION') then raise exception 'APPROVED_POLICY_REQUIRED'; end if;
 if r.approved_at is not null then return; end if;
 update public.life_completion_rules set approved_by=life_private.person_id(),approved_at=now() where policy_id=policy;
 insert into public.life_audit_events(org_id,actor_id,action,entity_id) values(o,life_private.person_id(),'RULES_APPROVED',policy);
end $$;
create function public.life_approve_rules(policy uuid,expected_created_at timestamptz) returns void language sql security invoker set search_path='' as $$select life_private.approve_rules(policy,expected_created_at)$$;
create function life_private.seal_academics(f uuid,expected_revision bigint) returns void language plpgsql security definer set search_path='' as $$
declare o public.life_offerings;
begin
 select * into o from public.life_offerings where id=f for update;
 if not life_private.manages(f) then raise exception 'FORBIDDEN'; end if;
 if o.academic_revision is distinct from expected_revision then raise exception 'REVISION_CHANGED'; end if;
 update public.life_offerings set academic_sealed=true,academic_revision=academic_revision+1 where id=f;
 insert into public.life_audit_events(org_id,actor_id,action,entity_id) values(o.org_id,life_private.person_id(),'ACADEMICS_SEALED',f);
end $$;
create function public.life_seal_academics(f uuid,expected_revision bigint) returns void language sql security invoker set search_path='' as $$select life_private.seal_academics(f,expected_revision)$$;

create function life_private.calculate_completion(f uuid,p uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare o public.life_offerings; e public.life_enrollments; r public.life_completion_rules; policy uuid; reasons jsonb:='[]'; evidence jsonb; sessions jsonb; assignments jsonb; quizzes jsonb;
 denom numeric; credited numeric; rate numeric; n integer; missing integer; failures integer:=0; x integer; result uuid;
begin
 select * into o from public.life_offerings where id=f for update;
 if not (life_private.manages(f) or life_private.reviews(f)) then raise exception 'FORBIDDEN'; end if;
 select * into e from public.life_enrollments where offering_id=f and person_id=p;
 if e.id is null then raise exception 'NOT_FOUND'; end if;
 select completion_policy_id into policy from public.life_course_versions where id=o.course_version_id;
 select * into r from public.life_completion_rules where policy_id=policy;
 select cr.id into result from public.life_completion_runs cr join public.life_completion_approvals ca on ca.run_id=cr.id where cr.enrollment_id=e.id and cr.input_revision=o.academic_revision order by ca.approved_at desc limit 1;
 if result is not null and life_private.policy_valid(policy,o.org_id,'COMPLETION') then return result; end if;
 if e.status<>'ACTIVE' then reasons:=reasons||jsonb_build_array('수강등록이 활성 상태가 아닙니다.'); end if;
 if (now() at time zone 'Asia/Seoul')::date<=o.ends_on then reasons:=reasons||jsonb_build_array('과정 종료일이 지나지 않았습니다.'); end if;
 if not o.academic_sealed then reasons:=reasons||jsonb_build_array('운영자료 마감이 필요합니다.'); end if;
 if r.approved_at is null or not life_private.policy_valid(policy,o.org_id,'COMPLETION') then reasons:=reasons||jsonb_build_array('유효한 승인 계산 기준이 없습니다.'); end if;
 select coalesce(jsonb_agg(jsonb_build_object('session_id',s.id,'title',s.title,'starts_at',s.starts_at,'ends_at',s.ends_at,'minutes',extract(epoch from s.ends_at-s.starts_at)/60,'credited_minutes',a.credited_minutes,'attendance_revision',a.revision) order by s.starts_at),'[]'::jsonb),count(*),count(*) filter(where a.session_id is null or s.ends_at>now()),sum(extract(epoch from s.ends_at-s.starts_at)/60),sum(a.credited_minutes)
 into sessions,n,missing,denom,credited from public.life_class_sessions s left join public.life_attendance a on a.session_id=s.id and a.person_id=p where s.offering_id=f and s.status='SCHEDULED';
 if r.attendance_percent is not null then
  if n=0 or missing>0 then reasons:=reasons||jsonb_build_array('회차 또는 공식 출결 기록이 누락되었습니다.'); else rate:=100*credited/denom; if rate<r.attendance_percent then failures:=failures+1; end if; end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('assignment_id',a.id,'title',a.title,'submission_id',s.id,'revision',s.revision,'score',g.score)),'[]'::jsonb),count(*),count(*) filter(where s.id is null or g.submission_id is null or g.submission_revision<>s.revision or a.due_at>now()),count(*) filter(where g.score<r.assignment_min)
 into assignments,n,missing,x from public.life_assignments a left join public.life_submissions s on s.assignment_id=a.id and s.person_id=p left join public.life_submission_grades g on g.submission_id=s.id where a.offering_id=f and a.published;
 if r.assignment_min is not null then if n=0 or missing>0 then reasons:=reasons||jsonb_build_array('필수 과제의 마감·제출·채점을 확인해야 합니다.'); else failures:=failures+x; end if; end if;
 select coalesce(jsonb_agg(jsonb_build_object('quiz_id',q.id,'title',q.title,'attempt_id',a.id,'status',a.status,'score',g.score)),'[]'::jsonb),count(*),count(*) filter(where a.id is null or a.status<>'SUBMITTED' or g.attempt_id is null or q.closes_at>now()),count(*) filter(where g.score<r.quiz_min)
 into quizzes,n,missing,x from public.life_quizzes q left join public.life_quiz_attempts a on a.quiz_id=q.id and a.person_id=p left join life_private.quiz_results g on g.attempt_id=a.id where q.offering_id=f;
 if r.quiz_min is not null then if n=0 or missing>0 then reasons:=reasons||jsonb_build_array('필수 시험의 마감·응시·제출을 확인해야 합니다.'); else failures:=failures+x; end if; end if;
 evidence:=jsonb_build_object('policy_id',policy,'rules',to_jsonb(r),'attendance_percent',round(rate,2),'sessions',sessions,'assignments',assignments,'quizzes',quizzes,'failed_criteria',failures);
 insert into public.life_completion_runs(enrollment_id,offering_id,person_id,input_revision,outcome,reasons,evidence,calculated_by)
 values(e.id,f,p,o.academic_revision,case when jsonb_array_length(reasons)>0 then 'NEEDS_REVIEW' when failures>0 then 'INELIGIBLE' else 'READY' end,
 case when jsonb_array_length(reasons)=0 and failures>0 then jsonb_build_array('승인된 출석률 또는 항목별 최소 점수에 미달합니다.') else reasons end,evidence,life_private.person_id()) returning id into result;
 return result;
end $$;
create function public.life_calculate_completion(f uuid,p uuid) returns uuid language sql security invoker set search_path='' as $$select life_private.calculate_completion(f,p)$$;
create function life_private.confirm_completion(r uuid) returns void language plpgsql security definer set search_path='' as $$
declare v public.life_completion_runs; o public.life_offerings; policy uuid;
begin
 select * into v from public.life_completion_runs where id=r;
 if v.id is null or not life_private.reviews(v.offering_id) then raise exception 'FORBIDDEN'; end if;
 select * into o from public.life_offerings where id=v.offering_id for update;
 if v.calculated_by=life_private.person_id() or v.person_id=life_private.person_id() or life_private.teaches(o.id) then raise exception 'SELF_APPROVAL_FORBIDDEN'; end if;
 if v.input_revision<>o.academic_revision then raise exception 'REVISION_CHANGED'; end if;
 select completion_policy_id into policy from public.life_course_versions where id=o.course_version_id;
 if v.outcome<>'READY' or not o.academic_sealed or not life_private.policy_valid(policy,o.org_id,'COMPLETION') or (v.evidence->>'policy_id')::uuid is distinct from policy then raise exception 'NOT_READY'; end if;
 insert into public.life_completion_approvals(run_id,approved_by) values(r,life_private.person_id()) on conflict do nothing;
 insert into public.life_audit_events(org_id,actor_id,action,entity_id) values(o.org_id,life_private.person_id(),'COMPLETION_CONFIRMED',r);
end $$;
create function public.life_confirm_completion(r uuid) returns void language sql security invoker set search_path='' as $$select life_private.confirm_completion(r)$$;
create function life_private.completion_board(f uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not (life_private.manages(f) or life_private.reviews(f)) then raise exception 'FORBIDDEN'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('person_id',p.id,'name',p.name,'enrollment_status',e.status,'run',to_jsonb(r),'approval',to_jsonb(a),'stale',r.input_revision is distinct from o.academic_revision or not life_private.policy_valid((r.evidence->>'policy_id')::uuid,o.org_id,'COMPLETION')) order by p.name)
 from public.life_enrollments e join public.life_people p on p.id=e.person_id join public.life_offerings o on o.id=e.offering_id
 left join lateral(select * from public.life_completion_runs where enrollment_id=e.id order by calculated_at desc,id desc limit 1) r on true
 left join public.life_completion_approvals a on a.run_id=r.id where e.offering_id=f),'[]'::jsonb);
end $$;
create function public.life_completion_board(f uuid) returns jsonb language sql stable security invoker set search_path='' as $$select life_private.completion_board(f)$$;
create function life_private.completion_history() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('offering_id',o.id,'name',o.name,'outcome',r.outcome,'reasons',r.reasons,'calculated_at',r.calculated_at,'approved_at',a.approved_at,'stale',r.input_revision is distinct from o.academic_revision or not life_private.policy_valid((r.evidence->>'policy_id')::uuid,o.org_id,'COMPLETION'))),'[]'::jsonb)
 from public.life_enrollments e join public.life_offerings o on o.id=e.offering_id
 left join lateral(select * from public.life_completion_runs where enrollment_id=e.id order by calculated_at desc,id desc limit 1) r on true
 left join public.life_completion_approvals a on a.run_id=r.id where e.person_id=life_private.person_id()
$$;
create function public.life_completion_history() returns jsonb language sql stable security invoker set search_path='' as $$select life_private.completion_history()$$;

-- New tables receive no browser writes. Attempts/answer keys/results are only served by checked RPCs.
do $$ declare t text; begin
 foreach t in array array['life_class_sessions','life_attendance','life_quizzes','life_quiz_attempts','life_completion_rules','life_completion_runs','life_completion_approvals'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop;
end $$;
revoke all on all tables in schema life_private from public,anon,authenticated;
alter table life_private.quiz_keys enable row level security;
alter table life_private.quiz_results enable row level security;
grant select on public.life_class_sessions,public.life_attendance,public.life_completion_rules,public.life_completion_runs,public.life_completion_approvals to authenticated;
create policy life_sessions_read on public.life_class_sessions for select to authenticated using(life_private.enrolled(offering_id) or life_private.learning_staff(offering_id));
create policy life_attendance_read on public.life_attendance for select to authenticated using(person_id=(select life_private.person_id()) or exists(select 1 from public.life_class_sessions s where s.id=session_id and life_private.learning_staff(s.offering_id)));
create policy life_rules_read on public.life_completion_rules for select to authenticated using(exists(select 1 from public.life_policy_versions p where p.id=policy_id and (life_completion_rules.approved_at is not null or life_private.has_role(p.org_id,'COURSE_MANAGER') or life_private.has_role(p.org_id,'CERTIFIER'))));
create policy life_runs_read on public.life_completion_runs for select to authenticated using(life_private.manages(offering_id) or life_private.reviews(offering_id));
create policy life_approvals_read on public.life_completion_approvals for select to authenticated using(exists(select 1 from public.life_completion_runs r where r.id=run_id));
-- Explicitly enumerate new function grants; no blanket grant to internal trigger functions.
do $$ declare fn text; f record; begin
 foreach fn in array array['reviews','learning_staff','schedule_class','cancel_class','record_attendance','create_quiz','start_quiz','answer_quiz','exam_room','propose_rules','approve_rules','seal_academics','calculate_completion','confirm_completion','completion_board','completion_history','academic_changed','rules_frozen','rules_changed','course_policy_changed'] loop
 for f in select p.oid::regprocedure as sig,n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='life_private' and p.proname=fn) or (n.nspname='public' and p.proname='life_'||fn) loop
 execute format('revoke all on function %s from public,anon,authenticated',f.sig);
 if fn not in ('academic_changed','rules_frozen','rules_changed','course_policy_changed') then execute format('grant execute on function %s to authenticated',f.sig); end if;
 end loop;
 end loop;
end $$;
create or replace view public.life_catalog with(security_invoker=true) as
select o.id,o.org_id,o.project_year_id,o.course_version_id,o.name,o.mode,o.location,o.capacity,o.tuition,o.selection_method,o.status,o.apply_from,o.apply_until,o.starts_on,o.ends_on,o.enrollment_policy_id,o.created_at,c.academy,c.title,v.summary,v.curriculum,v.completion_policy_id,y.label as year_label,o.academic_revision,o.academic_sealed
from public.life_offerings o join public.life_course_versions v on v.id=o.course_version_id join public.life_courses c on c.id=v.course_id join public.life_project_years y on y.id=o.project_year_id;
create or replace function life_private.grade(s uuid,revision integer,score numeric,feedback text) returns void language plpgsql security definer set search_path='' as $$
declare f uuid; v public.life_submissions;
begin
  select * into v from public.life_submissions where id=s for update;
  select offering_id into f from public.life_assignments where id=v.assignment_id;
  if f is null or not life_private.teaches(f) then raise exception 'FORBIDDEN'; end if;
  if v.person_id=life_private.person_id() then raise exception 'SELF_APPROVAL_FORBIDDEN'; end if;
  if v.revision<>revision then raise exception 'REVISION_CHANGED'; end if;
  insert into public.life_submission_grades values(s,revision,score,feedback,life_private.person_id(),now())
  on conflict(submission_id) do update set submission_revision=excluded.submission_revision,score=excluded.score,feedback=excluded.feedback,grader_id=excluded.grader_id,graded_at=now();
  insert into public.life_audit_events(org_id,actor_id,action,entity_id)
  select org_id,life_private.person_id(),'SUBMISSION_GRADED',s from public.life_offerings where id=f;
end $$;
notify pgrst,'reload schema';
commit;
