import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import ts from "typescript";
function load(file, schema) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function("require", "module", "exports", code)(() => schema, module, module.exports);
  return module.exports;
}
const schema = load("src/lib/operation-documents/schema.ts"), model = load("src/lib/operation-documents/model.ts", schema);
const content = model.emptyContent("plan"), budget = model.emptyBudget("plan");
for (const field of schema.fields("plan")) content.fields[field.key] = field.type === "number" ? "10" : field.type === "date" ? "2026-10-13" : "Synthetic local test";
content.fields.year = "2026"; content.fields.completionAttendancePercent = "80";
content.fields.audience = "성인학습자 / 지역주민";
for (const table of schema.tables("plan")) if (table.min) content.tables[table.key] = [Object.fromEntries(table.columns.map(field => [field.key, field.type === "number" ? "2" : field.type === "date" ? "2026-10-13" : field.type === "time" ? field.key === "endTime" ? "11:00" : "09:00" : "Synthetic local test"]))];
for (const row of budget.rows) row.planned = "0";
budget.rows[7].calculation = "1. 밀가루 1kg*5개=10만원\n2. 버터 1kg*10개=20만원"; budget.rows[7].planned = "300000";
assert(model.validContent(content, "plan")); assert(model.validBudget(budget));
const quote = value => "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
const image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9WvFIAAAAASUVORK5CYII=";
const migration = readFileSync("supabase/migrations/20261013012440_plan_signature_required.sql", "utf8").replace(/^begin;\s*/, "").replace(/commit;\s*$/, "");
const sql = `begin;
drop trigger if exists life_operation_plan_signature_required on public.life_operation_documents;
drop function if exists life_private.require_plan_signature();
${migration}
do $$declare candidate record; f uuid; fixture public.life_offerings; payload jsonb;begin
 for candidate in select a.auth_user_id,a.person_id,r.org_id,s.id session_id from public.life_auth_links a
 join auth.users u on u.id=a.auth_user_id join auth.sessions s on s.user_id=u.id
 join public.life_role_assignments r on r.person_id=a.person_id
 where u.email like '%@example.invalid' and r.role='COURSE_MANAGER' order by s.created_at desc loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',candidate.auth_user_id,'role','authenticated','aal','aal1','session_id',candidate.session_id)::text,true);
  if not life_private.mfa_verified() or not life_private.has_role(candidate.org_id,'COURSE_MANAGER') then continue;end if;
  select o.* into fixture from public.life_offerings o where o.org_id=candidate.org_id and o.name like '[검증용]%' limit 1;
  if fixture.id is null then continue;end if;
  insert into public.life_offerings(org_id,project_year_id,course_version_id,name,mode,location,capacity,apply_from,apply_until,starts_on,ends_on)
  values(fixture.org_id,fixture.project_year_id,fixture.course_version_id,'[검증용] Issue 172 rollback fixture','OFFLINE','Synthetic local test',20,now(),now()+interval '1 day',current_date,current_date) returning id into f;
  if not exists(select 1 from public.life_role_assignments where person_id=candidate.person_id and org_id=candidate.org_id and role='INSTRUCTOR' and valid_from<=now() and (valid_until is null or valid_until>now())) then
    insert into public.life_role_assignments(person_id,org_id,role) values(candidate.person_id,candidate.org_id,'INSTRUCTOR');
  end if;
  insert into public.life_offering_instructors(offering_id,person_id) values(f,candidate.person_id);
  insert into public.life_operation_responsibilities(offering_id,person_id,updated_by) values(f,candidate.person_id,candidate.person_id);
  payload:=jsonb_set(${quote(content)},'{fields,professor}',to_jsonb((select name from public.life_people where id=candidate.person_id)),true);
  insert into public.life_operation_documents(offering_id,kind,content,budget,updated_by) values(f,'plan',payload,${quote(budget)},candidate.person_id);
  exit;
 end loop;
 if f is null then raise exception 'NO_SYNTHETIC_OPERATION_FIXTURE';end if;
 perform set_config('test.offering',f::text,true);
 perform set_config('test.snapshots',(select count(*)::text from public.life_operation_submissions where offering_id=f and kind='plan'),true);
 perform set_config('test.content',payload::text,true);
 perform set_config('test.signed',(payload||jsonb_build_object('signature','${image}'))::text,true);
 perform set_config('test.budget',${quote(budget)}::text,true);
 update public.life_operation_documents set status='DRAFT',revision=1 where offering_id=f and kind='plan';
end $$;
set local role authenticated;
do $$declare f uuid:=current_setting('test.offering')::uuid;begin
 perform public.life_operation_save(f,'plan',current_setting('test.content')::jsonb,current_setting('test.budget')::jsonb,1);
 begin perform public.life_operation_transition(f,'plan','review',2,'',true);raise exception 'EXPECTED_UNSIGNED_REVIEW_REJECTION';
 exception when raise_exception then if sqlerrm<>'PLAN_SIGNATURE_REQUIRED' then raise;end if;end;
 perform public.life_operation_save(f,'plan',current_setting('test.signed')::jsonb,null,2);
 perform public.life_operation_transition(f,'plan','review',3,'',true);
 perform public.life_operation_save(f,'plan',current_setting('test.content')::jsonb,null,4);
 begin perform public.life_operation_transition(f,'plan','submit',5,'',true);raise exception 'EXPECTED_UNSIGNED_SUBMIT_REJECTION';
 exception when raise_exception then if sqlerrm<>'PLAN_SIGNATURE_REQUIRED' then raise;end if;end;
 perform public.life_operation_save(f,'plan',current_setting('test.signed')::jsonb,null,5);
 begin perform public.life_operation_transition(f,'plan','submit',5,'',true);raise exception 'EXPECTED_REVISION_REJECTION';
 exception when raise_exception then if sqlerrm<>'REVISION_CHANGED' then raise;end if;end;
 perform public.life_operation_transition(f,'plan','submit',6,'',true);
end $$;
reset role;
do $$declare f uuid:=current_setting('test.offering')::uuid;begin
 if not exists(select 1 from public.life_operation_documents where offering_id=f and kind='plan' and status='SUBMITTED' and revision=7 and content=current_setting('test.signed')::jsonb and budget=current_setting('test.budget')::jsonb) then raise exception 'CONTENT_OR_BUDGET_NOT_PRESERVED';end if;
 if (select count(*) from public.life_operation_submissions where offering_id=f and kind='plan')<>current_setting('test.snapshots')::integer+1 then raise exception 'BAD_SUBMISSION_COUNT';end if;
 if has_function_privilege('authenticated','life_private.require_plan_signature()','EXECUTE') or has_function_privilege('anon','life_private.require_plan_signature()','EXECUTE') then raise exception 'EXPOSED_INTERNAL_TRIGGER';end if;
end $$;
select set_config('request.jwt.claims','{}',true);
set local role authenticated;
do $$begin
 begin perform public.life_operation_transition(current_setting('test.offering')::uuid,'plan','review',7,'',true);raise exception 'EXPECTED_ACCESS_REJECTION';
 exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
end $$;
reset role;
rollback;`;
// The named local stack and synthetic fixture filter prohibit production use.
execFileSync("docker", ["exec", "-i", "supabase_db_uc-life-issues", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q"], { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
console.log("PASS unsigned draft saves; unsigned review/submit denied; signed transitions, revisions, multiline budget/snapshots and access retained; ROLLBACK");
