-- LOCAL ONLY: combine prerequisite/current migrations in one transaction.
-- No production academic actions; every fixture and grant is rolled back.
begin;
create temp table academic_fixture(k text,f uuid,p uuid,enrollment uuid,run uuid,submission uuid);
create temp table academic_scope(f uuid,hidden_f uuid,y uuid,s1 uuid,s2 uuid,cancelled uuid,quiz uuid,future_quiz uuid);
grant select on academic_fixture,academic_scope to authenticated;
do $$
declare actor uuid:='454e4e2b-09b0-4619-9470-c0bf4ac228e0';learner uuid:='6ff24c6b-5d15-424e-963c-1b24dbff3903';
 hidden_person uuid:=gen_random_uuid();withdrawn uuid:=gen_random_uuid();pending uuid:=gen_random_uuid();
 org uuid;seed public.life_offerings;year_seed public.life_project_years;policy uuid;enrollment_policy uuid;
 f uuid:=gen_random_uuid();hidden_f uuid:=gen_random_uuid();y uuid:=gen_random_uuid();course uuid;
 s1 uuid:=gen_random_uuid();s2 uuid:=gen_random_uuid();cancelled uuid:=gen_random_uuid();test_session uuid:=gen_random_uuid();
 assignment uuid:=gen_random_uuid();test_assignment uuid:=gen_random_uuid();q uuid:=gen_random_uuid();future_q uuid:=gen_random_uuid();test_q uuid:=gen_random_uuid();
 person uuid;app uuid;enr uuid;r uuid;sub uuid;attempt uuid;label text;target uuid;current_revision integer;fr record;
