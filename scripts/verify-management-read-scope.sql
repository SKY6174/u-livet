-- LOCAL ONLY, invoked by verify-management-read-scope.mjs inside one transaction.
create temp table scope_fixture(real_id uuid,hidden_id uuid,foreign_id uuid,foreign_org uuid);
create temp table scope_cases(f uuid,q text,s text,page integer);
create temp table scope_original as select r.* from public.life_role_assignments r
 where r.person_id='454e4e2b-09b0-4619-9470-c0bf4ac228e0';
grant select on scope_fixture,scope_cases to authenticated;
do $$
declare seed public.life_offerings;doc public.life_learner_document_requests;
 actor uuid:='454e4e2b-09b0-4619-9470-c0bf4ac228e0';org uuid;policy uuid;
 real_id uuid:=gen_random_uuid();hidden_id uuid:=gen_random_uuid();foreign_id uuid;foreign_org uuid;
 person uuid;first_person uuid;doc_person uuid:=gen_random_uuid();target uuid;status text;
begin
 select r.org_id into org from scope_original r where r.role='COURSE_MANAGER' limit 1;
 select * into seed from public.life_offerings o where o.org_id=org limit 1;
 select o.id,o.org_id into foreign_id,foreign_org from public.life_offerings o
 where o.org_id<>org and life_private.operational_offering(o.id) limit 1;
 select pv.id into policy from public.life_policy_versions pv where pv.org_id=org and pv.kind='ENROLLMENT' limit 1;
 if seed.id is null or foreign_id is null then raise exception 'LOCAL_MANAGER_COURSES_REQUIRED';end if;
 foreach target in array array[real_id,hidden_id] loop
  insert into public.life_offerings
  select (jsonb_populate_record(null::public.life_offerings,to_jsonb(seed)||jsonb_build_object(
   'id',target,'name','scope-course-'||target))).*;
 end loop;
 insert into life_private.non_operational_offerings values(hidden_id,'Local scope fixture',now());
 for i in 1..45 loop
  person:=gen_random_uuid();if i=1 then first_person:=person;end if;
  insert into public.life_people(id,name,active) values(person,'scope-learner-'||lpad(i::text,2,'0'),i<>2);
  insert into public.life_applications(offering_id,person_id,policy_id,status)
   values(real_id,person,policy,case when i=1 then 'CANCELLED' else 'SUBMITTED' end);
 end loop;
 insert into public.life_applications(offering_id,person_id,policy_id,status) values(hidden_id,first_person,policy,'SUBMITTED');
 insert into public.life_people(id,name) values(doc_person,'scope-pdf-only');
 select * into doc from public.life_learner_document_requests d where d.kind='APPLICATION' limit 1;
 if doc.id is null then raise exception 'LOCAL_PDF_REQUIRED';end if;
 -- Existing application: the received document wins over a newer rejection.
 -- PDF-only applicant: one latest document; unlinked PDFs retain every history row.
 for i in 1..7 loop
  person:=case when i<=2 then first_person else doc_person end;
  target:=case when i in(5,6) then null when i=7 then hidden_id else real_id end;
  status:=case when i in(2,4) then 'REJECTED' else 'RECEIVED' end;
  insert into public.life_learner_document_requests
  select (jsonb_populate_record(null::public.life_learner_document_requests,to_jsonb(doc)||jsonb_build_object(
   'id',gen_random_uuid(),'request_key',gen_random_uuid(),'person_id',person,'org_id',org,
   'offering_id',target,'course_name','scope-pdf-'||i,'applicant_name','scope-pdf-only',
   'status',status,'deleted_at',null,'deleted_by',null,'submitted_at',now()+i*interval '1 second'))).*;
 end loop;
 insert into scope_fixture values(real_id,hidden_id,foreign_id,foreign_org);
 insert into scope_cases values(null,'','',1),(real_id,'','',1),(real_id,'','',2),
  (real_id,'scope-learner-01','CANCELLED',1),(real_id,'scope','RECEIVED',1),
  (real_id,'scope-pdf','',1),(hidden_id,'','',1),(foreign_id,'','',1),
  (null,'','INVALID_STATUS',1),(null,'','',0);
end$$;

-- Preserve production-equivalent old read functions and their entry points.
do $$declare name text;definition text;begin
 foreach name in array array['management_application_rows()','management_courses()',
  'management_applications(uuid,text,text,integer)','management_learners(uuid,text,integer)'] loop
  definition:=pg_get_functiondef(('life_private.'||name)::regprocedure);
  definition:=replace(definition,'CREATE OR REPLACE FUNCTION life_private.management_',
    'CREATE OR REPLACE FUNCTION pg_temp.before_management_');
  definition:=replace(definition,'life_private.management_application_rows()','pg_temp.before_management_application_rows()');
  definition:=replace(definition,'life_private.management_courses()','pg_temp.before_management_courses()');
  execute definition;
 end loop;
