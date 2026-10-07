// Native Auth claims, old/new complete RPC results, local-only rollback fixtures.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const dir = process.env.APPLICATION_TEST_DB_DIR;
assert.ok(dir);
assert.match(readFileSync(resolve(dir,"supabase/config.toml"),"utf8"), /^project_id = "uc-life-issues"$/m);
const config = JSON.parse(execFileSync("supabase",["status","--workdir",dir,"-o","json"],{encoding:"utf8",stdio:["ignore","pipe","pipe"]}));
assert.equal(config.API_URL,"http://127.0.0.1:56321");
const container="supabase_db_uc-life-issues";
assert.equal(JSON.parse(execFileSync("docker",["inspect",container],{encoding:"utf8"}))[0].Config.Labels["com.supabase.cli.project"],"uc-life-issues");
const sql=q=>execFileSync("docker",["exec","-i",container,"psql","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-qtA"],{input:q,encoding:"utf8",stdio:["pipe","pipe","pipe"]}).trim();
const {ids,learner,manager,instructor,password}=JSON.parse(readFileSync("/tmp/u-livet-issues-browser-fixtures.json","utf8"));
for (const id of [ids.offering,ids.org,ids.otherOrg,learner.person,instructor.person]) assert.match(id,/^[0-9a-f-]{36}$/);
assert.ok(sql(`select name from public.life_offerings where id='${ids.offering}'`).startsWith("[검증용]"));
async function claims(account) {
  const db=createClient(config.API_URL,config.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const result=await db.auth.signInWithPassword({email:account.email,password});assert.ifError(result.error);
  return JSON.parse(Buffer.from(result.data.session.access_token.split(".")[1],"base64url"));
}
const sessions=await Promise.all([learner,manager,instructor].map(claims));
const previous=readFileSync("supabase/migrations/20261007113241_application_document_link.sql","utf8");
const oldMy=previous.match(/create function life_private\.my_learner_documents\(\)[\s\S]*?end\$\$;/)[0].replace("life_private.my_learner_documents()","pg_temp.previous_my_documents()");
const oldAdmin=previous.match(/create function life_private\.admin_learner_documents\([\s\S]*?end\$\$;/)[0].replace("life_private.admin_learner_documents(","pg_temp.previous_admin_documents(");
const migration=readFileSync("supabase/migrations/20261007124307_batch_learner_document_registration.sql","utf8").replace(/^begin;\s*/,"").replace(/\s*commit;\s*$/,"").replace("create function life_private.document_registration_states","create or replace function life_private.document_registration_states");
const second=randomUUID();
const setClaims=value=>`select set_config('request.jwt.claims','${JSON.stringify(value).replaceAll("'","''")}',true);`;
const compare=(label,my=true,admin=false)=>`
do $test$ declare previous jsonb; candidate jsonb; begin
 ${my?`previous:=pg_temp.previous_my_documents(); candidate:=public.life_my_learner_documents();
 if previous is distinct from candidate then raise exception '${label}_MY_MISMATCH'; end if;`:""}
 ${admin?`for previous,candidate in select pg_temp.previous_admin_documents(f.k,f.s,f.q),public.life_admin_learner_documents(f.k,f.s,f.q)
 from (values(null::text,null::text,null::text),('APPLICATION','RECEIVED',null),('APPLICATION',null,'batch'),(null,null,'not-a-match')) f(k,s,q) loop
 if previous is distinct from candidate then raise exception '${label}_ADMIN_MISMATCH'; end if; end loop;
 if exists(select 1 from jsonb_array_elements(public.life_admin_learner_documents()->'requests') x where x->>'org_id'='${ids.otherOrg}') then raise exception 'FOREIGN_ORG_LEAK'; end if;`:""}
end $test$;
select jsonb_build_object('pass','${label}');`;
const denyAdmin=label=>`do $test$ begin
 begin perform pg_temp.previous_admin_documents(); raise exception 'OLD_ACCESS_NOT_DENIED'; exception when others then if sqlerrm<>'FORBIDDEN' then raise; end if; end;
 begin perform public.life_admin_learner_documents(); raise exception 'NEW_ACCESS_NOT_DENIED'; exception when others then if sqlerrm<>'FORBIDDEN' then raise; end if; end;
end $test$; select jsonb_build_object('pass','${label}');`;
const query=`begin; set local statement_timeout='120s';
${oldMy}; ${oldAdmin};
insert into public.life_offerings(id,org_id,project_year_id,course_version_id,name,mode,location,capacity,tuition,selection_method,status,apply_from,apply_until,starts_on,ends_on,enrollment_policy_id)
select '${second}',org_id,project_year_id,course_version_id,'[검증용] batch 준비 기수',mode,location,capacity,tuition,selection_method,'DRAFT',apply_from,apply_until,starts_on,ends_on,enrollment_policy_id from public.life_offerings where id='${ids.offering}';
insert into public.life_learner_document_requests(org_id,person_id,offering_id,request_key,kind,course_name,applicant_name,phone_masked,status,submitted_at)
select case when i%11=0 then '${ids.otherOrg}'::uuid else '${ids.org}'::uuid end,
 case when i%7=0 or i%11=0 then '${instructor.person}'::uuid else '${learner.person}'::uuid end,
 case when i%11=0 or i%3=0 then null when i%3=1 then '${ids.offering}'::uuid else '${second}'::uuid end,
 gen_random_uuid(),'APPLICATION','[검증용] batch 과정','[검증용] batch 회원','010-****-1211',
 (array['RECEIVED','REVIEWING','APPROVED','REJECTED','COMPLETED','CANCELLED'])[i%6+1],now()-i*interval '1 millisecond'
from generate_series(1,400) i;
${migration}
${setClaims(sessions[0])} set local role authenticated;
${compare("learner_own_order_fields")}
${denyAdmin("learner_admin_denied")}
reset role; ${setClaims(sessions[2])} set local role authenticated;
${compare("instructor_own_isolation")}
${denyAdmin("instructor_admin_denied")}
reset role; ${setClaims({role:"anon"})} set local role anon;
do $test$ begin
 begin perform public.life_my_learner_documents(); raise exception 'ANON_ACCESS_NOT_DENIED'; exception when insufficient_privilege then null; end;
end $test$; select jsonb_build_object('pass','anonymous_denied');
reset role; ${setClaims(sessions[1])} set local role authenticated;
${compare("manager_filters_orgs_order",true,true)}
reset role;
do $test$ begin
 if has_function_privilege('authenticated','life_private.document_registration_states(uuid[])','EXECUTE')
 or has_function_privilege('anon','life_private.document_registration_states(uuid[])','EXECUTE')
 or has_function_privilege('service_role','life_private.document_registration_states(uuid[])','EXECUTE') then raise exception 'HELPER_EXPOSED'; end if;
end $test$; select jsonb_build_object('pass','private_batch_helper_denied');
update public.life_offerings set status='PUBLISHED' where id='${second}';
${compare("published_can_apply",false,true)}
do $test$ begin
 if not exists(select 1 from jsonb_array_elements(public.life_admin_learner_documents()->'requests') x where (x->'registration'->>'can_apply')::boolean) then raise exception 'CAN_APPLY_NOT_EXERCISED'; end if;
end $test$;
insert into public.life_applications(offering_id,person_id,status,policy_id) values('${second}','${learner.person}','SUBMITTED','${ids.enrollment}');
${compare("submitted_admission_state",false,true)}
do $test$ begin
 if not exists(select 1 from jsonb_array_elements(public.life_admin_learner_documents()->'requests') x where x->>'offering_id'='${second}' and (x->'registration'->>'can_admit')::boolean) then raise exception 'CAN_ADMIT_NOT_EXERCISED'; end if;
end $test$;
update public.life_applications set status='ACCEPTED' where offering_id='${second}';
insert into public.life_enrollments(application_id,offering_id,person_id)
select id,offering_id,person_id from public.life_applications where offering_id='${second}';
${compare("active_enrollment_state",false,true)}
do $test$ begin
 if not exists(select 1 from jsonb_array_elements(public.life_admin_learner_documents()->'requests') x where x->>'offering_id'='${second}' and (x->'registration'->>'active')::boolean) then raise exception 'ACTIVE_NOT_EXERCISED'; end if;
end $test$;
update public.life_offerings set status='CLOSED',tuition=100 where id='${second}';
${compare("closed_paid_offering_state",false,true)}
create temporary table timings(i integer,previous_ms numeric,candidate_ms numeric);
do $test$ declare started timestamptz; old_ms numeric; new_ms numeric; begin
 for i in 1..6 loop
  if i%2=1 then
   started:=clock_timestamp(); perform pg_temp.previous_admin_documents(); old_ms:=extract(epoch from clock_timestamp()-started)*1000;
   started:=clock_timestamp(); perform public.life_admin_learner_documents(); new_ms:=extract(epoch from clock_timestamp()-started)*1000;
  else
   started:=clock_timestamp(); perform public.life_admin_learner_documents(); new_ms:=extract(epoch from clock_timestamp()-started)*1000;
   started:=clock_timestamp(); perform pg_temp.previous_admin_documents(); old_ms:=extract(epoch from clock_timestamp()-started)*1000;
  end if;
  insert into timings values(i,old_ms,new_ms);
 end loop;
end $test$;
select jsonb_build_object('previous_median_ms',round((percentile_cont(0.5) within group(order by previous_ms))::numeric,3),
 'candidate_median_ms',round((percentile_cont(0.5) within group(order by candidate_ms))::numeric,3),'measured_pairs',count(*)) from timings where i>1;
rollback;`;
try {
  const output=sql(query).split("\n").filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));
  for(const result of output.filter(x=>x.pass)) console.log("PASS "+result.pass);
  const measured=output.find(x=>x.previous_median_ms!==undefined);assert.ok(measured);assert.ok(measured.candidate_median_ms<measured.previous_median_ms,"Batch must improve measured execution time.");
  console.log(JSON.stringify({scope:"local SQL, 400 synthetic documents, rollback",...measured}));
} catch(error) { console.error(error.stderr?.toString()||error.message); process.exitCode=1; }
assert.equal(sql(`select count(*) from public.life_offerings where id='${second}';`),"0","Rollback removes all fixtures and candidate DDL.");
