import { ensureLocalMfa } from "./local-mfa.mjs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const status = JSON.parse(
  execFileSync("supabase", ["status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }),
);
assert.equal(
  status.API_URL,
  "http://127.0.0.1:55321",
  "Tests may only use the isolated local project.",
);
const sql = (query) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_uc-life-core",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-tA",
    ],
    { input: query, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
sql(readFileSync("scripts/local-fixtures.sql", "utf8"));
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = () =>
  createClient(status.API_URL, status.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const ORG = "10000000-0000-4000-8000-000000000001",
  YEAR = "10000000-0000-4000-8000-000000000002";
const PRIVACY = "20000000-0000-4000-8000-000000000011",
  POLICY = "20000000-0000-4000-8000-000000000012",
  COMPLETION = "20000000-0000-4000-8000-000000000013";
const OFFERING = "20000000-0000-4000-8000-000000000023",
  ASSIGNMENT = "20000000-0000-4000-8000-000000000032";
const PASSWORD = "Local-Only-2026!";
const checked = (response) => {
  assert.equal(response.error, null, JSON.stringify(response.error));
  return response.data;
};
let checks = 0;
const pass = (label) => {
  checks++;
  console.log(`PASS ${label}`);
};

async function account(label, role = "ADMIN") {
  const email = `${label}@example.invalid`;
  const existing = (
    await admin.auth.admin.listUsers({ perPage: 1000 })
  ).data.users.find((u) => u.email === email);
  let user = existing;
  if (!user)
    user = checked(
      await admin.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: {
          name: `테스트 ${label}`,
          role,
          privacy_policy_id: PRIVACY,
          privacy_accepted: true,
        },
      }),
    ).user;
  const client = anon();
  checked(await client.auth.signInWithPassword({ email, password: PASSWORD }));
  await ensureLocalMfa(client);
  const identity = checked(await client.rpc("life_identity"));
  return { client, user, identity, email };
}
const learner = await account("learner"),
  teacher = await account("instructor"),
  manager = await account("operator");
