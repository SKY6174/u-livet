-- Local synthetic data only. All fixtures and mutations roll back.
begin;
insert into public.life_organizations(id,slug,name)
values('90000000-0000-4000-8000-000000000001','public-introduction-test','합성 기관');
insert into public.life_project_years(id,org_id,label,starts_on,ends_on)
values('90000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000001','합성 연차','2026-01-01','2026-12-31');
insert into public.life_courses(id,org_id,title,academy)
values('90000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000001','합성 과정','합성 분야');
insert into public.life_course_versions(id,org_id,course_id,summary,curriculum)
values('90000000-0000-4000-8000-000000000004','90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000003','공개 설명','공개 교육내용');
insert into public.life_offerings(id,org_id,project_year_id,course_version_id,name,mode,location,capacity,status,public_introduction,starts_on,ends_on,apply_from,apply_until,tuition,selection_method)
select id::uuid,'90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000004',
  '합성 공개 검증 '||status,'OFFLINE','합성 강의실',10,status,visible,'2026-09-01','2026-09-30',
  case when status<>'ARCHIVED' then '2026-08-01'::timestamptz end,
  case when status<>'ARCHIVED' then '2026-08-31'::timestamptz end,
  case when status<>'ARCHIVED' then 0 end,
  case when status<>'ARCHIVED' then 'REVIEW' end
from (values
  ('90000000-0000-4000-8000-000000000011','ARCHIVED',true),
  ('90000000-0000-4000-8000-000000000012','ARCHIVED',false),
  ('90000000-0000-4000-8000-000000000013','DRAFT',true),
  ('90000000-0000-4000-8000-000000000014','PUBLISHED',false),
  ('90000000-0000-4000-8000-000000000015','CLOSED',false)
) fixtures(id,status,visible);

set local role anon;
do $$ declare payload jsonb; begin
  assert (select count(*) from public.life_course_introductions() where name like '합성 공개 검증 %')=3, 'public collection scope';
  assert (select count(*) from public.life_course_introductions('90000000-0000-4000-8000-000000000011'))=1, 'public archive detail';
  assert (select count(*) from public.life_course_introductions('90000000-0000-4000-8000-000000000012'))=0, 'private archive hidden';
  assert (select count(*) from public.life_course_introductions('90000000-0000-4000-8000-000000000013'))=0, 'draft hidden even with publication flag';
  assert (select count(*) from public.life_catalog where id='90000000-0000-4000-8000-000000000011')=0, 'private catalog remains protected';
  select to_jsonb(c) into payload from public.life_course_introductions('90000000-0000-4000-8000-000000000011') c;
  assert not payload ?| array['org_id','course_version_id','enrollment_policy_id','academic_revision','payload','participants','body','account','result_file_id','public_introduction'], 'minimal public projection';
  assert payload->>'status'='ARCHIVED' and payload->>'apply_from' is null, 'archive cannot become enrollment';
  begin
    perform * from public.life_report_files;
    assert false, 'anonymous report files unexpectedly readable';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.life_course_reports;
    assert false, 'anonymous report payload unexpectedly readable';
  exception when insufficient_privilege then null; end;
  begin
    update public.life_offerings set public_introduction=true where id='90000000-0000-4000-8000-000000000012';
    assert false, 'anonymous publication update unexpectedly allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role authenticated;
do $$ begin
  assert (select count(*) from public.life_course_introductions() where name like '합성 공개 검증 %')=3, 'ordinary user gets same public introductions';
  assert (select count(*) from public.life_catalog where id='90000000-0000-4000-8000-000000000011')=0, 'ordinary user cannot access archived work record';
  begin
    assert (select count(*) from public.life_course_reports where offering_id='90000000-0000-4000-8000-000000000011')=0, 'ordinary user cannot read reports';
  exception when insufficient_privilege then null; end;
  begin
    assert (select count(*) from public.life_report_files where offering_id='90000000-0000-4000-8000-000000000011')=0, 'ordinary user cannot read files';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.life_offerings set public_introduction=false where id='90000000-0000-4000-8000-000000000011';
set local role anon;
do $$ begin
  assert (select count(*) from public.life_course_introductions('90000000-0000-4000-8000-000000000011'))=0, 'revoked introduction disappears';
end $$;
reset role;
rollback;
select 'PASS public introductions, private archives/drafts, report boundaries and revocation' as result;
