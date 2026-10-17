-- LOCAL ONLY: run through verify-admin-loading.mjs; all work is rolled back.
create temp table loading_fixture(org uuid,foreign_org uuid,courses uuid[],original_roles jsonb,center_email text);
create temp table loading_auth as select id,email_confirmed_at,deleted_at from auth.users
 where id='b3ec6670-7950-4a2c-9562-fb266e004dd0';
grant select on loading_fixture to authenticated,anon;
do $$declare actor uuid:='454e4e2b-09b0-4619-9470-c0bf4ac228e0';seed public.life_offerings;
 org uuid;foreign_org uuid;ids uuid[]:='{}';f uuid;policy uuid;a uuid;state text;center text;roles jsonb;email text;
begin
 select r.org_id into org from public.life_role_assignments r where r.person_id=actor and r.role='COURSE_MANAGER' limit 1;
 select * into seed from public.life_offerings o where o.org_id=org limit 1;
 select o.org_id into foreign_org from public.life_offerings o where o.org_id<>org limit 1;
 select jsonb_agg(to_jsonb(r)) into roles from public.life_role_assignments r where r.person_id=actor;
 select reviewer_email into email from public.life_parking_centers where code='RCC';
 select p.id into policy from public.life_policy_versions p where p.org_id=org and p.kind='ENROLLMENT' limit 1;
 if seed.id is null or foreign_org is null then raise exception 'LOCAL_MANAGER_FIXTURE_REQUIRED';end if;
 for i in 1..6 loop
  f:=gen_random_uuid();ids:=array_append(ids,f);state:=case i when 1 then 'DRAFT' when 2 then 'PUBLISHED' when 3 then 'CLOSED' when 4 then 'ARCHIVED' when 5 then 'ARCHIVED' else 'PUBLISHED' end;
  insert into public.life_offerings select (jsonb_populate_record(null::public.life_offerings,to_jsonb(seed)||jsonb_build_object(
   'id',f,'name','loading-fixture-'||i,'status',state,'public_introduction',i=4,
   'starts_on',make_date(2026,1,i),'ends_on',make_date(2026,12,i),
   'apply_from',case when state='ARCHIVED' then null else '2025-12-01T00:00:00Z' end,
   'apply_until',case when state='ARCHIVED' then null else '2025-12-31T00:00:00Z' end,
   'tuition',case when state='ARCHIVED' then null else 0 end,'selection_method',case when state='ARCHIVED' then null else 'REVIEW' end))).*;
 end loop;
 insert into life_private.non_operational_offerings values(ids[6],'Local hidden metadata fixture',now());
 insert into public.life_offering_instructors(offering_id,person_id) values(ids[1],actor);
 insert into public.life_applications(offering_id,person_id,policy_id,status) values(ids[1],actor,policy,'ACCEPTED') returning id into a;
 insert into public.life_enrollments(offering_id,person_id,application_id,status) values(ids[1],actor,a,'ACTIVE');
 for i in 1..3 loop
  center:=case i when 1 then 'RCC' when 2 then 'ECC' else 'AID-X' end;
  insert into public.life_parking_stock(org_id,center_code,balance) values(org,center,99)
   on conflict(org_id,center_code) do update set balance=99;
 end loop;
 insert into public.life_parking_offering_centers(offering_id,org_id,center_code,set_by) values(ids[2],org,'RCC',actor);
 for i in 1..7 loop
  state:=case i when 1 then 'PENDING' when 2 then 'APPROVED' when 3 then 'REJECTED' when 4 then 'CANCELLED' else 'PENDING' end;
  insert into public.life_parking_requests(org_id,offering_id,center_code,person_id,applicant_kind,course_name,recipient_name,phone,use_on,quantity,status,requested_at,reviewed_at,reviewer_id,decision_note,remaining_after)
  values(org,ids[2],case when i%2=0 then 'ECC' else 'RCC' end,actor,'LEARNER','Local parking course','Local recipient','01000000000',
   case i when 6 then '2025-12-31'::date when 7 then '2027-01-01'::date else make_date(2026,1,i) end,
   1,state,now()+i*interval '1 second',case when state in('APPROVED','REJECTED') then now() end,
   case when state in('APPROVED','REJECTED') then actor end,case when state='REJECTED' then 'Local reason' else '' end,
   case when state='APPROVED' then 98 end);
 end loop;
 update public.life_parking_centers set reviewer_email=(select lower(u.email) from auth.users u where u.id='b3ec6670-7950-4a2c-9562-fb266e004dd0') where code='RCC';
 insert into loading_fixture values(org,foreign_org,ids,roles,email);