begin
 select org_id into org from public.life_role_assignments where person_id=actor and role='COURSE_MANAGER' limit 1;
 select * into seed from public.life_offerings where org_id=org limit 1;
 select * into year_seed from public.life_project_years where id=seed.project_year_id;
 select v.completion_policy_id into policy from public.life_course_versions v where v.id=seed.course_version_id;
 select pv.id into enrollment_policy from public.life_policy_versions pv where pv.org_id=org and pv.kind='ENROLLMENT' limit 1;
 if seed.id is null or not life_private.policy_valid(policy,org,'COMPLETION') then raise exception 'LOCAL_APPROVED_POLICY_REQUIRED';end if;
 insert into public.life_people(id,name) values(hidden_person,'academic-hidden'),(withdrawn,'academic-withdrawn'),(pending,'academic-pending');
 insert into life_private.non_operational_members(person_id,reason) values(hidden_person,'Local fixture');
 insert into public.life_role_assignments(person_id,org_id,role) select actor,org,'INSTRUCTOR' where not exists(select 1 from public.life_role_assignments ra where ra.person_id=actor and ra.org_id=org and ra.role='INSTRUCTOR');
 insert into public.life_project_years select (jsonb_populate_record(null::public.life_project_years,to_jsonb(year_seed)||jsonb_build_object('id',y,'label','Local academic '||y))).*;
 foreach course in array array[f,hidden_f] loop
  insert into public.life_offerings select (jsonb_populate_record(null::public.life_offerings,to_jsonb(seed)||jsonb_build_object('id',course,'project_year_id',y,'name','academic-'||course,'starts_on',current_date-30,'ends_on',current_date-1,'academic_sealed',true))).*;
  insert into public.life_offering_instructors(offering_id,person_id) values(course,actor);
 end loop;
 insert into life_private.non_operational_offerings(offering_id,reason) values(hidden_f,'Local fixture');
 insert into public.life_class_sessions(id,offering_id,title,starts_at,ends_at,status,reason)
 values(s1,f,'Local first',now()-interval '2 days',now()-interval '2 days'+interval '1 hour','SCHEDULED',''),
 (s2,f,'Local second',now()-interval '1 day',now()-interval '1 day'+interval '1 hour','SCHEDULED',''),
 (cancelled,f,'Local cancelled',now()-interval '3 days',now()-interval '3 days'+interval '1 hour','CANCELLED','Local cancellation'),
 (test_session,hidden_f,'Local hidden',now()-interval '1 day',now()-interval '1 day'+interval '1 hour','SCHEDULED','');
 insert into public.life_assignments(id,offering_id,title,instructions,due_at,published) values(assignment,f,'Local assignment','Local task',now()-interval '1 day',true),(test_assignment,hidden_f,'Local hidden assignment','Local task',now()-interval '1 day',true);
 insert into public.life_quizzes(id,offering_id,title,opens_at,closes_at,duration_minutes,questions)
 values(q,f,'Local closed quiz',now()-interval '2 days',now()-interval '1 hour',30,'[{"text":"Local question","options":["A","B"]}]'),
 (future_q,f,'Local open quiz',now()-interval '1 day',now()+interval '1 day',30,'[{"text":"Local question","options":["A","B"]}]'),
 (test_q,hidden_f,'Local hidden quiz',now()-interval '2 days',now()-interval '1 hour',30,'[{"text":"Local question","options":["A","B"]}]');
 insert into life_private.quiz_keys values(q,'[0]'),(future_q,'[0]'),(test_q,'[0]');
 foreach label in array array['normal','hidden-person','withdrawn','pending','hidden-course'] loop
  person:=case label when 'hidden-person' then hidden_person when 'withdrawn' then withdrawn when 'pending' then pending else learner end;
  target:=case label when 'hidden-course' then hidden_f else f end;
  insert into public.life_applications(offering_id,person_id,policy_id,status) values(target,person,enrollment_policy,'ACCEPTED') returning id into app;
  insert into public.life_enrollments(offering_id,person_id,application_id,status) values(target,person,app,case label when 'withdrawn' then 'WITHDRAWN' else 'ACTIVE' end) returning id into enr;
  insert into public.life_attendance(session_id,person_id,credited_minutes,reason,revision,recorded_by)
  values(case label when 'hidden-course' then test_session else s1 end,person,case label when 'withdrawn' then 10 else 60 end,'Local retained reason',2,actor);
  if label in ('normal','hidden-person') then insert into public.life_attendance(session_id,person_id,credited_minutes,reason,recorded_by) values(s2,person,case label when 'normal' then 48 else 60 end,'Local second record',actor);end if;
  insert into life_private.qr_attendance_checkins(session_id,person_id,checked_in_at,checked_out_at) values(case label when 'hidden-course' then test_session else s1 end,person,now()-interval '2 days',case label when 'pending' then null else now()-interval '2 days'+interval '1 hour' end);
  insert into public.life_submissions(assignment_id,person_id,body,revision) values(case label when 'hidden-course' then test_assignment else assignment end,person,'Local retained submission',2) returning id into sub;
  if label<>'pending' then insert into public.life_submission_grades values(sub,2,case label when 'normal' then 88 else 70 end,'Local retained feedback',actor,now());end if;
  insert into public.life_quiz_attempts(quiz_id,person_id,expires_at,questions,answers,status)
  values(case label when 'hidden-course' then test_q else q end,person,now()-interval '1 hour','[{"text":"Local question","options":["A","B"]}]','[0]',case label when 'pending' then 'OPEN' when 'withdrawn' then 'EXPIRED' else 'SUBMITTED' end) returning id into attempt;
  if label not in ('pending','withdrawn') then insert into life_private.quiz_results values(attempt,90);end if;
  insert into academic_fixture values(label,target,person,enr,r,sub);
 end loop;
 insert into public.life_quiz_attempts(quiz_id,person_id,expires_at,questions,answers,status)
 values(future_q,learner,now()+interval '1 hour','[{"text":"Local question","options":["A","B"]}]','[0]','SUBMITTED') returning id into attempt;
 insert into life_private.quiz_results values(attempt,80);
 insert into academic_scope values(f,hidden_f,y,s1,s2,cancelled,q,future_q);
 insert into public.life_course_reports(offering_id,payload,updated_by) values(f,'{"operator":"Local report","sourceReport":{"enrolled":999,"completed":999}}',actor);
 update public.life_people set name='academic-renamed-person' where id=hidden_person;
 update public.life_offerings set name='academic-renamed-course' where id=hidden_f;
 -- Finalize only the local fixtures, after inputs have invalidated their seal.
 update public.life_offerings set academic_sealed=true where id in(f,hidden_f);
 -- Create current evidence after all academic inputs have finished changing.
 for fr in select * from academic_fixture loop
  label:=fr.k;person:=fr.p;enr:=fr.enrollment;target:=fr.f;
  select academic_revision into current_revision from public.life_offerings where id=target;
  if label in ('normal','pending') then
   insert into public.life_completion_runs(enrollment_id,offering_id,person_id,input_revision,outcome,reasons,evidence,calculated_by,calculated_at)
   values(enr,target,person,current_revision-1,'READY','["Local old evidence"]',jsonb_build_object('policy_id',policy),actor,now()-interval '2 hours') returning id into r;
   insert into public.life_completion_approvals values(r,actor,now()-interval '1 hour');
  end if;
  insert into public.life_completion_runs(enrollment_id,offering_id,person_id,input_revision,outcome,reasons,evidence,calculated_by)
  values(enr,target,person,case label when 'withdrawn' then current_revision-1 else current_revision end,'READY','["Local immutable evidence"]',jsonb_build_object('policy_id',policy,'sessions',jsonb_build_array(jsonb_build_object('credited_minutes',48)),'assignments','[]'::jsonb,'quizzes','[]'::jsonb),actor) returning id into r;
  if label<>'pending' then insert into public.life_completion_approvals values(r,actor,now());end if;
  update academic_fixture af set run=r where af.k=label;
 end loop;
 perform set_config('request.jwt.claims','{"sub":"b3ec6670-7950-4a2c-9562-fb266e004dd0","role":"authenticated","aal":"aal2","session_id":"1a0d6d22-2dd8-433f-a086-5f932d61d162"}',true);
 if life_private.person_id()<>actor then raise exception 'LOCAL_VERIFIED_ACTOR_REQUIRED';end if;
