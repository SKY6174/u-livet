-- Included by verify-member-manual-entry.sql with -v member_excel_extension=1.
-- Uses the same synthetic fixtures; the parent transaction rolls every change back.
update auth.mfa_amr_claims set updated_at=now() where session_id=md5('session-1')::uuid;
set local role authenticated;
select pg_temp.actor(1);
select pg_temp.check_result(
  public.life_member_excel_export('office','manual2@')->0->>'position'='RESEARCHER',
  'Excel export includes the editable office rank');
select pg_temp.check_result(
  (public.life_member_excel_export('office','manual2@')->0->>'person_id')::uuid is not null,
  'Excel export includes member identity for guarded re-import');
select pg_temp.check_result(
  public.life_member_excel_export('instructor','manual3@')->0->>'kind'='INTERNAL',
  'Excel export includes the instructor classification');
select pg_temp.check_result(
  public.life_member_excel_import('office','10000000-0000-4000-8000-000000000001',jsonb_build_array(
    jsonb_build_object('request_id',md5('excel-new-1')::uuid,'name','엑셀 신규 가','email','excel-new-1@example.invalid','position','DIRECTOR'),
    jsonb_build_object('request_id',md5('excel-new-2')::uuid,'name','엑셀 신규 나','email','excel-new-2@example.invalid','position','RESEARCHER')))->>'created'='2',
  'Excel import creates two members');
select pg_temp.check_result(jsonb_array_length(public.life_member_excel_export('office','excel-new-'))=2,
  'Excel export finds imported members');
select pg_temp.expect_error($cmd$select public.life_member_excel_import('office','10000000-0000-4000-8000-000000000001',jsonb_build_array(
  jsonb_build_object('request_id',md5('excel-rollback-1')::uuid,'name','롤백 대상','email','excel-rollback-1@example.invalid','position','RESEARCHER'),
  jsonb_build_object('request_id',md5('excel-rollback-2')::uuid,'name','중복 이메일','email','excel-new-1@example.invalid','position','RESEARCHER')))$cmd$,'ROW_2: MEMBER_EMAIL_EXISTS');
select pg_temp.check_result(jsonb_array_length(public.life_member_excel_export('office','excel-rollback-1@'))=0,
  'failed second row rolls back the entire workbook');
select pg_temp.check_result(
  public.life_member_excel_import('office','10000000-0000-4000-8000-000000000001',jsonb_build_array(
    jsonb_build_object('person_id',public.life_member_excel_export('office','manual2@')->0->>'person_id',
      'revision',1,'name','엑셀 수정','email','manual2@example.invalid','position','CENTER_HEAD')))->>'updated'='1',
  'Excel import updates an existing member');
select pg_temp.check_result(public.life_member_excel_export('office','manual2@')->0->>'position'='CENTER_HEAD',
  'Excel export shows updated rank');
select pg_temp.expect_error($cmd$select public.life_member_excel_import('office','10000000-0000-4000-8000-000000000001',jsonb_build_array(
  jsonb_build_object('person_id',public.life_member_excel_export('office','manual2@')->0->>'person_id',
    'revision',1,'name','오래된 파일','email','manual2@example.invalid','position','DIRECTOR')))$cmd$,'REVISION_CONFLICT');
select pg_temp.expect_error($cmd$select public.life_member_excel_import('office','10000000-0000-4000-8000-000000000001',jsonb_build_array(
  jsonb_build_object('person_id',public.life_member_excel_export('office','manual2@')->0->>'person_id',
    'revision',2,'name','이메일 변경','email','changed@example.invalid','position','DIRECTOR')))$cmd$,'MEMBER_EMAIL_MISMATCH');
select pg_temp.check_result(
  public.life_member_excel_import('office','10000000-0000-4000-8000-000000000001',jsonb_build_array(
    jsonb_build_object('request_id',md5('excel-mixed-new')::uuid,'name','혼합 신규','email','excel-mixed@example.invalid','position','RESEARCHER'),
    jsonb_build_object('person_id',public.life_member_excel_export('office','manual2@')->0->>'person_id',
      'revision',2,'name','혼합 수정','email','manual2@example.invalid','position','CENTER_HEAD')))->>'created'='1',
  'mixed workbook creates a member');
select pg_temp.check_result(public.life_member_excel_export('office','manual2@')->0->>'revision'='3',
  'mixed workbook updates an existing member');
select pg_temp.expect_error($cmd$select public.life_member_excel_import('office','10000000-0000-4000-8000-000000000001',
  (select jsonb_agg(jsonb_build_object('name','초과')) from generate_series(1,101)))$cmd$,'INVALID_INPUT');
select pg_temp.actor(2);
select pg_temp.check_result(jsonb_array_length(public.life_member_excel_export('office','manual2@'))=1,
  'designated entry operator can export the directory');
select pg_temp.expect_error($cmd$select public.life_member_excel_import('office','10000000-0000-4000-8000-000000000001',jsonb_build_array(
  jsonb_build_object('person_id',public.life_member_excel_export('office','manual2@')->0->>'person_id',
    'revision',3,'name','권한 없는 수정','email','manual2@example.invalid','position','DIRECTOR')))$cmd$,'FORBIDDEN');
select pg_temp.actor(4);
select pg_temp.check_result(jsonb_array_length(public.life_member_excel_export('office','excel-new-'))=0,
  'other organization cannot export imported members');
select pg_temp.actor(3);
select pg_temp.expect_error($cmd$select public.life_member_excel_export('office','')$cmd$,'FORBIDDEN');
reset role;
update auth.mfa_amr_claims set updated_at=now()-interval '121 minutes' where session_id=md5('session-1')::uuid;
set local role authenticated;
select pg_temp.actor(1);
select pg_temp.expect_error($cmd$select public.life_member_excel_import('office','10000000-0000-4000-8000-000000000001',jsonb_build_array(
  jsonb_build_object('request_id',md5('excel-mfa')::uuid,'name','인증 만료','email','excel-mfa@example.invalid','position','RESEARCHER')))$cmd$,'MFA_REAUTH_REQUIRED');
reset role;
set local role anon;
select pg_temp.expect_error($cmd$select public.life_member_excel_export('office','')$cmd$,'permission denied');
reset role;