// Reset only this synthetic learner's test work, making this script repeatable.
sql(`delete from public.life_submission_grades where submission_id in (select id from public.life_submissions where person_id='${learner.identity.id}');
delete from public.life_submissions where person_id='${learner.identity.id}';
delete from public.life_lesson_reads where person_id='${learner.identity.id}';
delete from public.life_enrollments where person_id='${learner.identity.id}';
delete from public.life_applications where person_id='${learner.identity.id}';
delete from public.life_consent_events where person_id='${learner.identity.id}' and source='APPLICATION';`);
assert.deepEqual(learner.identity.roles, []);
pass("user metadata ADMIN does not grant any role");
for (const [person, role] of [
  [teacher.identity.id, "INSTRUCTOR"],
  [manager.identity.id, "COURSE_MANAGER"],
]) {
  sql(
    `insert into public.life_role_assignments(person_id,org_id,role) select '${person}','${ORG}','${role}' where not exists(select 1 from public.life_role_assignments where person_id='${person}' and role='${role}');`,
  );
}
sql(
  `insert into public.life_offering_instructors values('${OFFERING}','${teacher.identity.id}',null) on conflict do nothing;`,
);
const publicCatalog = checked(await anon().from("life_catalog").select("*"));
assert(publicCatalog.some((o) => o.id === OFFERING));
pass("anonymous public catalog with RLS and explicit grants");
assert(
  (
    await learner.client.from("life_role_assignments").insert({
      person_id: learner.identity.id,
      org_id: ORG,
      role: "COURSE_MANAGER",
    })
  ).error,
);
pass("direct role escalation denied");
assert(
  (
    await learner.client
      .from("user_profiles")
      .update({ role: "ADMIN" })
      .eq("id", learner.user.id)
  ).error,
);
pass("legacy profile escalation denied");
assert((await anon().from("certificates").select("*")).error);
pass("legacy public certificate disclosure denied");
assert((await learner.client.rpc("life_roster", { f: OFFERING })).error);
pass("learner cannot read roster RPC");
assert(
  (
    await learner.client
      .from("life_lessons")
      .select("*")
      .eq("offering_id", OFFERING)
  ).data.length === 0,
);
pass("unenrolled learner cannot read lessons");
assert(
  (await learner.client.rpc("life_apply", { f: OFFERING, policy: COMPLETION }))
    .error,
);
pass("wrong consent policy rejected");
const application = checked(
  await learner.client.rpc("life_apply", { f: OFFERING, policy: POLICY }),
);
assert.equal(
  checked(
    await learner.client.rpc("life_apply", { f: OFFERING, policy: POLICY }),
  ),
  application,
);
pass("application retry is idempotent");
assert.equal(
  checked(
    await learner.client
      .from("life_consent_events")
      .select("*")
      .eq("source", "APPLICATION"),
  ).length,
  1,
);
pass("consent event recorded once");
assert.equal(
  checked(
    await learner.client
      .from("life_lessons")
      .select("*")
      .eq("offering_id", OFFERING),
  ).length,
  1,
);
pass("enrolled learner reads assigned lessons");
checked(
  await learner.client.rpc("life_read_lesson", {
    l: "20000000-0000-4000-8000-000000000031",
  }),
);
pass("lesson read persists without claiming attendance/completion");
const submission = checked(
  await learner.client.rpc("life_submit", {
    a: ASSIGNMENT,
    body: "로컬 테스트 업무 개선 과제입니다.",
  }),
);
const answer = checked(
  await learner.client
    .from("life_submissions")
    .select("*")
    .eq("id", submission)
    .single(),
);
assert(
  (
    await learner.client.rpc("life_grade", {
      s: submission,
      revision: answer.revision,
      score: 100,
      feedback: "forged",
    })
  ).error,
);
pass("learner cannot grade through RPC");
assert(
  (
    await learner.client.from("life_submission_grades").insert({
      submission_id: submission,
      submission_revision: 1,
      score: 100,
      feedback: "forged",
      grader_id: learner.identity.id,
    })
  ).error,
);
pass("direct grade write denied");
checked(
  await teacher.client.rpc("life_grade", {
    s: submission,
    revision: answer.revision,
    score: 85,
    feedback: "가상 업무 개선 계획을 확인했습니다.",
  }),
);
assert.equal(
  checked(
    await learner.client
      .from("life_submission_grades")
      .select("*")
      .eq("submission_id", submission)
      .single(),
  ).score,
  85,
);
pass("assigned instructor grades and learner reads feedback");
checked(
  await learner.client.rpc("life_submit", {
    a: ASSIGNMENT,
    body: "수정된 테스트 과제입니다.",
  }),
);
assert.equal(
  checked(
    await learner.client
      .from("life_submission_grades")
      .select("*")
      .eq("submission_id", submission),
  ).length,
  0,
);
pass("resubmission invalidates older grade");
assert(
  (
    await teacher.client.rpc("life_grade", {
      s: submission,
      revision: answer.revision,
      score: 90,
      feedback: "stale",
    })
  ).error,
);
pass("stale grading revision rejected");

const day = (delta) =>
  new Date(Date.now() + 9 * 3600000 + delta * 86400000)
    .toISOString()
    .slice(0, 10);
