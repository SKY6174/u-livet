-- Local Supabase integration fixture only. Apply the migration and this file in
-- one transaction on supabase_db_uc-life-issues; this file always rolls back.
begin;
create temp table operational_fixture(real_id uuid,hidden_id uuid,hidden_application uuid,staff_user uuid,staff_session uuid,foreign_id uuid);
grant select on operational_fixture to authenticated;
do $$
declare seed public.life_offerings; doc public.life_learner_document_requests;
 actor uuid; staff_user uuid; staff_session uuid; real_id uuid:=gen_random_uuid(); hidden_id uuid:=gen_random_uuid();
 policy uuid; person uuid; first_person uuid; app uuid; hidden_application uuid; foreign_id uuid;
begin
 select p.id,l.auth_user_id,s.id into actor,staff_user,staff_session
 from public.life_people p join public.life_auth_links l on l.person_id=p.id
 join auth.sessions s on s.user_id=l.auth_user_id
 where p.name='[검증용] 담당자' and exists(select 1 from public.life_role_assignments r where r.person_id=p.id and r.role='COURSE_MANAGER') limit 1;
 if actor is null then raise exception 'LOCAL_MANAGER_FIXTURE_REQUIRED';end if;
 select o.* into seed from public.life_offerings o where life_private.operational_offering(o.id)
 and exists(select 1 from public.life_role_assignments r where r.person_id=actor and r.role='COURSE_MANAGER' and r.org_id=o.org_id) limit 1;
 if seed.id is null then raise exception 'LOCAL_COURSE_FIXTURE_REQUIRED';end if;
 select id into policy from public.life_policy_versions where org_id=seed.org_id and kind='ENROLLMENT' limit 1;
 insert into public.life_offerings select (jsonb_populate_record(null::public.life_offerings,to_jsonb(seed)||jsonb_build_object('id',real_id,'name','[검증용] operational-visible-fixture'))).*;
 insert into public.life_offerings select (jsonb_populate_record(null::public.life_offerings,to_jsonb(seed)||jsonb_build_object('id',hidden_id,'name','[검증용] operational-hidden-fixture'))).*;
 insert into life_private.non_operational_offerings values(hidden_id,'Local classification regression',now());
 for i in 1..45 loop
  person:=gen_random_uuid(); if i=1 then first_person:=person;end if;
  insert into public.life_people(id,name) values(person,'operational-fixture-'||lpad(i::text,2,'0'));
  insert into public.life_applications(offering_id,person_id,policy_id,status) values(real_id,person,policy,'SUBMITTED');
 end loop;
 for i in 1..7 loop
  person:=gen_random_uuid();insert into public.life_people(id,name) values(person,'hidden-fixture-'||i);
  insert into public.life_applications(offering_id,person_id,policy_id,status) values(hidden_id,person,policy,'SUBMITTED') returning id into app;
  hidden_application:=app;
 end loop;
 -- A person with real and hidden applications keeps the real history/count.
 insert into public.life_applications(offering_id,person_id,policy_id,status) values(hidden_id,first_person,policy,'SUBMITTED');
 update public.life_offerings set name='[검증용] renamed-hidden-fixture' where id=hidden_id;
 select o.id into foreign_id from public.life_offerings o where not exists(select 1 from public.life_role_assignments r where r.person_id=actor and r.org_id=o.org_id and r.role='COURSE_MANAGER') limit 1;
 if foreign_id is null then raise exception 'LOCAL_OTHER_ORG_FIXTURE_REQUIRED';end if;
 insert into operational_fixture values(real_id,hidden_id,hidden_application,staff_user,staff_session,foreign_id);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',staff_user,'role','authenticated','aal','aal2','session_id',staff_session)::text,true);
 if not life_private.mfa_verified() then raise exception 'LOCAL_MANAGER_CONSENT_REQUIRED';end if;
end$$;