end$$;
-- Owner-only helpers are compared through a local definer; caller claims remain
-- unchanged. Public RPC grants are exercised separately, without new grants.
create function pg_temp.compare_scope(label text) returns void
 language plpgsql security definer set search_path='' as $$
declare old_rows jsonb;new_rows jsonb;c record;old_result jsonb;new_result jsonb;old_error text;new_error text;begin
 select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]') into old_rows from pg_temp.before_management_application_rows() r;
 select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]') into new_rows from life_private.management_application_rows() r;
 if old_rows is distinct from new_rows or pg_temp.before_management_courses() is distinct from life_private.management_courses() then
  raise exception 'SCOPE_MISMATCH %',label;end if;
 for c in select * from pg_temp.scope_cases loop
  old_error:=null;new_error:=null;old_result:=null;new_result:=null;
  begin old_result:=pg_temp.before_management_applications(c.f,c.q,c.s,c.page);exception when others then old_error:=sqlstate||':'||sqlerrm;end;
  begin new_result:=public.life_management_applications(c.f,c.q,c.s,c.page);exception when others then new_error:=sqlstate||':'||sqlerrm;end;
  if old_error is distinct from new_error or old_result is distinct from new_result then raise exception 'APPLICATION_MISMATCH %',label;end if;
  old_error:=null;new_error:=null;old_result:=null;new_result:=null;
  begin old_result:=pg_temp.before_management_learners(c.f,c.q,c.page);exception when others then old_error:=sqlstate||':'||sqlerrm;end;
  begin new_result:=public.life_management_learners(c.f,c.q,c.page);exception when others then new_error:=sqlstate||':'||sqlerrm;end;
  if old_error is distinct from new_error or old_result is distinct from new_result then raise exception 'LEARNER_MISMATCH %',label;end if;
 end loop;
 raise notice 'PASS %: row multiset, courses, both RPC results/errors across 10 filters',label;
