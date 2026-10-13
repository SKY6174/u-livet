import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

// This verifier is confined to the existing synthetic local stack and rolls back
// the migration, grants, guide links, drafts, audit events and working copies.
const migration = readFileSync("supabase/migrations/20261013004702_course_draft_pricing.sql", "utf8").replace(/^begin;\s*/, "").replace(/commit;\s*$/, "");
const checks = String.raw`
create temporary table draft_pricing_test(dummy integer);
do $$declare candidate record; chosen boolean:=false;begin
 for candidate in select a.auth_user_id,a.person_id,r.org_id,s.id session_id
  from public.life_auth_links a join auth.users u on u.id=a.auth_user_id
  join auth.sessions s on s.user_id=u.id join public.life_role_assignments r on r.person_id=a.person_id
  where u.email like '%@example.invalid' and r.role='COURSE_MANAGER' order by s.created_at desc loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',candidate.auth_user_id,'role','authenticated','aal','aal1','session_id',candidate.session_id)::text,true);
  if life_private.mfa_verified() and life_private.has_role(candidate.org_id,'COURSE_MANAGER')
   and exists(select 1 from public.life_policy_versions p where life_private.policy_valid(p.id,candidate.org_id,'ENROLLMENT'))
   and exists(select 1 from public.life_policy_versions p where life_private.policy_valid(p.id,candidate.org_id,'COMPLETION')) then
   perform set_config('test.manager_claims',current_setting('request.jwt.claims'),true);
   perform set_config('test.org',candidate.org_id::text,true);
   perform set_config('test.person',candidate.person_id::text,true); chosen:=true;exit;
  end if;
 end loop;
 if not chosen then raise exception 'NO_SYNTHETIC_MANAGER_WITH_POLICY_FIXTURES'; end if;
 perform set_config('test.year',(select id::text from public.life_project_years where org_id=current_setting('test.org')::uuid limit 1),true);
 perform set_config('test.source_year',(select id::text from public.life_project_years where org_id='10000000-0000-4000-8000-000000000001' and extract(year from starts_on)=2026 limit 1),true);
 perform set_config('test.source',(select source_id from public.life_course_guides where source_id is not null and offering_id is null and published limit 1),true);
 insert into public.life_role_assignments(person_id,org_id,role)
 select candidate.person_id,'10000000-0000-4000-8000-000000000001','COURSE_MANAGER'
 where not exists(select 1 from public.life_role_assignments where person_id=candidate.person_id and org_id='10000000-0000-4000-8000-000000000001' and role='COURSE_MANAGER');
end$$;

create function pg_temp.test_draft(amount integer,source text default null,target_org uuid default null,seats integer default 20)
 returns uuid language sql as $$
 select public.life_create_offering_with_tuition(
  coalesce(target_org,case when source is null then current_setting('test.org')::uuid else '10000000-0000-4000-8000-000000000001'::uuid end),
  case when source is null then current_setting('test.year')::uuid else current_setting('test.source_year')::uuid end,
  '[TEST] Issue171 draft pricing','로컬창업 아카데미','Synthetic local test','Synthetic local test',
  'OFFLINE','Local fixture',seats,'REVIEW',now()-interval '1 day',now()+interval '1 day',current_date+2,current_date+3,amount,source)
$$;

set local role authenticated;
select set_config('test.free',pg_temp.test_draft(0)::text,true);
select set_config('test.paid',pg_temp.test_draft(150000)::text,true);
select set_config('test.linked',pg_temp.test_draft(250000,current_setting('test.source'))::text,true);
do $$declare amount integer;begin
 foreach amount in array array[-1,100000001,null] loop
  begin perform pg_temp.test_draft(amount);raise exception 'EXPECTED_INVALID_TUITION';
  exception when raise_exception then if sqlerrm<>'INVALID_TUITION' then raise;end if;end;
 end loop;
 begin perform pg_temp.test_draft(100,null,gen_random_uuid());raise exception 'EXPECTED_FORBIDDEN';
 exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 begin perform pg_temp.test_draft(100,null,null,0);raise exception 'EXPECTED_CAPACITY_FAILURE';
 exception when check_violation then null;end;
end$$;
reset role;
do $$declare total integer; enrollment uuid; completion uuid;payload jsonb;begin
 if not exists(select 1 from public.life_offerings where id=current_setting('test.free')::uuid and tuition=0 and status='DRAFT')
 or not exists(select 1 from public.life_offerings where id=current_setting('test.paid')::uuid and tuition=150000 and status='DRAFT')
 or not exists(select 1 from public.life_offerings where id=current_setting('test.linked')::uuid and tuition=250000 and status='DRAFT') then raise exception 'DRAFT_TUITION_NOT_SAVED';end if;
 if not exists(select 1 from public.life_course_guides where source_id=current_setting('test.source') and offering_id=current_setting('test.linked')::uuid) then raise exception 'SOURCE_NOT_LINKED';end if;
 select count(*) into total from public.life_courses where title='[TEST] Issue171 draft pricing';
 if total<>3 then raise exception 'PARTIAL_CREATION_NOT_ROLLED_BACK: %',total;end if;
 select p.id into enrollment from public.life_policy_versions p where life_private.policy_valid(p.id,current_setting('test.org')::uuid,'ENROLLMENT') limit 1;
 select p.id into completion from public.life_policy_versions p where life_private.policy_valid(p.id,current_setting('test.org')::uuid,'COMPLETION') limit 1;
 begin perform public.life_publish(current_setting('test.paid')::uuid,enrollment,completion);raise exception 'EXPECTED_REFUND_POLICY_GUARD';
 exception when raise_exception then if sqlerrm<>'APPROVED_REFUND_POLICY_REQUIRED' then raise;end if;end;
 if (select status from public.life_offerings where id=current_setting('test.paid')::uuid)<>'DRAFT' then raise exception 'PAID_DRAFT_PUBLISHED';end if;
 payload:=jsonb_build_object('year','','title','','academy','','location','','mode','','selection_method','','capacity','','apply_from','','apply_until','','starts_on','','ends_on','','summary','','curriculum','');
 if not life_private.valid_opening_copy(payload) or not life_private.valid_opening_copy(payload||'{"fee_type":"PAID","tuition":""}')
 or not life_private.valid_opening_copy(payload||'{"fee_type":"PAID","tuition":"150000"}') then raise exception 'COPY_COMPATIBILITY';end if;
 if life_private.valid_opening_copy(payload||'{"fee_type":"FREE","tuition":"150000"}') or life_private.valid_opening_copy(payload||'{"fee_type":"PAID","tuition":"0"}')
 or life_private.valid_opening_copy(payload||'{"fee_type":"PAID","tuition":"1.5"}') or life_private.valid_opening_copy(payload||'{"fee_type":"PAID","tuition":"100000001"}')
 or life_private.valid_opening_copy(payload||'{"extra":""}') then raise exception 'INVALID_COPY_ACCEPTED';end if;
 -- Use an unused source for this actor, retaining all prior copies unchanged.
 perform public.life_save_opening_working_copy('10000000-0000-4000-8000-000000000001',current_setting('test.source'),payload||'{"fee_type":"PAID","tuition":"150000"}',
  coalesce((select revision from public.life_opening_working_copies where person_id=current_setting('test.person')::uuid and org_id='10000000-0000-4000-8000-000000000001' and source_id=current_setting('test.source')),0));
 if public.life_opening_working_copy('10000000-0000-4000-8000-000000000001',current_setting('test.source'))->'payload'->>'tuition'<>'150000' then raise exception 'PAID_COPY_NOT_RESTORED';end if;
 if not exists(select 1 from public.life_audit_events where entity_id=current_setting('test.paid')::uuid and action='OFFERING_DRAFT_TUITION_SET' and details->>'tuition'='150000') then raise exception 'AUDIT_MISSING';end if;
 raise notice 'PASS: free/paid/source drafts, invalid amounts, organization isolation, atomic rollback, refund policy guard, legacy/paid copies and audit';
end$$;
set local role anon;
do $$begin
 begin perform pg_temp.test_draft(0);raise exception 'ANON_WAS_ALLOWED';exception when insufficient_privilege then null;end;
end$$;
reset role;
do $$begin
 if has_function_privilege('anon','public.life_create_offering_with_tuition(uuid,uuid,text,text,text,text,text,text,integer,text,timestamptz,timestamptz,date,date,integer,text)','EXECUTE')
 or has_function_privilege('service_role','public.life_create_offering_with_tuition(uuid,uuid,text,text,text,text,text,text,integer,text,timestamptz,timestamptz,date,date,integer,text)','EXECUTE')
 or not has_function_privilege('authenticated','public.life_create_offering_with_tuition(uuid,uuid,text,text,text,text,text,text,integer,text,timestamptz,timestamptz,date,date,integer,text)','EXECUTE') then raise exception 'RPC_EXECUTION_GRANTS';end if;
 perform set_config('request.jwt.claims','{"role":"authenticated"}',true);
 begin perform pg_temp.test_draft(0);raise exception 'MISSING_AUTH_WAS_ALLOWED';exception when raise_exception then if sqlerrm<>'AUTH_REQUIRED' then raise;end if;end;
 raise notice 'PASS: anonymous/service-role denied; authenticated allowed; missing identity rejected';
end$$;
`;
const output = execFileSync("docker", ["exec", "-i", "supabase_db_uc-life-issues", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], { input: `begin;\n${migration}\n${checks}\nrollback;`, encoding: "utf8", maxBuffer: 2_000_000 });
console.log(output.split("\n").filter(line => /ROLLBACK/.test(line)).join("\n"));
