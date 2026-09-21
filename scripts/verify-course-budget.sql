-- Synthetic local fixtures only; all changes roll back.
\set ON_ERROR_STOP on
begin;
do $$begin if current_database()<>'life_members_test_20260921' then raise exception 'Use isolated budget test database'; end if; end$$;
create function pg_temp.ok(v boolean,label text) returns void language plpgsql as $$begin if v is distinct from true then raise exception 'FAIL %',label; end if; raise notice 'PASS %',label; end$$;
create function pg_temp.denied(command text,expected text) returns void language plpgsql as $$begin
 begin execute command; exception when others then if strpos(sqlerrm,expected)>0 then raise notice 'PASS denied %',expected; return; else raise; end if; end;
 raise exception 'FAIL expected %',expected;
end$$;
alter table auth.users disable trigger on_auth_user_created;
insert into auth.users(id,email,email_confirmed_at,encrypted_password,created_at,updated_at)
select md5('budget-'||i)::uuid,'budget'||i||'@example.invalid',now(),'synthetic-only',now(),now() from generate_series(1,4)i;
alter table auth.users enable trigger on_auth_user_created;
insert into life_people(id,name) select md5('budget-'||i)::uuid,'예산검증'||i from generate_series(1,4)i;
insert into life_auth_links select md5('budget-'||i)::uuid,md5('budget-'||i)::uuid from generate_series(1,4)i;
update life_private.credential_state set changed_at=now()-interval '1 hour';
insert into auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at) select md5('bf-'||i)::uuid,md5('budget-'||i)::uuid,'totp','verified',now(),now() from generate_series(1,4)i;
insert into auth.sessions(id,user_id,created_at,updated_at,factor_id,aal) select md5('bs-'||i)::uuid,md5('budget-'||i)::uuid,now(),now(),md5('bf-'||i)::uuid,'aal2' from generate_series(1,4)i;
insert into auth.mfa_amr_claims(id,session_id,authentication_method,created_at,updated_at) select md5('ba-'||i)::uuid,md5('bs-'||i)::uuid,'totp',now(),now() from generate_series(1,4)i;
insert into life_organizations(id,slug,name) values(md5('budget-other')::uuid,'budget-other','다른 기관');
insert into life_role_assignments(person_id,org_id,role) values
(md5('budget-1')::uuid,'10000000-0000-4000-8000-000000000001','COURSE_MANAGER'),
(md5('budget-2')::uuid,'10000000-0000-4000-8000-000000000001','SYSTEM_ADMIN'),
(md5('budget-3')::uuid,'10000000-0000-4000-8000-000000000001','INSTRUCTOR'),
(md5('budget-4')::uuid,md5('budget-other')::uuid,'COURSE_MANAGER');
select pg_temp.ok((select count(*)=16 from life_course_budgets),'16 seeded budgets');
select pg_temp.ok((select sum(coalesce(materials,0)+coalesce(printing,0)+coalesce(instructors,0)+coalesce(operations,0)+coalesce(support,0)+coalesce(scholarships,0))=115036420 from life_course_budgets),'source line amounts preserved with documented 100 won discrepancy');
select set_config('test.payload','{"program_id":"C1-S3T4-2","materials":0,"printing":null,"instructors":1,"operations":2,"support":3,"scholarships":4}',true);
select set_config('test.workbook','{"file_name":"test.xlsx","sheet_name":"집행","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","header_row":0,"rows":[["프로그램 ID","세부 프로그램","강사료"],["C1-S3T4-2","검증", "1000"]]}',true);
select set_config('request.jwt.claims',jsonb_build_object('sub',md5('budget-1')::uuid,'role','authenticated','amr',jsonb_build_array(jsonb_build_object('method','totp','timestamp',floor(extract(epoch from now())))),'aal','aal2','session_id',md5('bs-1')::uuid)::text,true);
set local role authenticated;
select pg_temp.ok(jsonb_array_length(life_course_budget_overview('10000000-0000-4000-8000-000000000001',2026)->'courses')=16,'manager reads16');
select pg_temp.ok(life_save_course_budget('10000000-0000-4000-8000-000000000001','2026-manual-therapy',current_setting('test.payload')::jsonb,1)=2,'manager persists budget');
select pg_temp.denied($q$select life_save_course_budget('10000000-0000-4000-8000-000000000001','2026-manual-therapy',current_setting('test.payload')::jsonb,1)$q$,'REVISION_CHANGED');
select pg_temp.denied($q$select life_save_course_budget('10000000-0000-4000-8000-000000000001','2026-manual-therapy',jsonb_set(current_setting('test.payload')::jsonb,'{materials}','-1'),2)$q$,'INVALID_INPUT');
select pg_temp.denied($q$select life_save_course_budget('10000000-0000-4000-8000-000000000001','2026-manual-therapy',current_setting('test.payload')::jsonb-'printing',2)$q$,'INVALID_INPUT');
select pg_temp.denied($q$select * from life_course_budgets$q$,'permission denied');
select pg_temp.denied($q$select life_course_budget_overview(md5('budget-other')::uuid,2026)$q$,'FORBIDDEN');
select set_config('test.workbook_id',life_save_budget_workbook('10000000-0000-4000-8000-000000000001',2026,current_setting('test.workbook')::jsonb)::text,true);
select pg_temp.ok(life_save_budget_workbook('10000000-0000-4000-8000-000000000001',2026,current_setting('test.workbook')::jsonb)::text=current_setting('test.workbook_id'),'workbook retry idempotent');
select pg_temp.ok(life_budget_workbook('10000000-0000-4000-8000-000000000001',current_setting('test.workbook_id')::uuid)->'rows'->1->>2='1000','saved workbook roundtrip');
select pg_temp.denied($q$select life_save_budget_workbook('10000000-0000-4000-8000-000000000001',2026,jsonb_set(current_setting('test.workbook')::jsonb,'{header_row}','1'))$q$,'INVALID_INPUT');
select pg_temp.denied($q$select life_save_budget_workbook('10000000-0000-4000-8000-000000000001',2026,jsonb_set(current_setting('test.workbook')::jsonb,'{rows}','[["a"],[1]]'))$q$,'INVALID_INPUT');
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',md5('budget-2')::uuid,'role','authenticated','amr',jsonb_build_array(jsonb_build_object('method','totp','timestamp',floor(extract(epoch from now())))),'aal','aal2','session_id',md5('bs-2')::uuid)::text,true);
set local role authenticated;
select pg_temp.ok(life_save_course_budget('10000000-0000-4000-8000-000000000001','2026-manual-therapy',current_setting('test.payload')::jsonb,2)=3,'system admin can edit');
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',md5('budget-4')::uuid,'role','authenticated','amr',jsonb_build_array(jsonb_build_object('method','totp','timestamp',floor(extract(epoch from now())))),'aal','aal2','session_id',md5('bs-4')::uuid)::text,true);
set local role authenticated;
select pg_temp.denied($q$select life_course_budget_overview('10000000-0000-4000-8000-000000000001',2026)$q$,'FORBIDDEN');
select pg_temp.ok(life_budget_workbook(md5('budget-other')::uuid,current_setting('test.workbook_id')::uuid) is null,'cross-org workbook hidden');
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',md5('budget-3')::uuid,'role','authenticated','amr',jsonb_build_array(jsonb_build_object('method','totp','timestamp',floor(extract(epoch from now())))),'aal','aal2','session_id',md5('bs-3')::uuid)::text,true);
set local role authenticated;
select pg_temp.denied($q$select life_course_budget_overview('10000000-0000-4000-8000-000000000001',2026)$q$,'FORBIDDEN');
select pg_temp.denied($q$select life_save_course_budget('10000000-0000-4000-8000-000000000001','2026-manual-therapy',current_setting('test.payload')::jsonb,3)$q$,'FORBIDDEN');
reset role;
update auth.mfa_amr_claims set updated_at=now()-interval '1 hour',created_at=now()-interval '1 hour' where session_id=md5('bs-1')::uuid;
select set_config('request.jwt.claims',jsonb_build_object('sub',md5('budget-1')::uuid,'role','authenticated','amr',jsonb_build_array(jsonb_build_object('method','totp','timestamp',floor(extract(epoch from now())))),'aal','aal2','session_id',md5('bs-1')::uuid)::text,true);
set local role authenticated;
select pg_temp.denied($q$select life_save_course_budget('10000000-0000-4000-8000-000000000001','2026-manual-therapy',current_setting('test.payload')::jsonb,3)$q$,'MFA_REAUTH_REQUIRED');
reset role;
select pg_temp.ok((select count(*)=3 from life_audit_events where action in ('COURSE_BUDGET_SAVED','BUDGET_WORKBOOK_SAVED')),'audit once for each mutation');
set local role anon;
select pg_temp.denied($q$select life_course_budget_overview('10000000-0000-4000-8000-000000000001',2026)$q$,'permission denied');
rollback;
