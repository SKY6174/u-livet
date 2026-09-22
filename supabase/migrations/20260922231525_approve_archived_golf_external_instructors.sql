begin;

do $migration$
declare
  target_offering constant uuid := '6f436e94-61df-4822-bea3-eccbf25b4c5b';
  target_org constant uuid := '10000000-0000-4000-8000-000000000001';
  source_sha constant text := 'e1cf2a2e1b87aabe4ba2f5e9ea87746fc1a4388eaa5663aa65cac0efcfd256bf';
  actor uuid;
  instructor record;
  report public.life_operation_documents;
  next_content jsonb;
  source_schedule jsonb := '[
    {"date":"2026.07.14. (09:00~11:00)","topic":"파크골프의 이해","instructor":"서봉한","hours":"2","assistant":"","assistantHours":"","location":"스포츠재활 실습실 (G-110)"},
    {"date":"2026.07.14. (11:00~13:00)","topic":"파크골프 이론(1) (장비/코스/에티켓/규정)","instructor":"조경호","hours":"2","assistant":"","assistantHours":"","location":"스포츠재활 실습실 (G-110)"},
    {"date":"2026.07.14. (14:00~18:00)","topic":"파크골프 실습(1) (그립/스텐스/기본 스윙)","instructor":"조경호","hours":"4","assistant":"우철호","assistantHours":"4","location":"인조축구장 (실습장)"},
    {"date":"2026.07.15. (09:00~12:00)","topic":"응급처치 (파크골프 상해 및 재활테이핑 처치)","instructor":"서봉한","hours":"3","assistant":"","assistantHours":"","location":"스포츠재활 실습실 (G-110)"},
    {"date":"2026.07.15. (13:00~18:00)","topic":"파크골프 실습(2) (스윙/티샷/스윙교정)","instructor":"조경호","hours":"5","assistant":"우철호","assistantHours":"5","location":"인조축구장 (실습장)"},
    {"date":"2026.07.16. (09:00~12:00)","topic":"파크골프 이론(2) (장비/코스/에티켓/규정)","instructor":"조경호","hours":"3","assistant":"","assistantHours":"","location":"스포츠재활 실습실 (G-110)"},
    {"date":"2026.07.16. (13:00~18:00)","topic":"파크골프 실습(3) (어프로치/퍼팅)","instructor":"조경호","hours":"5","assistant":"우철호","assistantHours":"5","location":"천연잔디 축구장 (실습장)"},
    {"date":"2026.07.20. (10:00~12:00)","topic":"스포츠인권(장애인)","instructor":"조경호","hours":"2","assistant":"","assistantHours":"","location":"스포츠재활 실습실 (G-110)"},
    {"date":"2026.07.20. (14:00~18:00)","topic":"AI를 활용한 파크골프 자세 분석 및 교정(트랙맨 활용)","instructor":"정봉효","hours":"4","assistant":"우철호","assistantHours":"4","location":"더헬프골프"},
    {"date":"2026.07.21. (09:00~12:00)","topic":"라운딩 실습(1) (코스공략/스코어 작성) (파크골프장 실습)","instructor":"조경호","hours":"4","assistant":"우철호","assistantHours":"4","location":"DA파크골프해운대"},
    {"date":"2026.07.21. (13:00~17:00)","topic":"파크골프 실기(평가)","instructor":"서봉한","hours":"1","assistant":"","assistantHours":"","location":"DA파크골프해운대"}
  ]'::jsonb;
