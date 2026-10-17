-- LOCAL ONLY: combine prerequisite/current migrations in one transaction on
-- supabase_db_uc-life-issues. All fixtures and schema changes roll back.
begin;
create temp table credential_fixture(n int,f uuid,person uuid,request uuid,issue uuid,definition uuid,badge_request uuid,award uuid);
grant select on credential_fixture to authenticated;
do $$
declare actor uuid:='454e4e2b-09b0-4619-9470-c0bf4ac228e0'; approver uuid:='6ff24c6b-5d15-424e-963c-1b24dbff3903';
 org uuid;seed public.life_offerings;issuer uuid:=gen_random_uuid();test_issuer uuid:=gen_random_uuid();template uuid:=gen_random_uuid();
 enrollment_policy uuid;completion_policy uuid;badge_policy uuid:=gen_random_uuid();person uuid;hidden_person uuid:=gen_random_uuid();
 f uuid;r uuid;i uuid;d uuid;br uuid;award uuid;app uuid;enr uuid;run uuid;status text;artifact text;
begin
 select org_id into org from public.life_role_assignments where person_id=actor and role='COURSE_MANAGER' limit 1;
 select * into seed from public.life_offerings where org_id=org limit 1;
 select id into enrollment_policy from public.life_policy_versions where org_id=org and kind='ENROLLMENT' limit 1;
 select id into completion_policy from public.life_policy_versions where org_id=org and kind='COMPLETION' limit 1;
 if seed.id is null or enrollment_policy is null or completion_policy is null then raise exception 'LOCAL_COURSE_FIXTURE_REQUIRED';end if;
 insert into public.life_people(id,name) values(hidden_person,'credential-hidden-person');
 insert into life_private.non_operational_members(person_id,reason) values(hidden_person,'Local visibility fixture');
 insert into public.life_issuer_authorizations(id,org_id,organization_name,title,holder_name,valid_from,valid_until,approval_reference,approved_by,approved_at,seal_omission_basis,test_only)
 values(issuer,org,'Local issuer','Local title','Local holder',now()-interval '1 day',now()+interval '1 year','Local fixture',approver,now(),'Local fixture',false),
 (test_issuer,org,'Local test issuer','Local title','Local holder',now()-interval '1 day',now()+interval '1 year','Local fixture',approver,now(),'Local fixture',true);
 -- Local-only delegation fixture; rolled back with all records.
 insert into public.life_role_assignments(person_id,org_id,role) values(actor,org,'CERTIFIER');
 insert into public.life_issuer_delegations(issuer_id,person_id,kind,valid_from,valid_until,approval_reference)
 select x,actor,k,now()-interval '1 day',now()+interval '1 year','Local fixture' from unnest(array[issuer,test_issuer]) x cross join unnest(array['COMPLETION','BADGE']) k;
 insert into public.life_certificate_templates(id,org_id,kind,version,title,body,approved_by,approved_at,approval_reference)
 values(template,org,'COMPLETION',template::text,'Local template','Local body',approver,now(),'Local fixture');
 insert into public.life_policy_versions(id,org_id,kind,version,title,body,status,approved_by,approved_at)
 values(badge_policy,org,'BADGE',badge_policy::text,'Local badge policy','Local policy','APPROVED',approver,now());
 for n in 1..8 loop
  f:=gen_random_uuid();r:=gen_random_uuid();i:=gen_random_uuid();d:=gen_random_uuid();br:=gen_random_uuid();award:=gen_random_uuid();
  person:=case when n=3 then hidden_person else actor end;
  status:=case n when 6 then 'REVOKED' when 7 then 'SUPERSEDED' else 'ISSUED' end;
  insert into public.life_offerings select (jsonb_populate_record(null::public.life_offerings,to_jsonb(seed)||jsonb_build_object('id',f,'name','credential-course-'||n))).*;
  if n=2 then insert into life_private.non_operational_offerings(offering_id,reason) values(f,'Local course fixture');end if;
  insert into public.life_certificate_requests(id,offering_id,person_id,kind,status) values(r,f,person,'COMPLETION',case when n=8 then 'REQUESTED' else 'ISSUED' end);
  if n<>8 then
   insert into public.life_certificate_issues(id,request_id,issuer_id,template_id,org_id,certificate_no,approved_by,snapshot,evidence_hash,verification_hash,status,file_sha256,issued_at)
   values(i,r,case when n=4 then test_issuer else issuer end,template,org,'local-credential-'||i,approver,
    jsonb_build_object('issuer',jsonb_build_object('test_only',n=5)),repeat('a',64),encode(extensions.digest(i::text,'sha256'),'hex'),status,repeat('b',64),now());
   insert into life_private.certificate_files(issue_id,pdf) values(i,convert_to(repeat('Local opaque byte preservation fixture',10),'UTF8'));
  end if;
  insert into public.life_badge_definitions(id,offering_id,org_id,version,issuer_id,completion_policy_id,policy_id,title,description,achievement,status,created_by,approved_by,approved_at,approval_reference)
  values(d,f,org,1,case when n=4 then test_issuer else issuer end,completion_policy,badge_policy,'Local badge','Local description','Local achievement','APPROVED',actor,approver,now(),'Local approval');
  insert into public.life_badge_requests(id,offering_id,definition_id,person_id,policy_id,status)
  values(br,f,d,person,badge_policy,case when n=8 then 'REQUESTED' else 'ISSUED' end);
  if n<>8 then
   insert into public.life_applications(offering_id,person_id,policy_id,status) values(f,person,enrollment_policy,'SUBMITTED') returning id into app;
   insert into public.life_enrollments(offering_id,person_id,application_id) values(f,person,app) returning id into enr;
   insert into public.life_completion_runs(enrollment_id,offering_id,person_id,input_revision,outcome,reasons,evidence,calculated_by)
   values(enr,f,person,seed.academic_revision,'NEEDS_REVIEW',jsonb_build_array('Local fixture'),'{}',actor) returning id into run;
   artifact:=jsonb_build_object('issuer',jsonb_build_object('test_only',n=5),'fixture','Local immutable JSON')::text;
   insert into public.life_badge_awards(id,request_id,definition_id,org_id,person_id,offering_id,issuer_id,number,completion_run_id,evidence_hash,artifact_text,sha256,issued_by,issued_at,status)
   values(award,br,d,org,person,f,case when n=4 then test_issuer else issuer end,'local-badge-'||award,run,repeat('c',64),artifact,encode(extensions.digest(artifact,'sha256'),'hex'),approver,now(),status);
  end if;
  insert into credential_fixture values(n,f,person,r,case when n=8 then null else i end,d,br,case when n=8 then null else award end);
 end loop;
 update public.life_offerings set name='credential-renamed-course' where id=(select cf.f from credential_fixture cf where cf.n=2);
 update public.life_people set name='credential-renamed-person' where id=hidden_person;
 perform set_config('request.jwt.claims',jsonb_build_object('sub','b3ec6670-7950-4a2c-9562-fb266e004dd0','role','authenticated','aal','aal2','session_id','1a0d6d22-2dd8-433f-a086-5f932d61d162')::text,true);
 if life_private.person_id()<>actor then raise exception 'LOCAL_VERIFIED_ACTOR_REQUIRED';end if;
