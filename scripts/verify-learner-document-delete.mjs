// Native-auth claims; synthetic requests only; candidate DDL and data rolled back.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
const dir=process.env.APPLICATION_TEST_DB_DIR;
assert.equal(dir,'/tmp/u-livet-issues-db');
assert.match(readFileSync(`${dir}/supabase/config.toml`,'utf8'),/^project_id = "uc-life-issues"$/m);
const container='supabase_db_uc-life-issues';
assert.equal(JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0].Config.Labels['com.supabase.cli.project'],'uc-life-issues');
const config=JSON.parse(execFileSync('supabase',['status','--workdir',dir,'-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
assert.equal(config.API_URL,'http://127.0.0.1:56321');
const {ids,learner,manager,instructor,password}=JSON.parse(readFileSync('/tmp/u-livet-issues-browser-fixtures.json','utf8'));
const sql=q=>execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-qtA'],{input:q,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
assert.ok(sql(`select name from public.life_offerings where id='${ids.offering}'`).startsWith('[검증용]'));
const claims=await Promise.all([learner,manager,instructor].map(async account=>{
 const db=createClient(config.API_URL,config.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await db.auth.signInWithPassword({email:account.email,password});assert.ifError(error);
 return JSON.parse(Buffer.from(data.session.access_token.split('.')[1],'base64url'));
}));
const own=Array.from({length:6},()=>randomUUID()),foreign=randomUUID(),retained=randomUUID(),keys=own.map(()=>randomUUID());
const setClaims=(i,role='authenticated')=>`reset role; select set_config('request.jwt.claims','${JSON.stringify(i===null?{role}:claims[i]).replaceAll("'","''")}',true); set local role ${role};`;
const deny=(call,error)=>`do $t$ begin begin perform ${call}; raise exception 'EXPECTED_${error}'; exception when others then if sqlerrm<>'${error}' then raise; end if; end; end $t$;`;
const installed=sql("select exists(select 1 from information_schema.columns where table_schema='public' and table_name='life_learner_document_requests' and column_name='deleted_at')")==='t';
const migration=installed?'':readFileSync('supabase/migrations/20261007132948_learner_document_soft_delete.sql','utf8').replace(/^begin;\s*/,'').replace(/\s*commit;\s*$/,'');
const request=(id,org,key,status)=>`insert into public.life_learner_document_requests(id,org_id,person_id,offering_id,request_key,kind,course_name,applicant_name,phone_masked,status) values('${id}','${org}','${learner.person}',${org===ids.org?`'${ids.offering}'`:'null'},'${key}','APPLICATION','[검증용] 삭제 검증','[검증용] 합성 수강생','010-****-1211','${status}');`;
const snapshot=`select md5(coalesce(jsonb_agg(to_jsonb(a) order by a.id)::text,'')) from public.life_applications a where a.offering_id='${ids.offering}'`;
const enrollmentSnapshot=`select md5(coalesce(jsonb_agg(to_jsonb(e) order by e.id)::text,'')) from public.life_enrollments e where e.offering_id='${ids.offering}'`;
const query=`begin;set local statement_timeout='30s';
${migration}
create temporary table business_before as select (${snapshot}) applications,(${enrollmentSnapshot}) enrollments;
${own.map((id,i)=>request(id,ids.org,keys[i],['RECEIVED','REVIEWING','APPROVED','REJECTED','COMPLETED','CANCELLED'][i])).join('\n')}
${request(foreign,ids.otherOrg,randomUUID(),'RECEIVED')}
${request(retained,ids.org,randomUUID(),'RECEIVED')}
insert into life_private.learner_document_files(request_id,pdf_data,pdf_sha256,byte_size)
select id,convert_to('%PDF-1.7 synthetic','UTF8'),repeat('a',64),octet_length(convert_to('%PDF-1.7 synthetic','UTF8')) from public.life_learner_document_requests where id in (${own.map(id=>`'${id}'`).join(',')});
insert into public.life_learner_document_events(request_id,actor_id,to_status,note)
select id,'${learner.person}',status,'[검증용] 원본 처리 이력' from public.life_learner_document_requests where id in (${own.map(id=>`'${id}'`).join(',')});
${setClaims(null,'anon')}
${deny(`public.life_delete_learner_document('${own[0]}',1)`,'permission denied for function life_delete_learner_document')}
${setClaims(null)}
${deny(`public.life_delete_learner_document('${own[0]}',1)`,'MFA_REAUTH_REQUIRED')}
${setClaims(0)}
${deny(`public.life_delete_learner_document('${own[0]}',1)`,'FORBIDDEN')}
${setClaims(2)}
${deny(`public.life_delete_learner_document('${own[0]}',1)`,'FORBIDDEN')}
select jsonb_build_object('pass','anonymous, absent identity, learner and instructor denied');
${setClaims(1)}
${deny(`public.life_delete_learner_document('${foreign}',1)`,'FORBIDDEN')}
${deny(`public.life_delete_learner_document('${randomUUID()}',1)`,'NOT_FOUND')}
${deny(`public.life_delete_learner_document('${own[0]}',0)`,'STALE_REVISION')}
select jsonb_build_object('pass','organization, missing record and stale revision boundaries');
${own.map(id=>`select public.life_delete_learner_document('${id}',1);`).join('\n')}
${deny(`public.life_delete_learner_document('${own[0]}',1)`,'NOT_FOUND')}
do $t$ begin
 if exists(select 1 from jsonb_array_elements(public.life_admin_learner_documents()->'requests') r where r->>'id' in (${own.map(id=>`'${id}'`).join(',')})) then raise exception 'ADMIN_LIST_LEAK'; end if;
 if not exists(select 1 from jsonb_array_elements(public.life_admin_learner_documents()->'requests') r where r->>'id'='${retained}') then raise exception 'NON_DELETED_MISSING'; end if;
end $t$;
${deny(`public.life_learner_document_file('${own[0]}')`,'NOT_FOUND')}
${deny(`public.life_link_learner_document('${own[0]}','${ids.offering}',2)`,'NOT_FOUND')}
${deny(`public.life_admit_learner_document('${own[0]}',2)`,'NOT_FOUND')}
${deny(`public.life_decide_learner_document('${own[0]}','REVIEWING','test',2)`,'NOT_FOUND')}
select jsonb_build_object('pass','all document states deleted; repeated delete, admin list, PDF and staff mutations excluded');
${setClaims(0)}
do $t$ begin
 if exists(select 1 from jsonb_array_elements(public.life_my_learner_documents()) r where r->>'id' in (${own.map(id=>`'${id}'`).join(',')})) then raise exception 'LEARNER_LIST_LEAK'; end if;
end $t$;
${deny(`public.life_learner_document_file('${own[0]}')`,'NOT_FOUND')}
${deny(`public.life_cancel_learner_document('${own[0]}')`,'NOT_FOUND')}
${deny(`public.life_submit_learner_document('APPLICATION',null,'${keys[0]}','','','','',null,'','')`,'NOT_FOUND')}
select jsonb_build_object('pass','learner list, original PDF, cancel and submission-key reuse excluded');
reset role;
do $t$ begin
 if (select count(*) from public.life_learner_document_requests where id in (${own.map(id=>`'${id}'`).join(',')}) and deleted_at is not null and deleted_by='${manager.person}' and revision=2)<>6 then raise exception 'METADATA_NOT_RETAINED'; end if;
 if (select count(*) from life_private.learner_document_files where request_id in (${own.map(id=>`'${id}'`).join(',')}))<>6 then raise exception 'ORIGINAL_NOT_RETAINED'; end if;
 if (select count(*) from public.life_learner_document_events where request_id in (${own.map(id=>`'${id}'`).join(',')}))<>12 then raise exception 'EVENTS_NOT_RETAINED'; end if;
 if (select count(*) from public.life_audit_events where entity_id in (${own.map(id=>`'${id}'`).join(',')}) and action='LEARNER_DOCUMENT_DELETED')<>6 then raise exception 'AUDIT_MISSING'; end if;
 if exists(select 1 from business_before b where b.applications is distinct from (${snapshot}) or b.enrollments is distinct from (${enrollmentSnapshot})) then raise exception 'BUSINESS_CHANGED'; end if;
 if has_function_privilege('anon','public.life_delete_learner_document(uuid,integer)','EXECUTE') or has_function_privilege('service_role','public.life_delete_learner_document(uuid,integer)','EXECUTE') or has_function_privilege('authenticated','life_private.delete_learner_document(uuid,integer)','EXECUTE') then raise exception 'RPC_OVEREXPOSED'; end if;
 if has_table_privilege('authenticated','public.life_learner_document_requests','UPDATE') then raise exception 'DIRECT_TABLE_UPDATE'; end if;
end $t$;
select jsonb_build_object('pass','original, status/history, deletion audit, grants and applications/enrollments preserved');
insert into public.life_learner_document_requests(org_id,person_id,request_key,kind,course_name,applicant_name,phone_masked,status,submitted_at,deleted_at,deleted_by)
select '${ids.org}','${learner.person}',gen_random_uuid(),'APPLICATION','[검증용] 삭제 한도','[검증용] 합성 수강생','010-****-1211','RECEIVED',now()+interval '1 minute',now(),'${manager.person}' from generate_series(1,505);
${setClaims(1)}
do $t$ begin
 if not exists(select 1 from jsonb_array_elements(public.life_admin_learner_documents()->'requests') r where r->>'id'='${retained}') then raise exception 'ADMIN_DELETED_ROWS_CONSUME_LIMIT'; end if;
end $t$;
${setClaims(0)}
do $t$ begin
 if not exists(select 1 from jsonb_array_elements(public.life_my_learner_documents()) r where r->>'id'='${retained}') then raise exception 'LEARNER_DELETED_ROWS_CONSUME_LIMIT'; end if;
end $t$;
select jsonb_build_object('pass','deleted rows excluded before administrator and learner list limits');
rollback;`;
try {
 const results=sql(query).split('\n').filter(line=>line.startsWith('{')).map(line=>JSON.parse(line)).filter(result=>result.pass);
 for(const result of results) console.log('PASS '+result.pass);
 assert.equal(results.length,6);
 assert.equal(sql(`select count(*) from public.life_learner_document_requests where id='${own[0]}'`),'0');
 console.log('6 deletion boundary suites passed; synthetic data and DDL rolled back.');
} catch(error) {console.error(error.stderr?.toString()||error.message);process.exitCode=1;}