begin
  if not exists(select 1 from public.life_offerings where id=target_offering) then
    raise notice 'Archived park-golf offering is absent; skipping environment-specific backfill.';
    return;
  end if;
  perform 1 from public.life_offerings
   where id=target_offering and org_id=target_org and status='ARCHIVED' for update;
  if not found then raise exception 'ARCHIVED_GOLF_OFFERING_CHANGED'; end if;
  if not exists(
    select 1 from public.life_report_files
    where offering_id=target_offering and kind='result'
  ) and not exists(
    select 1 from public.life_operation_documents
    where offering_id=target_offering and kind='result'
  ) then
    raise notice 'Archived report data is absent; skipping environment-specific backfill.';
    return;
  end if;
  select p.id into actor
  from public.life_people p
  join public.life_role_assignments role on role.person_id=p.id and role.org_id=target_org
  where p.name='송경영' and p.active and role.role='SYSTEM_ADMIN'
    and role.valid_from<=now() and (role.valid_until is null or role.valid_until>now())
  order by p.id limit 1;
  if actor is null then raise exception 'APPROVING_MANAGER_NOT_FOUND'; end if;
  if (select count(*) from public.life_people where name in ('조경호','우철호'))<>0 then
    raise exception 'INSTRUCTOR_NAME_ALREADY_EXISTS_REVIEW_REQUIRED';
  end if;
  if not exists(
    select 1 from public.life_report_files f
    join public.life_course_reports r on r.offering_id=f.offering_id
    where f.offering_id=target_offering and f.kind='result'
      and encode(sha256(decode(f.body,'base64')),'hex')=source_sha
      and r.payload#>>'{sourceReport,sha256}'=source_sha
  ) then raise exception 'ARCHIVED_REPORT_SOURCE_CHANGED'; end if;

  select * into report from public.life_operation_documents
   where offering_id=target_offering and kind='result' for update;
  if not found or report.status<>'DRAFT' or report.revision<>2
     or jsonb_array_length(report.content#>'{tables,schedule}')<>0 then
    raise exception 'RESULT_DRAFT_CHANGED';
  end if;

  for instructor in
    select * from (values
      ('20260000-0000-4000-8000-0000000000c1'::uuid,'조경호'),
      ('20260000-0000-4000-8000-0000000000c2'::uuid,'우철호')
    ) value(person_id,name)
  loop
    insert into public.life_people(id,name) values(instructor.person_id,instructor.name);
    insert into life_private.instructor_pool
      (org_id,person_id,registration_key,kind,affiliation,documents_required,status,notes,created_by,updated_by)
    values(target_org,instructor.person_id,gen_random_uuid(),'EXTERNAL','',true,'ACTIVE',
      '2026 파크골프지도사 양성(자격증)과정 원본 결과보고서 확인 · 종료 과정 본인 인증 전 임시 승인',actor,actor);
    insert into life_private.account_classifications(person_id,instructor_kind,updated_by)
      values(instructor.person_id,'EXTERNAL',actor);
    insert into public.life_role_assignments(person_id,org_id,role)
      values(instructor.person_id,target_org,'INSTRUCTOR');
    insert into public.life_offering_instructors(offering_id,person_id)
      values(target_offering,instructor.person_id);
    insert into public.life_audit_events(org_id,actor_id,action,entity_id,details)
      values(target_org,actor,'ARCHIVED_EXTERNAL_INSTRUCTOR_APPROVED',instructor.person_id,
        jsonb_build_object('offering_id',target_offering,'source_sha256',source_sha,
          'instructor_kind','EXTERNAL','authenticated',false,'documents_required',true));
  end loop;

  next_content:=jsonb_set(report.content,'{tables,schedule}',source_schedule);
  if not life_private.operation_content_valid(next_content,'result') then
    raise exception 'INVALID_IMPORTED_RESULT_CONTENT';
  end if;
  update public.life_operation_documents
   set content=next_content,revision=revision+1,updated_at=now(),updated_by=actor
   where offering_id=target_offering and kind='result' and revision=2 and status='DRAFT';
  if not found then raise exception 'RESULT_REVISION_CHANGED'; end if;
  insert into public.life_audit_events(org_id,actor_id,action,entity_id,details)
    values(target_org,actor,'ARCHIVED_RESULT_SCHEDULE_IMPORTED',target_offering,
      jsonb_build_object('source_sha256',source_sha,'source_page',6,'schedule_rows',11,
        'external_instructors',jsonb_build_array('조경호','우철호')));
end $migration$;

commit;