end$$;
create temp table academic_preserved(label text,hash text);
do $$declare t text;h text;begin
 foreach t in array array['public.life_enrollments','public.life_attendance','public.life_submissions','public.life_submission_grades','public.life_quiz_attempts','life_private.quiz_results','life_private.quiz_keys','life_private.qr_attendance_checkins','public.life_completion_runs','public.life_completion_approvals','public.life_course_reports'] loop
  execute format('select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text,''[]'')) from %s x',t) into h;
  insert into academic_preserved values(t,h);
 end loop;
end$$;
set local role authenticated;
do $$declare sc academic_scope;x jsonb;v jsonb;result record;begin
 select * into sc from academic_scope;
 x:=public.life_teaching_attendance(sc.f);
 if jsonb_array_length(x->'members')<>2 or jsonb_array_length(x->'attendance')<>3 or jsonb_array_length(x->'sessions')<>3 then raise exception 'ATTENDANCE_SCOPE_FAILED';end if;
 if not exists(select 1 from jsonb_array_elements(x->'attendance') a where (a->>'credited_minutes')::numeric=48)
 or not exists(select 1 from jsonb_array_elements(x->'attendance') a where (a->>'revision')::int=2) then raise exception 'ATTENDANCE_REVISION_OR_MINUTES_LOST';end if;
 if jsonb_array_length(public.life_qr_checkins(sc.f))<>2 then raise exception 'QR_SCOPE_FAILED';end if;
 x:=public.life_completion_board(sc.f);
 if jsonb_array_length(x)<>3 or exists(select 1 from jsonb_array_elements(x) row_entry join academic_fixture af on af.p::text=row_entry->>'person_id' where af.k='hidden-person') then raise exception 'COMPLETION_ROSTER_FAILED';end if;
 select row_value into v from jsonb_array_elements(x) row_value where row_value->>'person_id'=(select p::text from academic_fixture where k='normal');
 if v is null or (v->>'attendance_percent')::numeric<>90 or (v->>'attendance_eligible')::boolean is not true or v->'approval'='null'::jsonb or v#>>'{run,id}'<>(select run::text from academic_fixture where k='normal') then raise exception 'NORMAL_COMPLETION_EVIDENCE_LOST';end if;
 select row_value into v from jsonb_array_elements(x) row_value where row_value->>'person_id'=(select p::text from academic_fixture where k='pending');
 if v is null or (v->>'attendance_complete')::boolean is not false or v->'approval'<>'null'::jsonb then raise exception 'PENDING_FALSE_APPROVAL';end if;
 select row_value into v from jsonb_array_elements(x) row_value where row_value->>'person_id'=(select p::text from academic_fixture where k='withdrawn');
 if v is null or v->>'enrollment_status'<>'WITHDRAWN' or (v->>'stale')::boolean is not true then raise exception 'WITHDRAWN_OR_STALE_HISTORY_LOST';end if;
 if jsonb_array_length(public.life_instructor_completion(sc.f))<>2 or (select count(*) from public.life_roster(sc.f))<>3 then raise exception 'INSTRUCTOR_SCOPE_FAILED';end if;
 x:=public.life_exam_room(sc.f);
 if jsonb_array_length(x->'attempts')<>4 or exists(select 1 from jsonb_array_elements(x->'quizzes') q where q ? 'questions') then raise exception 'EXAM_SCOPE_OR_QUESTIONS_EXPOSED';end if;
 if not exists(select 1 from jsonb_array_elements(x->'attempts') a where a->>'person_id'=(select p::text from academic_fixture where k='pending') and a->>'status'='EXPIRED') then raise exception 'EXPIRY_DISPLAY_LOST';end if;
 x:=public.life_course_workspace(sc.f)->0;
 if x is null or (x->>'enrolled')::int<>2 or (x->>'completed')::int<>1 or (x->>'completion_pending')::int<>1 or (x->>'attendance_expected')::int<>4 or (x->>'attendance_recorded')::int<>3 or (x->>'missing_attendance')::int<>1 then raise exception 'WORKSPACE_DENOMINATOR_OR_COUNTS_FAILED %',x;end if;
 select * into result from public.life_instructor_home_summary() h where h.offering_id=sc.f;
 if result.learner_count<>2 or result.attendance_records<>4 then raise exception 'INSTRUCTOR_HOME_COUNTS_FAILED';end if;
 x:=public.life_course_report(sc.f);
 if jsonb_array_length(x->'members')<>3 or jsonb_array_length(x->'attendance')<>4 or x#>>'{report,payload,sourceReport,enrolled}'<>'999' then raise exception 'REPORT_SCOPE_OR_ORIGINAL_PAYLOAD_CHANGED';end if;
 x:=public.life_operation_context(sc.f);
 if jsonb_array_length(x->'members')<>2 then raise exception 'OPERATION_MEMBER_SCOPE_FAILED';end if;
 if (select count(*) from public.life_enrollments where offering_id in(sc.f,sc.hidden_f))<>3
 or (select count(*) from public.life_attendance where session_id in(sc.s1,sc.s2))<>4
 or (select count(*) from public.life_submissions s where s.id in(select submission from academic_fixture))<>3
 or (select count(*) from public.life_submission_grades g where g.submission_id in(select submission from academic_fixture))<>2
 or (select count(*) from public.life_completion_runs r where r.enrollment_id in(select enrollment from academic_fixture))<>5
 or (select count(*) from public.life_completion_approvals a join public.life_completion_runs r on r.id=a.run_id where r.enrollment_id in(select enrollment from academic_fixture))<>4 then raise exception 'DIRECT_RLS_READ_EXPOSED';end if;
 if has_table_privilege(current_user,'life_private.operational_attendance','SELECT') or has_table_privilege(current_user,'life_private.operational_quiz_results','SELECT') then raise exception 'PRIVATE_VIEW_EXPOSED';end if;
 begin perform public.life_teaching_attendance(sc.hidden_f);raise exception 'HIDDEN_ATTENDANCE_EXPOSED';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 begin perform public.life_completion_board(sc.hidden_f);raise exception 'HIDDEN_COMPLETION_EXPOSED';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 begin perform public.life_exam_room(sc.hidden_f);raise exception 'HIDDEN_EXAM_EXPOSED';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 raise notice 'PASS staff attendance/QR/grade/quiz/latest completion, withdrawn/stale/pending history, all operational counters and direct RLS';