const createArgs = {
  o: ORG,
  y: YEAR,
  title: "[테스트] 좌석 경쟁",
  academy: "테스트",
  summary: "로컬 경쟁 검증",
  curriculum: "테스트용",
  mode: "ONLINE",
  location: "로컬",
  capacity: 1,
  selection_method: "FIRST_COME",
  apply_from: new Date(Date.now() - 86400000).toISOString(),
  apply_until: new Date(Date.now() + 86400000).toISOString(),
  starts_on: day(1),
  ends_on: day(2),
};
assert((await learner.client.rpc("life_create_offering", createArgs)).error);
pass("learner cannot create offering");
const race = checked(
  await manager.client.rpc("life_create_offering", createArgs),
);
assert.equal(
  checked(await anon().from("life_catalog").select("*").eq("id", race)).length,
  0,
);
pass("draft offering hidden from public");
assert(
  (
    await manager.client.rpc("life_publish", {
      f: race,
      enrollment_policy: PRIVACY,
      completion_policy: COMPLETION,
    })
  ).error,
);
pass("publication requires purpose-correct approved policies");
checked(
  await manager.client.rpc("life_publish", {
    f: race,
    enrollment_policy: POLICY,
    completion_policy: COMPLETION,
  }),
);
const racers = await Promise.all(
  Array.from({ length: 8 }, (_, i) =>
    account(`race-${randomUUID().slice(0, 8)}-${i}`),
  ),
);
await Promise.all(
  racers.map(async (r) =>
    checked(await r.client.rpc("life_apply", { f: race, policy: POLICY })),
  ),
);
const rows = checked(await manager.client.rpc("life_roster", { f: race }));
assert.equal(rows.filter((r) => r.status === "ACCEPTED").length, 1);
assert.equal(rows.filter((r) => r.status === "WAITLISTED").length, 7);
pass("8 concurrent applicants: exactly 1 confirmed seat and 7 waitlisted");
const waiting = rows.find((r) => r.status === "WAITLISTED");
assert(
  (
    await manager.client.rpc("life_decide", {
      a: waiting.application_id,
      decision: "ACCEPTED",
    })
  ).error,
);
pass("manager cannot exceed capacity");
const winner = rows.find((r) => r.status === "ACCEPTED");
const winnerClient = racers.find(
  (r) => r.identity.id === winner.person_id,
).client;
checked(
  await winnerClient.rpc("life_decide", {
    a: winner.application_id,
    decision: "CANCELLED",
  }),
);
checked(
  await manager.client.rpc("life_decide", {
    a: waiting.application_id,
    decision: "ACCEPTED",
  }),
);
pass("cancellation releases a seat for reviewed waitlist promotion");
assert.equal(
  checked(await racers[0].client.from("life_applications").select("*")).every(
    (a) => a.person_id === racers[0].identity.id,
  ),
  true,
);
pass("direct Data API hides other learners applications");
assert((await teacher.client.rpc("life_roster", { f: race })).error);
pass("instructor denied another offering roster");
assert(
  (
    await teacher.client.rpc("life_teaching_content", {
      f: race,
      kind: "LESSON",
      title: "x",
      body: "x",
      ordinal: 1,
      due_at: null,
    })
  ).error,
);
pass("instructor denied another offering mutation");
// Tenant boundary uses a real second organization, rather than just a guessed UUID.
const foreignOrg = randomUUID(),
  foreignYear = randomUUID();
sql(
  `insert into public.life_organizations values('${foreignOrg}','test-${foreignOrg}','테스트 타 기관',now()); insert into public.life_project_years values('${foreignYear}','${foreignOrg}','테스트',current_date,current_date+365);`,
);
assert(
  (
    await manager.client.rpc("life_create_offering", {
      ...createArgs,
      o: foreignOrg,
      y: foreignYear,
    })
  ).error,
);
pass("course manager cannot act in another institution");
assert(
  (
    await manager.client.rpc("life_create_offering", {
      ...createArgs,
      y: foreignYear,
    })
  ).error,
);
pass("cross-tenant foreign key mismatch rejected");
// Deleting Auth must detach its link while preserving learning/consent evidence.
const retained = racers[0];
checked(await admin.auth.admin.deleteUser(retained.user.id));
assert.equal(
  sql(
    `select count(*) from public.life_people where id='${retained.identity.id}'`,
  ),
  "1",
);
assert.equal(
  sql(
    `select count(*) from public.life_applications where person_id='${retained.identity.id}'`,
  ),
  "1",
);
pass("auth deletion preserves person and application evidence");
assert.equal(checked(await retained.client.rpc("life_identity")), null);
pass("deleted auth identity loses DB authority even with old token");
assert(
  (
    await learner.client.rpc("life_assign_instructor", {
      f: OFFERING,
      p: learner.identity.id,
      enabled: true,
    })
  ).error,
);
pass("learner cannot self-assign as instructor");
assert(
  (
    await manager.client.rpc("life_assign_instructor", {
      f: OFFERING,
      p: learner.identity.id,
      enabled: true,
    })
  ).error,
);
pass("manager cannot assign an unapproved instructor");
checked(
  await manager.client.rpc("life_assign_instructor", {
    f: OFFERING,
    p: teacher.identity.id,
    enabled: false,
  }),
);
assert((await teacher.client.rpc("life_roster", { f: OFFERING })).error);
checked(
  await manager.client.rpc("life_assign_instructor", {
    f: OFFERING,
    p: teacher.identity.id,
    enabled: true,
  }),
);
assert(
  checked(await teacher.client.rpc("life_roster", { f: OFFERING })).length > 0,
);
pass(
  "assignment removal revokes access immediately and verified reassignment restores it",
);
// Keep stress-test fixtures out of the public local preview.
sql(
  "update public.life_offerings set status='DRAFT' where name='[테스트] 좌석 경쟁';",
);
console.log(
  `Verified ${checks} checks. Local fixtures: learner/instructor/operator@example.invalid (local only).`,
);
