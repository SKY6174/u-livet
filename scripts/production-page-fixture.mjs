// User-authorized private DRAFT classroom. Never publishes or records outcomes.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SUPABASE_CLI } from "./lib/supabase-cli.mjs";

assert.ok(process.argv.includes("--production"));
const mode = process.argv[2];
assert.ok(["setup", "responsible", "cleanup"].includes(mode));
const folder = resolve("ops/evidence/production-role-pages");
const accountFile = resolve(folder, "accounts.private.json"), fixtureFile = resolve(folder, "private-course.private.json");
const accounts = JSON.parse(readFileSync(accountFile, "utf8"));
assert.equal(accounts.project, "uoebygejgglgiivzgyks");
assert.equal(accounts.org, "10000000-0000-4000-8000-000000000001");
assert.match(accounts.nonce ?? "", /^[a-f0-9]{12}$/);
const uuid = value => { assert.match(value ?? "", /^[a-f0-9-]{36}$/); return value; };
const query = (sql, write = false) => {
  try { return JSON.parse(execFileSync(SUPABASE_CLI, ["db", "query", `--remote=${accounts.project}`, write ? "--yes" : "--read-only", "-o", "json", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })).rows; }
  catch { throw new Error("Private classroom transaction failed; inspect its exact owned IDs before retrying cleanup"); }
};
const save = (file, data) => writeFileSync(file, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
let fixture;
function cleanupSql() {
  const f = fixture;
  return `do $$begin
    if exists(select 1 from life_offerings where id='${f.offering}' and (status<>'DRAFT' or org_id<>'${f.org}' or course_version_id<>'${f.version}' or name<>'${f.title}')) then raise exception 'FIXTURE_CHANGED'; end if;
    end$$;
    delete from life_lesson_reads where lesson_id='${f.lesson}' and person_id='${f.learner}';
    delete from life_lessons where id='${f.lesson}' and offering_id='${f.offering}';
    delete from life_operation_responsibilities where offering_id='${f.offering}' and person_id='${f.instructor}';
    delete from life_offering_instructors where offering_id='${f.offering}' and person_id='${f.instructor}';
    delete from life_enrollments where id='${f.enrollment}' and offering_id='${f.offering}' and person_id='${f.learner}';
    delete from life_applications where id='${f.application}' and offering_id='${f.offering}' and person_id='${f.learner}';
    delete from life_offerings where id='${f.offering}' and status='DRAFT' and course_version_id='${f.version}';
    delete from life_course_versions where id='${f.version}' and course_id='${f.course}' and status='DRAFT';
    delete from life_courses where id='${f.course}' and org_id='${f.org}' and title='${f.title}';`;
}
function remaining() {
  return query(`select ((select count(*) from life_courses where id='${fixture.course}')+(select count(*) from life_course_versions where id='${fixture.version}')+(select count(*) from life_offerings where id='${fixture.offering}')+(select count(*) from life_applications where id='${fixture.application}')+(select count(*) from life_enrollments where id='${fixture.enrollment}')+(select count(*) from life_lessons where id='${fixture.lesson}')+(select count(*) from life_offering_instructors where offering_id='${fixture.offering}')+(select count(*) from life_operation_responsibilities where offering_id='${fixture.offering}'))::int count`)[0].count;
}
if (mode === "setup") {
  assert.ok(!accounts.cleanedAt && !accounts.privateFixture);
  if (existsSync(fixtureFile)) assert.ok(JSON.parse(readFileSync(fixtureFile, "utf8")).cleanedAt, "Prior fixture is still active");
  const learner = accounts.accounts.find(row => row.role === "administrator"), instructor = accounts.accounts.find(row => row.role === "instructor");
  assert.equal(learner.email, `prod-page-administrator-${accounts.nonce}@example.invalid`);
  assert.equal(instructor.email, `prod-page-instructor-${accounts.nonce}@example.invalid`);
  for (const account of [learner, instructor]) {
    uuid(account.user); uuid(account.person);
    assert.equal(query(`select count(*)::int count from life_auth_links where auth_user_id='${account.user}' and person_id='${account.person}'`)[0].count, 1);
  }
  fixture = Object.fromEntries(["course", "version", "offering", "application", "enrollment", "lesson"].map(key => [key, randomUUID()]));
  Object.assign(fixture, { org: uuid(accounts.org), year: "10000000-0000-4000-8000-000000000002", learner: learner.person, instructor: instructor.person,
    title: `[검증용] Private production QA ${accounts.nonce}`, createdAt: new Date().toISOString(),
    backup: { offering: accounts.offering, accounts: structuredClone(accounts.accounts) } });
  const policy = query(`select enrollment_policy_id id from life_offerings where id='${uuid(accounts.offering)}' and org_id='${fixture.org}'`)[0];
  uuid(policy.id);
  save(fixtureFile, fixture);
  const insert = `insert into life_courses(id,org_id,title,academy) values('${fixture.course}','${fixture.org}','${fixture.title}','검증용 비공개');
    insert into life_course_versions(id,org_id,course_id,summary,curriculum,status) values('${fixture.version}','${fixture.org}','${fixture.course}','Temporary private page verification','Synthetic account browser verification only','DRAFT');
    insert into life_offerings(id,org_id,project_year_id,course_version_id,name,mode,location,capacity,tuition,status,apply_from,apply_until,starts_on,ends_on)
    values('${fixture.offering}','${fixture.org}','${fixture.year}','${fixture.version}','${fixture.title}','ONLINE','Private QA only',1,0,'DRAFT',now()-interval '1 day',now()+interval '1 day',current_date+7,current_date+8);
    insert into life_offering_instructors(offering_id,person_id,valid_until) values('${fixture.offering}','${fixture.instructor}',now()+interval '60 minutes');
    insert into life_applications(id,offering_id,person_id,status,policy_id) values('${fixture.application}','${fixture.offering}','${fixture.learner}','ACCEPTED','${policy.id}');
    insert into life_enrollments(id,application_id,offering_id,person_id,status) values('${fixture.enrollment}','${fixture.application}','${fixture.offering}','${fixture.learner}','ACTIVE');
    insert into life_lessons(id,offering_id,title,position,content,published) values('${fixture.lesson}','${fixture.offering}','[검증용] Private lesson',1,'Page rendering only. Do not mark read or submit work.',true);`;
  try {
    query(`begin; ${insert} set local role anon; do $$begin if exists(select 1 from public.life_catalog where id='${fixture.offering}') then raise exception 'ANONYMOUS_FIXTURE_VISIBLE'; end if; end$$; reset role; ${cleanupSql()} rollback;`, true);
    assert.equal(remaining(), 0, "Rollback/cleanup proof left a fixture row");
    query(`begin; ${insert} commit;`, true);
    assert.equal(remaining(), 7);
    fixture.rollbackCleanupVerified = true; save(fixtureFile, fixture);
    accounts.offering = fixture.offering; accounts.privateFixture = true;
    accounts.accounts = accounts.accounts.map(account => account.role === "learner" ? { ...learner, role: "learner", application: fixture.application, enrolled: true } : account.role === "administrator" ? { ...account, application: fixture.application, enrolled: true } : account);
    save(accountFile, accounts);
    console.log("Created one private DRAFT classroom, one synthetic enrollment and one teaching link; anonymous catalog denial and rollback cleanup verified");
  } catch (error) {
    query(`begin; ${cleanupSql()} commit;`, true);
    assert.equal(remaining(), 0, "Failed setup cleanup left a fixture row");
    accounts.offering = fixture.backup.offering; delete accounts.privateFixture;
    accounts.accounts = fixture.backup.accounts; save(accountFile, accounts);
    fixture.backup = { restored: true }; fixture.cleanedAt = new Date().toISOString(); fixture.remainingRows = 0;
    save(fixtureFile, fixture); throw error;
  }
} else if (mode === "responsible") {
  fixture = JSON.parse(readFileSync(fixtureFile, "utf8"));
  assert.ok(accounts.privateFixture && !accounts.suspendedAdministratorGrants && !fixture.cleanedAt);
  assert.equal(fixture.title, `[검증용] Private production QA ${accounts.nonce}`);
  for (const key of ["offering", "instructor", "org"]) uuid(fixture[key]);
  assert.equal(accounts.offering, fixture.offering);
  const manager = accounts.accounts.find(account => account.role === "administrator"); uuid(manager.person);
  assert.equal(manager.email, `prod-page-administrator-${accounts.nonce}@example.invalid`);
  assert.equal(query(`select count(*)::int count from life_offerings where id='${fixture.offering}' and status='DRAFT' and org_id='${fixture.org}' and name='${fixture.title}'`)[0].count, 1);
  const insert = `insert into life_operation_responsibilities(offering_id,person_id,updated_by) values('${fixture.offering}','${fixture.instructor}','${manager.person}')`;
  query(`begin; ${insert}; delete from life_operation_responsibilities where offering_id='${fixture.offering}' and person_id='${fixture.instructor}'; rollback;`, true);
  query(insert, true);
  assert.equal(remaining(), 8);
  accounts.accounts.find(account => account.role === "instructor").operationResponsible = true;
  save(accountFile, accounts); fixture.temporaryResponsible = true; save(fixtureFile, fixture);
  console.log("Added the temporary instructor as document responsible for only the owned private DRAFT course");
} else {
  fixture = JSON.parse(readFileSync(fixtureFile, "utf8"));
  if (fixture.cleanedAt) { assert.equal(fixture.remainingRows, 0); console.log("Private classroom fixture is already cleaned up"); process.exit(0); }
  for (const key of ["course", "version", "offering", "application", "enrollment", "lesson", "org", "learner", "instructor"]) uuid(fixture[key]);
  assert.equal(fixture.org, accounts.org);
  assert.equal(fixture.title, `[검증용] Private production QA ${accounts.nonce}`);
  query(`begin; ${cleanupSql()} commit;`, true);
  assert.equal(remaining(), 0);
  accounts.offering = fixture.backup.offering; delete accounts.privateFixture;
  accounts.accounts = fixture.backup.accounts;
  save(accountFile, accounts);
  fixture.backup = { restored: true }; fixture.cleanedAt = new Date().toISOString(); fixture.remainingRows = 0; save(fixtureFile, fixture);
  console.log("Removed all private classroom fixture rows and restored the original test manifest");
}