end$$;
do $$begin execute replace(pg_get_functiondef('life_private.parking_admin_context(integer,text)'::regprocedure),
 'CREATE OR REPLACE FUNCTION life_private.parking_admin_context','CREATE OR REPLACE FUNCTION pg_temp.before_parking');end$$;
create temp table loading_old_hash as select md5(pg_get_functiondef('life_private.parking_admin_context(integer,text)'::regprocedure)) hash;

-- APPLY_OPTIMIZATION_HERE

do $$begin raise notice 'FUNCTION_HASH old % new %',(select hash from loading_old_hash),md5(pg_get_functiondef('life_private.parking_admin_context(integer,text)'::regprocedure));end$$;
-- Invoker: both views execute the current authenticated/anon caller's real RLS.
create function pg_temp.compare_catalog(label text) returns void language plpgsql as $$
declare old_rows jsonb;new_rows jsonb;f loading_fixture;v_scope_mode int;begin
 select * into f from loading_fixture;
 for v_scope_mode in 1..3 loop
  select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc,id),'[]') into old_rows from
   (select id,org_id,name,status,capacity,year_label,starts_on,ends_on,created_at from public.life_catalog
    where v_scope_mode=1 or (v_scope_mode=2 and org_id=f.org) or (v_scope_mode=3 and id=any(f.courses)))x;
  select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc,id),'[]') into new_rows from
   (select id,org_id,name,status,capacity,year_label,starts_on,ends_on,created_at from public.life_workspace_catalog
    where v_scope_mode=1 or (v_scope_mode=2 and org_id=f.org) or (v_scope_mode=3 and id=any(f.courses)))x;
  if old_rows is distinct from new_rows then raise exception 'CATALOG_SCOPE_MISMATCH % scope %',label,v_scope_mode;end if;
 end loop;
 if exists(select 1 from public.life_workspace_catalog where id=f.courses[6]) then raise exception 'HIDDEN_COURSE_EXPOSED';end if;
end$$;
create function pg_temp.compare_parking(label text) returns void language plpgsql as $$
declare args record;a jsonb;b jsonb;old_error text;new_error text;begin
 for args in select * from(values(2026,null::text),(2026,'RCC'),(2026,'ECC'),(2026,'AID-X'),(2025,null),(2027,null),(null,null),(2019,null),(2026,'INVALID'))v(y,c) loop
  a:=null;b:=null;old_error:=null;new_error:=null;
  begin a:=pg_temp.before_parking(args.y,args.c);exception when others then old_error:=sqlstate||':'||sqlerrm;end;
  begin b:=public.life_parking_admin_context(args.y,args.c);exception when others then new_error:=sqlstate||':'||sqlerrm;end;
  if a is distinct from b or old_error is distinct from new_error then raise exception 'PARKING_SCOPE_MISMATCH % year % center %',label,args.y,args.c;end if;
 end loop;
 raise notice 'PASS %: parking JSON/errors across 9 inputs and metadata RLS scopes',label;