end$$;
create temp table credential_preserved as
 select 'issues' label,md5(jsonb_agg(to_jsonb(t) order by id)::text) hash from public.life_certificate_issues t
 union all select 'requests',md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.life_certificate_requests t
 union all select 'files',md5(jsonb_agg(to_jsonb(t) order by issue_id)::text) from life_private.certificate_files t
 union all select 'awards',md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.life_badge_awards t
 union all select 'badge_requests',md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.life_badge_requests t
 union all select 'definitions',md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.life_badge_definitions t;
-- Aggregates consume the same operational relations as the screens.
do $$begin
 if (select count(*) from life_private.operational_certificate_requests)<>4 or (select count(*) from life_private.operational_certificate_issues)<>3
 or (select count(*) from life_private.operational_badge_requests)<>4 or (select count(*) from life_private.operational_badge_awards)<>3 then raise exception 'COUNT_AGGREGATE_FAILED';end if;
 if (select count(*) from (select status,count(*) from life_private.operational_certificate_issues group by status) s)<>3
 or (select count(*) from (select status,count(*) from life_private.operational_badge_awards group by status) s)<>3 then raise exception 'STATE_AGGREGATE_FAILED';end if;
 if exists(select 1 from life_private.operational_badge_awards a join credential_fixture f on f.award=a.id where f.n in (2,3,4,5)) then raise exception 'GROUP_AGGREGATE_EXPOSED';end if;
 raise notice 'PASS common count/status/group aggregates; normal revoked/superseded history retained';