end$$;
create temp table original_read_hashes(object text,digest text);
do $$declare table_name text;begin
 foreach table_name in array array['life_people','life_applications','life_enrollments','life_offerings','life_learner_document_requests'] loop
  execute format('insert into original_read_hashes select %L,md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'''')) from public.%I t',table_name,table_name);
 end loop;
end$$;

-- APPLY_OPTIMIZATION_HERE

select set_config('request.jwt.claims','{"sub":"b3ec6670-7950-4a2c-9562-fb266e004dd0","role":"authenticated","aal":"aal2","session_id":"1a0d6d22-2dd8-433f-a086-5f932d61d162"}',true);
set local role authenticated;
select pg_temp.compare_scope('manager');
do $$declare f scope_fixture;x jsonb;y jsonb;begin
 select * into f from scope_fixture;
 if has_function_privilege(current_user,'life_private.management_application_rows()','EXECUTE')
 or has_function_privilege(current_user,'life_private.management_courses()','EXECUTE') then
  raise exception 'PRIVATE_HELPER_EXPOSED';end if;
 x:=public.life_management_applications(f.real_id,'','',1);y:=public.life_management_applications(f.real_id,'','',2);
 if (x->>'count')::int<>46 or jsonb_array_length(x->'items')<>40 or jsonb_array_length(y->'items')<>6 then raise exception 'PAGE_COUNT_FAILED';end if;
 if exists(select 1 from jsonb_array_elements(x->'items') a join jsonb_array_elements(y->'items') b on a->>'id'=b->>'id') then raise exception 'PAGE_OVERLAP';end if;
 x:=public.life_management_applications(f.real_id,'scope-learner-01','',1);
 if x#>>'{items,0,document_status}'<>'RECEIVED' then raise exception 'DOCUMENT_PRIORITY_LOST';end if;
 x:=public.life_management_applications(null,'scope-pdf-only','',1);
 if (x->>'count')::int<>3 then raise exception 'UNLINKED_OR_PDF_ONLY_HISTORY_LOST';end if;
 x:=public.life_management_learners(f.real_id,'',1);
 if (x->>'count')::int<>46 then raise exception 'LEARNER_COUNT_FAILED';end if;
 if public.life_management_applications(f.hidden_id,'','',1)->>'count'<>'0' then raise exception 'HIDDEN_COURSE_EXPOSED';end if;
 raise notice 'PASS explicit pagination 40/6, received/rejected priority, unlinked history, inactive people and hidden-course scope';
end$$;
do $$declare pair int;kind text;started timestamptz;old_ms numeric;new_ms numeric;begin
 foreach kind in array array['applications','learners'] loop
  for pair in 1..8 loop
   if pair%2=0 then
    started:=clock_timestamp();if kind='applications' then perform public.life_management_applications(null,'','',1);else perform public.life_management_learners(null,'',1);end if;
    new_ms:=round(extract(epoch from clock_timestamp()-started)*1000,2);
   end if;
   started:=clock_timestamp();if kind='applications' then perform pg_temp.before_management_applications(null,'','',1);else perform pg_temp.before_management_learners(null,'',1);end if;
   old_ms:=round(extract(epoch from clock_timestamp()-started)*1000,2);
   if pair%2=1 then
    started:=clock_timestamp();if kind='applications' then perform public.life_management_applications(null,'','',1);else perform public.life_management_learners(null,'',1);end if;
    new_ms:=round(extract(epoch from clock_timestamp()-started)*1000,2);
   end if;
   raise notice 'PAIR % % old_ms % new_ms %',kind,pair,old_ms,new_ms;
  end loop;
 end loop;
end$$;
reset role;
select set_config('request.jwt.claims','{}',true);
-- Duplicate, expired and future assignments must not duplicate or widen scope.
insert into public.life_role_assignments(person_id,org_id,role,valid_from,valid_until)
 select '454e4e2b-09b0-4619-9470-c0bf4ac228e0',foreign_org,'COURSE_MANAGER',now()-interval '2 days',now()-interval '1 day' from scope_fixture;
insert into public.life_role_assignments(person_id,org_id,role,valid_from)
 select '454e4e2b-09b0-4619-9470-c0bf4ac228e0',foreign_org,'COURSE_MANAGER',now()+interval '1 day' from scope_fixture;
select set_config('request.jwt.claims','{"sub":"b3ec6670-7950-4a2c-9562-fb266e004dd0","role":"authenticated","aal":"aal2","session_id":"1a0d6d22-2dd8-433f-a086-5f932d61d162"}',true);
set local role authenticated;
select pg_temp.compare_scope('expired/future foreign roles');
reset role;
select set_config('request.jwt.claims','{}',true);
insert into public.life_role_assignments(person_id,org_id,role)
 select '454e4e2b-09b0-4619-9470-c0bf4ac228e0',foreign_org,'COURSE_MANAGER' from scope_fixture cross join generate_series(1,2);
select set_config('request.jwt.claims','{"sub":"b3ec6670-7950-4a2c-9562-fb266e004dd0","role":"authenticated","aal":"aal2","session_id":"1a0d6d22-2dd8-433f-a086-5f932d61d162"}',true);
set local role authenticated;
select pg_temp.compare_scope('multiple organizations and duplicate roles');
reset role;
select set_config('request.jwt.claims','{}',true);
delete from public.life_role_assignments where person_id='454e4e2b-09b0-4619-9470-c0bf4ac228e0';
insert into public.life_role_assignments select * from scope_original;
update public.life_role_assignments set role='SYSTEM_ADMIN' where person_id='454e4e2b-09b0-4619-9470-c0bf4ac228e0';
select set_config('request.jwt.claims','{"sub":"b3ec6670-7950-4a2c-9562-fb266e004dd0","role":"authenticated","aal":"aal2","session_id":"1a0d6d22-2dd8-433f-a086-5f932d61d162"}',true);
set local role authenticated;
select pg_temp.compare_scope('system admin alone');
reset role;
select set_config('request.jwt.claims','{}',true);
delete from public.life_role_assignments where person_id='454e4e2b-09b0-4619-9470-c0bf4ac228e0';
insert into public.life_role_assignments select * from scope_original;
select set_config('request.jwt.claims','{"sub":"41d6ddcd-af44-49aa-9579-c48231377a2d","role":"authenticated","aal":"aal2","session_id":"d4880b5a-cde3-433f-9457-74a713ad5a3c"}',true);
set local role authenticated;
select pg_temp.compare_scope('other institution');
reset role;
select set_config('request.jwt.claims','{"sub":"b3ec6670-7950-4a2c-9562-fb266e004dd0","role":"authenticated","aal":"aal1","session_id":"1a0d6d22-2dd8-433f-a086-5f932d61d162"}',true);
set local role authenticated;
select pg_temp.compare_scope('MFA insufficient');
reset role;
select set_config('request.jwt.claims','{"sub":"b3ec6670-7950-4a2c-9562-fb266e004dd0","role":"authenticated","aal":"aal2","session_id":"00000000-0000-4000-8000-000000000000"}',true);
set local role authenticated;
select pg_temp.compare_scope('invalid session');
reset role;
select set_config('request.jwt.claims','{}',true);
set local role authenticated;
select pg_temp.compare_scope('signed out');
reset role;
do $$declare r record;digest text;begin
 for r in select * from original_read_hashes loop
  execute format('select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'''')) from public.%I t',r.object) into digest;
  if digest is distinct from r.digest then raise exception 'ORIGINAL_DATA_MUTATED %',r.object;end if;
 end loop;
 raise notice 'PASS original people, applications, enrollments, offerings and PDF payloads unchanged';
end$$;
set local role anon;
do $$begin
 begin perform public.life_management_applications();raise exception 'ANON_EXPOSED';exception when insufficient_privilege then null;end;
 raise notice 'PASS anonymous list RPC remains inaccessible';
end$$;
reset role;
rollback;
