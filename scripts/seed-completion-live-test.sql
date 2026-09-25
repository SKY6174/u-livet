-- One-time, production-only review fixture. Never add this file to migrations.
-- All educational records belong to the isolated [검증용] organization.
-- This single DO statement is atomic and works with `supabase db query --file`.

do $seed$
declare
  test_org uuid := gen_random_uuid();
  test_year uuid := gen_random_uuid();
  enrollment_policy uuid := gen_random_uuid();
  completion_policy uuid := gen_random_uuid();
  writer uuid := gen_random_uuid();
  reviewer uuid := gen_random_uuid();
  operator_id uuid;
  test_course uuid;
  test_version uuid;
  test_offering uuid;
  test_session uuid;
  learner uuid;
  application uuid;
  enrollment uuid;
  result_id uuid;
  run_revision bigint;
  credit numeric;
  item record;
  n integer;
begin
  if exists (select 1 from public.life_organizations where slug='uc-anchor-completion-review-test') then
    raise exception 'COMPLETION_TEST_ALREADY_EXISTS';
  end if;
  select r.person_id into operator_id
  from public.life_role_assignments r
  join public.life_auth_links l on l.person_id=r.person_id and l.auth_user_id is not null
  where r.role='SYSTEM_ADMIN' and (r.valid_until is null or r.valid_until>now())
  order by (r.org_id='10000000-0000-4000-8000-000000000001') desc,r.valid_from limit 1;
  if operator_id is null then raise exception 'NO_AUTHENTICATED_TEST_OPERATOR'; end if;

  insert into public.life_organizations(id,slug,name)
  values(test_org,'uc-anchor-completion-review-test','[검증용] 수료 판정 시험 조직');
  insert into public.life_project_years(id,org_id,label,starts_on,ends_on)
  values(test_year,test_org,'2차년도 · 2026 · 검증용','2026-03-01','2027-02-28');
  insert into public.life_people(id,name) values
    (writer,'[검증용] 판정 작성자'),(reviewer,'[검증용] 승인 담당자');
  insert into public.life_role_assignments(person_id,org_id,role,valid_until) values
    (operator_id,test_org,'COURSE_MANAGER','2026-10-31 00:00:00+09'),
    (operator_id,test_org,'CERTIFIER','2026-10-31 00:00:00+09');

  insert into public.life_policy_versions
    (id,org_id,kind,version,title,body,status,approved_by,approved_at)
  values
    (enrollment_policy,test_org,'ENROLLMENT','review-test-2026',
      '[검증용] 수강등록 정책','합성 수강생만 등록합니다. 실제 모집·연락·결제·증명에 사용하지 않습니다.',
      'APPROVED',reviewer,now()),
    (completion_policy,test_org,'COMPLETION','review-test-2026',
      '[검증용] 출석 80% 수료 기준','종료된 공식 수업 출석률 80% 이상을 수료 후보로 산출합니다. 실제 교육 결과가 아닙니다.',
      'APPROVED',reviewer,now());
  insert into public.life_completion_rules
    (policy_id,attendance_percent,created_by,approved_by,approved_at)
  values(completion_policy,80,writer,reviewer,now());

  for item in
    select * from (values
      (1,'건강식생활지도사'::text,'2026-07-03'::date,'2026-07-24'::date,'2026-07-10 09:00:00+09'::timestamptz),
      (2,'실버푸드전문가과정'::text,'2026-09-04'::date,'2026-09-24'::date,'2026-09-10 09:00:00+09'::timestamptz)
    ) as courses(course_no,title,starts_on,ends_on,session_start)
  loop
    test_course := gen_random_uuid();
    test_version := gen_random_uuid();
    test_offering := gen_random_uuid();
    test_session := gen_random_uuid();
    insert into public.life_courses(id,org_id,title,academy)
    values(test_course,test_org,item.title,'라이프케어 · 검증용');
    insert into public.life_course_versions
      (id,org_id,course_id,version,summary,curriculum,status,completion_policy_id,approved_by)
    values(test_version,test_org,test_course,1,
      '수료 판정·승인 화면 검증을 위한 합성 교육과정입니다.',
      '검증용 100분 수업 1회와 합성 출석 기록. 실제 교육 이력이 아닙니다.',
      'APPROVED',completion_policy,reviewer);
    insert into public.life_offerings
      (id,org_id,project_year_id,course_version_id,name,mode,location,capacity,tuition,
       selection_method,status,apply_from,apply_until,starts_on,ends_on,enrollment_policy_id)
    values(test_offering,test_org,test_year,test_version,'[검증용] '||item.title,
      'OFFLINE','검증용 데이터',6,0,'REVIEW','DRAFT',
      '2026-03-01 09:00:00+09','2026-03-31 18:00:00+09',
      item.starts_on,item.ends_on,enrollment_policy);
    insert into public.life_class_sessions(id,offering_id,title,starts_at,ends_at)
    values(test_session,test_offering,'[검증용] 출석 판정 회차',
      item.session_start,item.session_start+interval '100 minutes');

    for n in 1..6 loop
      learner := gen_random_uuid();
      application := gen_random_uuid();
      enrollment := gen_random_uuid();
      credit := case n when 1 then 90 when 2 then 85 when 3 then 70
        when 4 then 50 when 5 then 100 else null end;
      insert into public.life_people(id,name)
      values(learner,format('[검증용] %s 수강생 %s',item.title,n));
      insert into public.life_applications(id,offering_id,person_id,status,policy_id)
      values(application,test_offering,learner,'ACCEPTED',enrollment_policy);
      insert into public.life_enrollments(id,application_id,offering_id,person_id,status)
      values(enrollment,application,test_offering,learner,
        case when n=4 then 'WITHDRAWN' else 'ACTIVE' end);
      if credit is not null then
        insert into public.life_attendance
          (session_id,person_id,credited_minutes,reason,recorded_by)
        values(test_session,learner,credit,'[검증용] 합성 출석',operator_id);
      end if;
      if n=4 then
        insert into public.life_learner_document_requests
          (org_id,person_id,offering_id,request_key,kind,course_name,
           applicant_name,phone_masked,refund_occurrence,amount,status,
           current_note,reviewer_id,resolved_at)
        values(test_org,learner,test_offering,gen_random_uuid(),'REFUND',
          '[검증용] '||item.title,format('[검증용] %s 수강생 %s',item.title,n),
          '010-****-0000','before-half',0,'COMPLETED',
          '[검증용] 실제 환불·송금 기록이 아닙니다.',reviewer,now());
      end if;
    end loop;

    update public.life_offerings set academic_sealed=true,
      academic_revision=academic_revision+1 where id=test_offering
      returning academic_revision into run_revision;

    -- These saved runs make approval, ineligible and withdrawn states inspectable.
    -- Learner 2 is left uncalculated for the real UI calculation action.
    for n in 1..6 loop
      if n not in (1,3,4,5) then continue; end if;
      select e.id,p.id into enrollment,learner
      from public.life_enrollments e join public.life_people p on p.id=e.person_id
      where e.offering_id=test_offering
        and p.name=format('[검증용] %s 수강생 %s',item.title,n);
      credit := case n when 1 then 90 when 3 then 70 when 4 then 50 else 100 end;
      result_id := gen_random_uuid();
      insert into public.life_completion_runs
        (id,enrollment_id,offering_id,person_id,input_revision,outcome,reasons,evidence,calculated_by)
      values(result_id,enrollment,test_offering,learner,run_revision,
        case n when 3 then 'INELIGIBLE' when 4 then 'NEEDS_REVIEW' else 'READY' end,
        case n when 3 then '["출석률 80% 기준에 미달합니다."]'::jsonb
          when 4 then '["수강등록이 활성 상태가 아닙니다."]'::jsonb else '[]'::jsonb end,
        jsonb_build_object('policy_id',completion_policy,'attendance_threshold',80,
          'attendance_percent',credit,'sessions',jsonb_build_array(jsonb_build_object(
            'session_id',test_session,'title','[검증용] 출석 판정 회차',
            'minutes',100,'credited_minutes',credit,'attendance_revision',1)),
          'assignments','[]'::jsonb,'quizzes','[]'::jsonb,
          'failed_criteria',case when n=3 then 1 else 0 end),writer);
      if n=5 then
        insert into public.life_completion_approvals(run_id,approved_by)
        values(result_id,reviewer);
      end if;
    end loop;
  end loop;
end
$seed$;
