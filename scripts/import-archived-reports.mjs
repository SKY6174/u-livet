// Administrative, idempotent import of user-supplied historical reports.
// Manifest and generated SQL contain private material and must remain outside Git.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const value = (key) => args[args.indexOf(key) + 1];
assert.ok(args.includes("--manifest"), "--manifest is required");
const manifest = JSON.parse(readFileSync(value("--manifest"), "utf8"));
const local = args.includes("--local");
const apply = args.includes("--apply");
const project = args.includes("--project-ref") ? value("--project-ref") : null;
assert.ok(local !== !!project, "Choose --local or --project-ref explicitly");
if (local) assert.equal(manifest.synthetic, true, "Local imports require synthetic fixtures");
else assert.ok(/^[a-z]{20}$/.test(project), "Invalid project reference");
const uuid = (v) => assert.match(v, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
for (const key of ["organizationId", "yearId", "operatorId"]) uuid(manifest[key]);
assert.ok(Array.isArray(manifest.courses) && manifest.courses.length > 0);
const q = (v) => `'${String(v).replaceAll("'", "''")}'`;
const evidence = path.resolve("ops/evidence/report-import");
mkdirSync(evidence, { recursive: true, mode: 0o700 });

for (const [index, course] of manifest.courses.entries()) {
  const bytes = readFileSync(course.path);
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
  assert.ok(bytes.length > 0 && bytes.length <= 4194304, "PDF must be at most 4MB");
  const hash = createHash("sha256").update(bytes).digest("hex");
  assert.equal(hash, course.sha256, "Source file changed since review");
  assert.equal(course.report.sourceReport.sha256, hash);
  assert.equal(course.report.sourceReport.filename, path.basename(course.path));
  const ids = { course: randomUUID(), version: randomUUID(), offering: randomUUID(), file: randomUUID() };
  const org = q(manifest.organizationId), actor = q(manifest.operatorId);
  const sql = `begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
select pg_advisory_xact_lock(hashtextextended('archive-report-import:'||${org},0));
do $import$
begin
 if auth.uid() is not null then raise exception 'ADMINISTRATIVE_OPERATION_ONLY';end if;
 if not exists(select 1 from public.life_project_years where id=${q(manifest.yearId)} and org_id=${org}) then raise exception 'INVALID_YEAR';end if;
 if not exists(select 1 from public.life_people p join public.life_auth_links l on l.person_id=p.id join auth.users u on u.id=l.auth_user_id
   where p.id=${actor} and p.active and p.name=${q(manifest.operatorName)} and u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
   and exists(select 1 from public.life_role_assignments r where r.person_id=p.id and r.org_id=${org} and r.role='COURSE_MANAGER' and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now()))
   and exists(select 1 from auth.mfa_factors f where f.user_id=u.id and f.status='verified' and f.factor_type='totp')) then raise exception 'VERIFIED_OPERATOR_REQUIRED';end if;
 if exists(select 1 from public.life_audit_events where org_id=${org} and action='ARCHIVED_REPORT_IMPORTED' and details->>'source_sha256'=${q(hash)}) then return;end if;
 if not life_private.validate_course_report(${q(JSON.stringify(course.report))}::jsonb) then raise exception 'INVALID_REPORT';end if;
 insert into public.life_courses(id,org_id,title,academy) values(${q(ids.course)},${org},${q(course.name)},${q(course.academy)});
 insert into public.life_course_versions(id,org_id,course_id,summary,curriculum,status) values(${q(ids.version)},${org},${q(ids.course)},${q(course.summary)},${q(course.curriculum)},'DRAFT');
 insert into public.life_offerings(id,org_id,project_year_id,course_version_id,name,mode,location,capacity,tuition,selection_method,status,apply_from,apply_until,starts_on,ends_on)
 values(${q(ids.offering)},${org},${q(manifest.yearId)},${q(ids.version)},${q(course.name)},'OFFLINE',${q(course.location)},${Number(course.capacity)},null,null,'ARCHIVED',null,null,${q(course.startsOn)},${q(course.endsOn)});
 insert into public.life_course_reports(offering_id,payload,updated_by) values(${q(ids.offering)},${q(JSON.stringify(course.report))}::jsonb,${actor});
 insert into public.life_report_files(id,offering_id,kind,filename,mime,size,body,caption,created_by)
 values(${q(ids.file)},${q(ids.offering)},'result',${q(path.basename(course.path))},'application/pdf',${bytes.length},${q(bytes.toString("base64"))},'사용자 제공 운영 결과보고서 원본',${actor});
 insert into public.life_audit_events(org_id,actor_id,action,entity_id,details) values(${org},null,'ARCHIVED_REPORT_IMPORTED',${q(ids.offering)},jsonb_build_object(
 'source_sha256',${q(hash)},'filename',${q(path.basename(course.path))},'execution_context','administrative_management_api','authorization_source','explicit_user_request','recorded_for',${actor},'individual_records_imported',false));
end $import$;
select a.entity_id as offering_id,o.name,o.status,f.id as file_id,f.size,
 encode(sha256(decode(f.body,'base64')),'hex')=${q(hash)} as source_matches
from public.life_audit_events a join public.life_offerings o on o.id=a.entity_id join public.life_report_files f on f.offering_id=o.id and f.kind='result'
where a.org_id=${org} and a.action='ARCHIVED_REPORT_IMPORTED' and a.details->>'source_sha256'=${q(hash)};
commit;`;
  const file = path.join(evidence, `${hash}.sql`);
  writeFileSync(file, sql, { mode: 0o600 });
  console.log(JSON.stringify({ index: index + 1, name: course.name, bytes: bytes.length, sha256: hash, mode: apply ? "apply" : "prepared" }));
  if (apply) {
    const output = local
      ? execFileSync("docker", ["exec", "-i", "supabase_db_uc-life-core", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"], { input: sql, encoding: "utf8", maxBuffer: 1024 * 1024 })
      : execFileSync("supabase", ["db", "query", "--linked", "--project-ref", project, "--file", file, "--output", "json"], { encoding: "utf8", maxBuffer: 1024 * 1024 });
    writeFileSync(path.join(evidence, `${hash}.result.json`), output, { mode: 0o600 });
    console.log(output);
  }
}
