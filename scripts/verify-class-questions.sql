\set ON_ERROR_STOP on
begin;

-- Run only in an isolated local database after the class-questions migration.
-- Keep this regression focused on classroom authorization; production person_id
-- also checks login context, credentials and MFA in separate auth tests.
create or replace function life_private.person_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.id from public.life_people p join public.life_auth_links a on a.person_id = p.id
  where a.auth_user_id = auth.uid() and p.active
$$;
alter table auth.users disable trigger on_auth_user_created;
insert into auth.users(id, email, role, aud)
select ('90000000-0000-4000-8000-00000000000' || n)::uuid,
  'question-' || n || '@example.invalid', 'authenticated', 'authenticated'
from generate_series(1, 5) as n;

insert into public.life_people(id, name)
values
('91000000-0000-4000-8000-000000000001','첫 수강생'),
('91000000-0000-4000-8000-000000000002','둘째 수강생'),
('91000000-0000-4000-8000-000000000003','담당 강사'),
('91000000-0000-4000-8000-000000000004','다른 사람'),
('91000000-0000-4000-8000-000000000005','배정 만료 강사');
insert into public.life_auth_links(person_id, auth_user_id)
select ('91000000-0000-4000-8000-00000000000' || n)::uuid,
  ('90000000-0000-4000-8000-00000000000' || n)::uuid
from generate_series(1, 5) as n;
insert into public.life_role_assignments(person_id,org_id,role)
values
('91000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','INSTRUCTOR'),
('91000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001','INSTRUCTOR');
insert into public.life_courses(id,org_id,title,academy)
values('92000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','질문 테스트 과정','테스트');
insert into public.life_course_versions(id,org_id,course_id,summary,curriculum)
values('92000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000001','검증','검증');
insert into public.life_policy_versions(id,org_id,kind,version,title,body,status,approved_by,approved_at)
values('92000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001',
  'ENROLLMENT','question-test','검증','검증','APPROVED','91000000-0000-4000-8000-000000000003',now());
insert into public.life_offerings(id,org_id,project_year_id,course_version_id,name,mode,location,capacity,
  apply_from,apply_until,starts_on,ends_on,enrollment_policy_id)
values('92000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000002',
  '질문 테스트 수업','ONLINE','온라인',30,now()-interval '2 days',now()-interval '1 day',
  current_date-1,current_date+30,'92000000-0000-4000-8000-000000000003');
insert into public.life_offering_instructors(offering_id,person_id,valid_until)
values
('92000000-0000-4000-8000-000000000004','91000000-0000-4000-8000-000000000003',null),
('92000000-0000-4000-8000-000000000004','91000000-0000-4000-8000-000000000005',now()-interval '1 day');
insert into public.life_applications(id,offering_id,person_id,status,policy_id)
values
('92000000-0000-4000-8000-000000000011','92000000-0000-4000-8000-000000000004','91000000-0000-4000-8000-000000000001','ACCEPTED','92000000-0000-4000-8000-000000000003'),
('92000000-0000-4000-8000-000000000012','92000000-0000-4000-8000-000000000004','91000000-0000-4000-8000-000000000002','ACCEPTED','92000000-0000-4000-8000-000000000003');
insert into public.life_enrollments(application_id,offering_id,person_id)
values
('92000000-0000-4000-8000-000000000011','92000000-0000-4000-8000-000000000004','91000000-0000-4000-8000-000000000001'),
('92000000-0000-4000-8000-000000000012','92000000-0000-4000-8000-000000000004','91000000-0000-4000-8000-000000000002');

set local role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',true);
select public.life_ask_class_question('92000000-0000-4000-8000-000000000004','비공개 질문','PRIVATE');
select public.life_ask_class_question('92000000-0000-4000-8000-000000000004','공개 질문','COURSE');
do $$ begin
  if (select count(*) from public.life_class_questions('92000000-0000-4000-8000-000000000004')) <> 2 then
    raise exception 'author could not read own questions'; end if;
end $$;

select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000002',true);
do $$ begin
  if (select count(*) from public.life_class_questions('92000000-0000-4000-8000-000000000004')) <> 1
    or (select body from public.life_class_questions('92000000-0000-4000-8000-000000000004') limit 1) <> '공개 질문'
    then raise exception 'private question leaked'; end if;
end $$;

select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000003',true);
do $$ declare q uuid; begin
  if (select count(*) from public.life_class_questions('92000000-0000-4000-8000-000000000004')) <> 2
    or (select unanswered_questions from public.life_instructor_home_summary() limit 1) <> 2
    then raise exception 'instructor cannot see assigned question summary'; end if;
  select id into q from public.life_class_questions('92000000-0000-4000-8000-000000000004') where body='비공개 질문';
  perform set_config('question_test.private_id',q::text,true);
  perform public.life_answer_class_question(q,'비공개 답변');
  if (select unanswered_questions from public.life_instructor_home_summary() limit 1) <> 1
    then raise exception 'answer did not update summary'; end if;
end $$;

select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000004',true);
do $$ begin
  begin
    perform * from public.life_class_questions('92000000-0000-4000-8000-000000000004');
    raise exception 'outsider read permitted';
  exception when raise_exception then
    if sqlerrm <> 'FORBIDDEN' then raise; end if;
  end;
  begin
    perform public.life_ask_class_question('92000000-0000-4000-8000-000000000004','불법 질문','PRIVATE');
    raise exception 'outsider write permitted';
  exception when raise_exception then
    if sqlerrm <> 'FORBIDDEN' then raise; end if;
  end;
  begin
    perform public.life_answer_class_question(current_setting('question_test.private_id')::uuid,'불법 답변');
    raise exception 'outsider answer permitted';
  exception when raise_exception then
    if sqlerrm <> 'FORBIDDEN' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000005',true);
do $$ begin
  if (select count(*) from public.life_instructor_home_summary()) <> 0 then raise exception 'expired instructor summary leaked'; end if;
  begin
    perform * from public.life_class_questions('92000000-0000-4000-8000-000000000004');
    raise exception 'expired instructor read permitted';
  exception when raise_exception then
    if sqlerrm <> 'FORBIDDEN' then raise; end if;
  end;
end $$;

reset role;
update public.life_enrollments set status='WITHDRAWN'
where person_id='91000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000002',true);
do $$ begin
  begin
    perform * from public.life_class_questions('92000000-0000-4000-8000-000000000004');
    raise exception 'withdrawn learner read permitted';
  exception when raise_exception then
    if sqlerrm <> 'FORBIDDEN' then raise; end if;
  end;
end $$;
reset role;
do $$ begin
  if exists (select 1 from public.life_audit_events where action like 'CLASS_%' and details::text like '%질문%')
    then raise exception 'question body written to audit'; end if;
end $$;
rollback;
\echo PASS class question visibility, write authorization, answer and instructor summary