end$$;
set local role authenticated;
do $$
declare x jsonb;f credential_fixture;wallet jsonb;
begin
 x:=public.life_certificate_list();
 if jsonb_array_length(x)<>4 then raise exception 'CERTIFICATE_LIST_FAILED';end if;
 if jsonb_array_length(public.life_certificate_options()->'issuers')<>1 or jsonb_array_length(public.life_badge_options()->'issuers')<>1 then raise exception 'TEST_ISSUER_OPTION_EXPOSED';end if;
 wallet:=public.life_badge_wallet();
 if jsonb_array_length(wallet->'requests')<>4 or jsonb_array_length(wallet->'awards')<>3 then raise exception 'WALLET_FAILED';end if;
 for f in select * from credential_fixture loop
  if f.n=2 then
   begin perform public.life_badge_board(f.f);raise exception 'HIDDEN_COURSE_BOARD_EXPOSED';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
  else
   x:=public.life_badge_board(f.f);
   if jsonb_array_length(x->'requests')<>(case when f.n in (3,4,5) then 0 else 1 end)
    or jsonb_array_length(x->'awards')<>(case when f.n in (3,4,5,8) then 0 else 1 end) then raise exception 'BOARD_SCOPE_FAILED %',f.n;end if;
  end if;
  if f.n in (2,3,4,5) then
   begin perform public.life_certificate_detail(f.issue);raise exception 'HIDDEN_CERTIFICATE_EXPOSED';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
   begin perform public.life_badge_detail(f.award);raise exception 'HIDDEN_BADGE_EXPOSED';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
  elsif f.n<>8 then
   if public.life_certificate_detail(f.issue) is null or public.life_badge_detail(f.award) is null then raise exception 'NORMAL_DETAIL_LOST';end if;
  end if;
 end loop;
 if has_table_privilege(current_user,'life_private.operational_certificate_issues','SELECT') or has_table_privilege(current_user,'life_private.operational_badge_awards','SELECT')
 or has_function_privilege(current_user,'life_private.operational_credential_context(uuid,uuid,uuid)','EXECUTE') then raise exception 'PRIVATE_SCOPE_EXPOSED';end if;
 raise notice 'PASS lists/options/board/wallet/details: hidden course/person/issuer/snapshot exclusion and real pending/revoked/superseded retention';
end$$;
reset role;
do $$begin
 if exists(select * from credential_preserved except (
 select 'issues',md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.life_certificate_issues t
 union all select 'requests',md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.life_certificate_requests t
 union all select 'files',md5(jsonb_agg(to_jsonb(t) order by issue_id)::text) from life_private.certificate_files t
 union all select 'awards',md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.life_badge_awards t
 union all select 'badge_requests',md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.life_badge_requests t
 union all select 'definitions',md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.life_badge_definitions t)) then raise exception 'ORIGINAL_PAYLOAD_MUTATED';end if;
 raise notice 'PASS original requests/issues/definitions/artifact text/file bytes hash preservation';
end$$;
select set_config('request.jwt.claims','{"sub":"41d6ddcd-af44-49aa-9579-c48231377a2d","role":"authenticated","aal":"aal2","session_id":"d4880b5a-cde3-433f-9457-74a713ad5a3c"}',true);
set local role authenticated;
do $$declare f credential_fixture;begin
 select * into f from credential_fixture where n=1;
 begin perform public.life_badge_board(f.f);raise exception 'FOREIGN_BOARD_EXPOSED';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 begin perform public.life_certificate_detail(f.issue);raise exception 'FOREIGN_CERTIFICATE_EXPOSED';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 begin perform public.life_badge_detail(f.award);raise exception 'FOREIGN_BADGE_EXPOSED';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 raise notice 'PASS unrelated authenticated actor forbidden';
end$$;
reset role;
select set_config('request.jwt.claims','{}',true);
set local role anon;
do $$begin
 begin perform public.life_certificate_list();raise exception 'ANON_LIST_EXPOSED';exception when insufficient_privilege then null;end;
 begin perform public.life_badge_wallet();raise exception 'ANON_WALLET_EXPOSED';exception when insufficient_privilege then null;end;
 if has_table_privilege(current_user,'life_private.operational_certificate_issues','SELECT') then raise exception 'ANON_VIEW_EXPOSED';end if;
 raise notice 'PASS anonymous read/private view access denied';
end$$;
reset role;
rollback;