end$$;
create temp table loading_hashes(name text,digest text);
do $$declare name text;begin
 foreach name in array array['life_parking_requests','life_parking_stock','life_parking_stock_events','life_parking_offering_centers','life_parking_centers','life_offerings','life_people','life_applications','life_enrollments'] loop
  execute format('insert into loading_hashes select %L,md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'''')) from public.%I t',name,name);
 end loop;
end$$;
select set_config('request.jwt.claims','{"sub":"b3ec6670-7950-4a2c-9562-fb266e004dd0","role":"authenticated","aal":"aal2","session_id":"1a0d6d22-2dd8-433f-a086-5f932d61d162"}',true);
set local role authenticated;
select pg_temp.compare_catalog('manager'),pg_temp.compare_parking('manager');
do $$declare x jsonb;f loading_fixture;begin
 select * into f from loading_fixture;x:=public.life_parking_admin_context(2026,null);
 if (select count(*) from jsonb_array_elements(x->'requests')r where r->>'course_name'='Local parking course')<>5 then raise exception 'WHOLE_YEAR_LEDGER_FAILED';end if;
 if not exists(select 1 from jsonb_array_elements(x->'requests')r where r->>'course_name'='Local parking course' and r->>'center_code'='RCC' and (r->>'can_decide')::boolean)
 or exists(select 1 from jsonb_array_elements(x->'requests')r where r->>'course_name'='Local parking course' and r->>'center_code'='ECC' and (r->>'can_decide')::boolean) then raise exception 'CENTER_REVIEW_PERMISSION_FAILED';end if;
 if (select count(*) from public.life_workspace_catalog where id=any(f.courses))<>5 then raise exception 'NORMAL_DRAFT_ARCHIVE_LOST';end if;
 if has_table_privilege(current_user,'public.life_workspace_catalog','INSERT') or has_table_privilege(current_user,'public.life_workspace_catalog','UPDATE') or has_table_privilege(current_user,'public.life_workspace_catalog','DELETE') then raise exception 'VIEW_WRITE_PRIVILEGE';end if;
 raise notice 'PASS explicit full-year states, center reviewer, normal draft/archive and SELECT-only view';
end$$;
do $$declare pair int;kind text;started timestamptz;old_ms numeric;new_ms numeric;plan jsonb;begin
 foreach kind in array array['parking','catalog'] loop
  for pair in 1..8 loop
   if pair%2=0 then
    started:=clock_timestamp();if kind='parking' then perform public.life_parking_admin_context(2026,null);else perform id,org_id,name,status,capacity,year_label,starts_on,ends_on from public.life_workspace_catalog order by created_at desc,id;end if;
    new_ms:=round(extract(epoch from clock_timestamp()-started)*1000,2);
   end if;
   started:=clock_timestamp();if kind='parking' then perform pg_temp.before_parking(2026,null);else perform id,org_id,name,status,capacity,year_label,starts_on,ends_on from public.life_catalog order by created_at desc,id;end if;
   old_ms:=round(extract(epoch from clock_timestamp()-started)*1000,2);
   if pair%2=1 then
    started:=clock_timestamp();if kind='parking' then perform public.life_parking_admin_context(2026,null);else perform id,org_id,name,status,capacity,year_label,starts_on,ends_on from public.life_workspace_catalog order by created_at desc,id;end if;
    new_ms:=round(extract(epoch from clock_timestamp()-started)*1000,2);
   end if;
   raise notice 'PAIR % % old_ms % new_ms %',kind,pair,old_ms,new_ms;
  end loop;
 end loop;
 execute 'explain(analyze,buffers,format json) select id,org_id,name,status,capacity,year_label,starts_on,ends_on from public.life_catalog order by created_at desc,id' into plan;
 raise notice 'PLAN old %',plan;
 execute 'explain(analyze,buffers,format json) select id,org_id,name,status,capacity,year_label,starts_on,ends_on from public.life_workspace_catalog order by created_at desc,id' into plan;
 raise notice 'PLAN new %',plan;
end$$;
reset role;
select set_config('request.jwt.claims','{}',true);
do $$declare role_name text;f loading_fixture;begin
 select * into f from loading_fixture;
 foreach role_name in array array['INSTRUCTOR','CERTIFIER','PERFORMANCE','SYSTEM_ADMIN'] loop
  delete from public.life_role_assignments where person_id='454e4e2b-09b0-4619-9470-c0bf4ac228e0';
  insert into public.life_role_assignments(person_id,org_id,role) values('454e4e2b-09b0-4619-9470-c0bf4ac228e0',f.org,role_name);
  perform set_config('request.jwt.claims','{"sub":"b3ec6670-7950-4a2c-9562-fb266e004dd0","role":"authenticated","aal":"aal2","session_id":"1a0d6d22-2dd8-433f-a086-5f932d61d162"}',true);
  set local role authenticated;perform pg_temp.compare_catalog(role_name);perform pg_temp.compare_parking(role_name);reset role;
  perform set_config('request.jwt.claims','{}',true);
 end loop;
 delete from public.life_role_assignments where person_id='454e4e2b-09b0-4619-9470-c0bf4ac228e0';
 insert into public.life_role_assignments select * from jsonb_populate_recordset(null::public.life_role_assignments,f.original_roles);
 -- Future and expired foreign roles cannot widen access; duplicates do not multiply rows.
 insert into public.life_role_assignments(person_id,org_id,role,valid_from,valid_until)
 values('454e4e2b-09b0-4619-9470-c0bf4ac228e0',f.foreign_org,'COURSE_MANAGER',now()-interval '2 days',now()-interval '1 day'),
 ('454e4e2b-09b0-4619-9470-c0bf4ac228e0',f.foreign_org,'SYSTEM_ADMIN',now()+interval '1 day',null),
 ('454e4e2b-09b0-4619-9470-c0bf4ac228e0',f.org,'COURSE_MANAGER',now(),null);
end$$;
select set_config('request.jwt.claims','{"sub":"b3ec6670-7950-4a2c-9562-fb266e004dd0","role":"authenticated","aal":"aal2","session_id":"1a0d6d22-2dd8-433f-a086-5f932d61d162"}',true);
set local role authenticated;
select pg_temp.compare_catalog('role validity'),pg_temp.compare_parking('role validity');
reset role;
select set_config('request.jwt.claims','{}',true);
insert into public.life_role_assignments(person_id,org_id,role)
 select '454e4e2b-09b0-4619-9470-c0bf4ac228e0',foreign_org,'COURSE_MANAGER' from loading_fixture;
select set_config('request.jwt.claims','{"sub":"b3ec6670-7950-4a2c-9562-fb266e004dd0","role":"authenticated","aal":"aal2","session_id":"1a0d6d22-2dd8-433f-a086-5f932d61d162"}',true);
set local role authenticated;
select pg_temp.compare_catalog('multiple organizations'),pg_temp.compare_parking('multiple organizations');
reset role;
select set_config('request.jwt.claims','{}',true);
update auth.users set email_confirmed_at=null where id='b3ec6670-7950-4a2c-9562-fb266e004dd0';
select set_config('request.jwt.claims','{"sub":"b3ec6670-7950-4a2c-9562-fb266e004dd0","role":"authenticated","aal":"aal2","session_id":"1a0d6d22-2dd8-433f-a086-5f932d61d162"}',true);
set local role authenticated;
select pg_temp.compare_catalog('unconfirmed email'),pg_temp.compare_parking('unconfirmed email');
reset role;
select set_config('request.jwt.claims','{}',true);
update auth.users u set email_confirmed_at=b.email_confirmed_at,deleted_at=now() from loading_auth b where u.id=b.id;
select set_config('request.jwt.claims','{"sub":"b3ec6670-7950-4a2c-9562-fb266e004dd0","role":"authenticated","aal":"aal2","session_id":"1a0d6d22-2dd8-433f-a086-5f932d61d162"}',true);
set local role authenticated;
select pg_temp.compare_catalog('deleted user'),pg_temp.compare_parking('deleted user');
reset role;
select set_config('request.jwt.claims','{}',true);
update auth.users u set email_confirmed_at=b.email_confirmed_at,deleted_at=b.deleted_at from loading_auth b where u.id=b.id;
select set_config('request.jwt.claims','{"sub":"41d6ddcd-af44-49aa-9579-c48231377a2d","role":"authenticated","aal":"aal2","session_id":"d4880b5a-cde3-433f-9457-74a713ad5a3c"}',true);
set local role authenticated;
select pg_temp.compare_catalog('other institution'),pg_temp.compare_parking('other institution');
reset role;
select set_config('request.jwt.claims','{"sub":"b3ec6670-7950-4a2c-9562-fb266e004dd0","role":"authenticated","aal":"aal1","session_id":"1a0d6d22-2dd8-433f-a086-5f932d61d162"}',true);
set local role authenticated;
select pg_temp.compare_catalog('MFA insufficient'),pg_temp.compare_parking('MFA insufficient');
reset role;
select set_config('request.jwt.claims','{"sub":"b3ec6670-7950-4a2c-9562-fb266e004dd0","role":"authenticated","aal":"aal2","session_id":"00000000-0000-4000-8000-000000000000"}',true);
set local role authenticated;
select pg_temp.compare_catalog('invalid session'),pg_temp.compare_parking('invalid session');
reset role;
select set_config('request.jwt.claims','{}',true);
set local role anon;
select pg_temp.compare_catalog('anonymous');
do $$begin
 begin perform public.life_parking_admin_context(2026,null);raise exception 'ANON_PARKING_EXPOSED';exception when insufficient_privilege then null;end;
 raise notice 'PASS anonymous metadata retains RLS and parking RPC remains denied';
end$$;
reset role;
do $$declare r record;digest text;begin
 for r in select * from loading_hashes loop
  execute format('select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'''')) from public.%I t',r.name) into digest;
  if digest is distinct from r.digest then raise exception 'READ_MUTATED_ORIGINAL %',r.name;end if;
 end loop;
 if not exists(select 1 from pg_class where oid='public.life_workspace_catalog'::regclass and reloptions @> array['security_invoker=true']) then raise exception 'VIEW_MUST_INVOKE_CALLER_RLS';end if;
 raise notice 'PASS original stock, stock events, requests, mappings, centers, offerings, people, applications and enrollments unchanged';
end$$;
rollback;