set local role authenticated;
do $$
declare f operational_fixture; board jsonb; next_page jsonb; detail jsonb;
begin
 select * into f from operational_fixture;
 if not life_private.operational_offering(f.real_id) or life_private.operational_offering(f.hidden_id) then raise exception 'CLASSIFICATION_FAILED';end if;
 if (select count(*) from public.life_catalog where id=f.real_id)<>1 or exists(select 1 from public.life_catalog where id=f.hidden_id) then raise exception 'CATALOG_RLS_FAILED';end if;
 if has_table_privilege(current_user,'life_private.non_operational_offerings','SELECT') then raise exception 'CLASSIFICATION_EXPOSED';end if;
 board:=public.life_management_applications(f.real_id,'','',1);
 next_page:=public.life_management_applications(f.real_id,'','',2);
 if (board->>'count')::int<>45 or jsonb_array_length(board->'items')<>40 or jsonb_array_length(next_page->'items')<>5 then raise exception 'PAGINATION_FAILED';end if;
 if exists(select 1 from jsonb_array_elements(board->'items') a join jsonb_array_elements(next_page->'items') b on a->>'id'=b->>'id') then raise exception 'PAGE_OVERLAP';end if;
 board:=public.life_management_applications(null,'hidden-fixture-','',1);
 if (board->>'count')::int<>0 or jsonb_array_length(board->'items')<>0 then raise exception 'HIDDEN_SEARCH_FAILED';end if;
 board:=public.life_management_applications(f.real_id,'operational-fixture-01','SUBMITTED',1);
 if (board->>'count')::int<>1 then raise exception 'NORMAL_SEARCH_FAILED';end if;
 if exists(select 1 from jsonb_array_elements(board->'courses') c where c->>'id'=f.hidden_id::text) then raise exception 'COURSE_OPTION_FAILED';end if;
 board:=public.life_management_applications(f.hidden_id,'','',1);
 if (board->>'count')::int<>0 then raise exception 'HIDDEN_FILTER_FAILED';end if;
 board:=public.life_management_learners(f.real_id,'',1);
 if (board->>'count')::int<>45 then raise exception 'LEARNER_COUNT_FAILED';end if;
 if exists(select 1 from jsonb_array_elements(board->'items') i where (i->>'applications')::int<>1) then raise exception 'MIXED_HISTORY_FAILED';end if;
 if public.life_course_workspace(f.hidden_id)<>'[]'::jsonb then raise exception 'WORKSPACE_FAILED';end if;
 if exists(select 1 from public.life_course_introductions(f.hidden_id)) then raise exception 'PUBLIC_INTRO_EXPOSED';end if;
 if exists(select 1 from jsonb_array_elements(public.life_operation_list()) c where c->>'id'=f.hidden_id::text) then raise exception 'OPERATION_LIST_FAILED';end if;
 if exists(select 1 from jsonb_array_elements(public.life_message_options()->'offerings') c where c->>'id'=f.hidden_id::text) then raise exception 'MESSAGE_OPTION_FAILED';end if;
 begin perform public.life_application_detail(f.hidden_application);raise exception 'DETAIL_EXPOSED';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 begin perform public.life_operation_context(f.hidden_id);raise exception 'DOCUMENT_EXPOSED';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 begin perform public.life_management_applications(f.foreign_id,'','',1);raise exception 'FOREIGN_ORG_EXPOSED';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 select public.life_performance_board(project_year_id) into detail from public.life_catalog where id=f.real_id;
 if exists(select 1 from jsonb_array_elements(detail->'facts'->'offerings') c where c->>'id'=f.hidden_id::text)
 or not exists(select 1 from jsonb_array_elements(detail->'facts'->'offerings') c where c->>'id'=f.real_id::text) then raise exception 'PERFORMANCE_SCOPE_FAILED';end if;
 raise notice 'PASS pagination 40/5, search/status/filter/counts, mixed history, RLS/options and direct details';
end$$;
reset role;

-- Clone existing local PDF records without changing their bytes/signatures.
do $$
declare f operational_fixture; seed public.life_learner_document_requests; org uuid; p uuid;
begin
 select * into f from operational_fixture;
 select * into seed from public.life_learner_document_requests where kind='APPLICATION' limit 1;
 if seed.id is null then raise exception 'LOCAL_PDF_FIXTURE_REQUIRED';end if;
 select o.org_id into org from public.life_offerings o where o.id=f.real_id;
 select person_id into p from public.life_applications where offering_id=f.real_id limit 1;
 for i in 1..3 loop
  insert into public.life_learner_document_requests
  select (jsonb_populate_record(null::public.life_learner_document_requests,to_jsonb(seed)||jsonb_build_object(
   'id',gen_random_uuid(),'request_key',gen_random_uuid(),'person_id',p,'org_id',org,
   'offering_id',case when i=1 then f.real_id when i=2 then f.hidden_id else null end,
   'course_name','operational-pdf-fixture-'||i,'applicant_name','operational-pdf-fixture','deleted_at',null))).*;
 end loop;
end$$;
set local role authenticated;
do $$
declare f operational_fixture; desk jsonb;
begin
 select * into f from operational_fixture;
 desk:=public.life_admin_learner_documents(null,null,'operational-pdf-fixture');
 if jsonb_array_length(desk->'requests')<>2 then raise exception 'PDF_SCOPE_FAILED';end if;
 if exists(select 1 from jsonb_array_elements(desk->'requests') r where r->>'offering_id'=f.hidden_id::text) then raise exception 'HIDDEN_PDF_EXPOSED';end if;
 if not exists(select 1 from jsonb_array_elements(desk->'requests') r where r->>'offering_id' is null) then raise exception 'UNLINKED_PDF_LOST';end if;
 if exists(select 1 from jsonb_array_elements(desk->'offerings') r where r->>'id'=f.hidden_id::text) then raise exception 'PDF_LINK_OPTION_FAILED';end if;
 raise notice 'PASS real/unlinked PDF preservation, hidden document/alert exclusion and options';
end$$;
reset role;

select set_config('request.jwt.claims','{}',true);
set local role anon;
do $$
begin
 begin perform public.life_management_applications();raise exception 'ANON_READ_EXPOSED';exception when insufficient_privilege then null;end;
 if has_table_privilege(current_user,'life_private.non_operational_offerings','SELECT') then raise exception 'ANON_CLASSIFICATION_EXPOSED';end if;
 raise notice 'PASS anonymous RPC and private classification access denied';
end$$;
reset role;
rollback;