end$$;
reset role;
do $$declare x jsonb;sc academic_scope;begin
 select * into sc from academic_scope;x:=life_private.annual_facts(sc.y);
 if (x#>>'{totals,enrollments}')::int<>3 or (x#>>'{totals,active}')::int<>2 or (x#>>'{totals,withdrawn}')::int<>1 or (x#>>'{totals,completions}')::int<>1 or (x#>>'{totals,applications}')::int<>3 or (x#>>'{totals,completion_rate}')::numeric<>33.33 then raise exception 'ANNUAL_DENOMINATOR_OR_NUMERATOR_FAILED %',x->'totals';end if;
 if (select count(*) from life_private.operational_quiz_results r join life_private.operational_quiz_attempts a on a.id=r.attempt_id join public.life_quizzes q on q.id=a.quiz_id where q.offering_id=sc.f)<>2 then raise exception 'QUIZ_SCORE_AGGREGATE_FAILED';end if;
 raise notice 'PASS annual totals/denominator/numerator and quiz score aggregation';
end$$;
select set_config('request.jwt.claims','{"sub":"41d6ddcd-af44-49aa-9579-c48231377a2d","role":"authenticated","aal":"aal2","session_id":"d4880b5a-cde3-433f-9457-74a713ad5a3c"}',true);
set local role authenticated;
do $$declare sc academic_scope;x jsonb;begin
 select * into sc from academic_scope;x:=public.life_my_attendance(sc.f);
 if jsonb_array_length(x->'members')<>1 or jsonb_array_length(x->'attendance')<>2 then raise exception 'PERSONAL_ATTENDANCE_SCOPE_FAILED';end if;
 x:=public.life_completion_history();
 if (select count(*) from jsonb_array_elements(x) r where r->>'offering_id' in(sc.f::text,sc.hidden_f::text))<>1 then raise exception 'PERSONAL_COMPLETION_HISTORY_FAILED';end if;
 x:=public.life_exam_room(sc.f);
 if jsonb_array_length(x->'attempts')<>2 or not exists(select 1 from jsonb_array_elements(x->'attempts') a where a->>'quiz_id'=sc.future_quiz::text and a->'score'='null'::jsonb)
 or not exists(select 1 from jsonb_array_elements(x->'attempts') a where a->>'quiz_id'=sc.quiz::text and (a->>'score')::numeric=90) then raise exception 'PERSONAL_SCORE_RELEASE_OR_SCOPE_FAILED';end if;
 x:=public.life_my_learning();
 if (select count(*) from jsonb_array_elements(x->'courses') c where c->>'id' in(sc.f::text,sc.hidden_f::text))<>1 then raise exception 'LEARNING_COURSE_SCOPE_FAILED';end if;
 begin perform public.life_teaching_attendance(sc.f);raise exception 'UNASSIGNED_TEACHER_EXPOSED';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 begin perform public.life_completion_board(sc.f);raise exception 'FOREIGN_REVIEW_EXPOSED';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 raise notice 'PASS personal attendance/quiz/history, pre-close score secrecy and unrelated institution boundaries';
end$$;
reset role;
do $$declare row_value record;h text;begin
 for row_value in select * from academic_preserved loop
  execute format('select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text,''[]'')) from %s x',row_value.label) into h;
  if h is distinct from row_value.hash then raise exception 'ORIGINAL_HISTORY_MUTATED %',row_value.label;end if;
 end loop;
 raise notice 'PASS original academic/approval/grade/answer key/QR/report hashes unchanged';
end$$;
select set_config('request.jwt.claims','{}',true);
set local role anon;
do $$begin
 begin perform public.life_completion_history();raise exception 'ANON_HISTORY_EXPOSED';exception when insufficient_privilege then null;end;
 if has_table_privilege(current_user,'life_private.operational_completion_runs','SELECT') or has_function_privilege(current_user,'life_private.operational_academic_context(uuid,uuid)','EXECUTE') then raise exception 'ANON_PRIVATE_SCOPE_EXPOSED';end if;
 raise notice 'PASS anonymous/private read access denied';
end$$;
reset role;
rollback;
