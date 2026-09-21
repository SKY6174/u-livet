// Synthetic accounts and fixtures on the dedicated local database only.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { ensureLocalMfa } from "./local-mfa.mjs";
const status = JSON.parse(
  execFileSync("supabase", ["status", "-o", "json"], {
    stdio: ["ignore", "pipe", "pipe"],
  }),
);
assert.equal(status.API_URL, "http://127.0.0.1:55321");
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
const org = "10000000-0000-4000-8000-000000000001",
  year = "10000000-0000-4000-8000-000000000002";
const privacy = "20000000-0000-4000-8000-000000000011",
  enrollment = "20000000-0000-4000-8000-000000000012";
const create = () =>
  createClient(status.API_URL, status.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const ok = (r) => {
  assert.equal(r.error, null, r.error?.message);
  return r.data;
};
let passed = 0;
const pass = (label) => {
  passed++;
  console.log("PASS " + label);
};
const run = randomUUID().slice(0, 8),
  clients = [];
async function account(label, role, roleOrg = org) {
  const email = `learning-${run}-${label}@example.invalid`,
    password = "Local-Only-2026!";
  ok(
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: label === "learner" ? "김배움" : `[TEST] ${label}`,
        privacy_policy_id: privacy,
        privacy_accepted: true,
      },
    }),
  );
  const c = create();
  clients.push(c);
  ok(await c.auth.signInWithPassword({ email, password }));
  const person = ok(await c.rpc("life_identity")).id;
  if (role) {
    sql(
      `insert into public.life_role_assignments(person_id,org_id,role) values('${person}','${roleOrg}','${role}');`,
    );
    await ensureLocalMfa(c);
  }
  return { c, person, email, password };
}
const foreignOrg = randomUUID();
sql(
  `insert into public.life_organizations(id,slug,name) values('${foreignOrg}','learning-${run}','[TEST] Another org');`,
);
const learner = await account("learner"),
  other = await account("other"),
  empty = await account("empty"),
  manager = await account("manager", "COURSE_MANAGER"),
  outsider = await account("outsider", "COURSE_MANAGER", foreignOrg);
const day = (delta) =>
  new Date(Date.now() + delta * 86400000 + 9 * 3600000)
    .toISOString()
    .slice(0, 10);
const iso = (hours) => new Date(Date.now() + hours * 3600000).toISOString();
const course = randomUUID(),
  version = randomUUID(),
  offering = randomUUID(),
  policy = randomUUID();
sql(`insert into public.life_policy_versions(id,org_id,kind,version,title,body,status,approved_by,approved_at) values('${policy}','${org}','COMPLETION','test-${run}','수료 기준','출석 80% 이상과 과제별 60점 이상을 충족하면 수료 검토 대상입니다.','APPROVED','${manager.person}',now());
insert into public.life_courses(id,org_id,title,academy) values('${course}','${org}','생성형 AI로 시작하는 스마트 업무','스마트테크');
insert into public.life_course_versions(id,org_id,course_id,summary,curriculum,status,completion_policy_id,approved_by) values('${version}','${org}','${course}','일상과 업무에 적용하는 AI 활용','생성형 AI의 이해, 업무 문서 작성, 나만의 자동화','APPROVED','${policy}','${manager.person}');
insert into public.life_offerings(id,org_id,project_year_id,course_version_id,name,mode,location,capacity,starts_on,ends_on,apply_from,apply_until,status) values('${offering}','${org}','${year}','${version}','생성형 AI로 시작하는 스마트 업무','OFFLINE','서부캠퍼스 청운국제관 301호',30,'${day(-14)}','${day(20)}','${iso(-720)}','${iso(-336)}','CLOSED');
insert into public.life_completion_rules(policy_id,attendance_percent,assignment_min,created_by,approved_by,approved_at) values('${policy}',80,60,'${learner.person}','${manager.person}',now());
insert into public.life_offering_instructors(offering_id,person_id) values('${offering}','${manager.person}');`);
for (const actor of [learner, other])
  sql(
    `with a as(insert into public.life_applications(offering_id,person_id,status,policy_id) values('${offering}','${actor.person}','ACCEPTED','${enrollment}') returning id) insert into public.life_enrollments(application_id,offering_id,person_id) select id,'${offering}','${actor.person}' from a;`,
  );
const sessions = Array.from({ length: 4 }, () => randomUUID());
for (const [i, s] of sessions.entries())
  sql(
    `insert into public.life_class_sessions(id,offering_id,title,starts_at,ends_at,status) values('${s}','${offering}','${["1주차 · AI와 친해지기", "2주차 · 실무 프롬프트 작성", "3주차 · AI로 문서 완성하기", "4주차 · 나만의 업무 자동화"][i]}','${iso((i - 2) * 168)}','${iso((i - 2) * 168 + 2)}','${i === 3 ? "CANCELLED" : "SCHEDULED"}');`,
  );
sql(`insert into public.life_attendance(session_id,person_id,credited_minutes,reason,recorded_by) values('${sessions[0]}','${learner.person}',120,'합성 출석','${manager.person}'),('${sessions[0]}','${other.person}',0,'타인 출석','${manager.person}');
insert into public.life_lessons(offering_id,title,position,content,published) values('${offering}','AI와 친해지기',1,'학습자료 예시',true),('${offering}','실무 프롬프트 작성',2,'학습자료 예시',true),('${offering}','비공개 자료',3,'비공개 본문',false);
insert into public.life_course_reports(offering_id,updated_by,payload) values('${offering}','${manager.person}','${JSON.stringify(
  {
    scholarships: [
      {
        personId: learner.person,
        category: "학습지원 장학금",
        amount: 120000,
        paidOn: day(-1),
        account: "SECRET-ACCOUNT",
        bank: "SECRET-BANK",
        note: "PRIVATE-NOTE",
      },
      {
        personId: other.person,
        category: "OTHER-PRIVATE-SCHOLARSHIP",
        amount: 999999,
        paidOn: "",
      },
    ],
    participants: [{ personId: other.person, birthDate: "SECRET-BIRTHDAY" }],
  },
)}'::jsonb);`);
const hub = ok(await learner.c.rpc("life_my_learning"));
assert.equal(hub.courses.length, 1);
assert.equal(hub.courses[0].sessions.length, 4);
assert.equal(hub.courses[0].sessions[0].credited_minutes, 120);
assert.equal(hub.courses[0].sessions[1].credited_minutes, null);
assert.equal(hub.courses[0].lessons.length, 2);
assert.equal(hub.courses[0].completion.attendance_percent, 80);
assert.equal(hub.scholarships.length, 1);
assert.equal(hub.scholarships[0].amount, 120000);
for (const secret of [
  "SECRET",
  "OTHER-PRIVATE",
  "PRIVATE-NOTE",
  "personId",
  "person_id",
  "비공개",
])
  assert(!JSON.stringify(hub).includes(secret), secret);
pass(
  "scoped learning projection returns own attendance, published lessons, criteria and minimal scholarship fields",
);
assert((await create().rpc("life_my_learning")).error);
assert.equal(ok(await empty.c.rpc("life_my_learning")).courses.length, 0);
assert.equal(ok(await empty.c.rpc("life_my_learning")).scholarships.length, 0);
assert((await learner.c.from("life_course_reports").select("*")).error);
pass(
  "anonymous access and raw report reads are denied; unrelated learner sees no records",
);
const args = {
  o: org,
  title: "AI 심화 실습",
  goal: "업무 자동화 도구를 활용한 심화 실습을 배우고 싶습니다.",
  schedule: "토요일 오전",
};
const id = ok(await learner.c.rpc("life_submit_learning_request", args));
assert.equal(ok(await learner.c.rpc("life_submit_learning_request", args)), id);
assert.equal(
  ok(await learner.c.from("life_learning_requests").select("*")).length,
  1,
);
assert.equal(
  ok(await other.c.from("life_learning_requests").select("*")).length,
  0,
);
assert.equal(
  ok(await manager.c.from("life_learning_requests").select("*").eq("id", id))
    .length,
  1,
);
assert.equal(
  ok(await outsider.c.from("life_learning_requests").select("*").eq("id", id))
    .length,
  0,
);
pass(
  "proposals persist, retry is idempotent, learner and organization boundaries hold",
);
for (const actor of [other, outsider])
  assert(
    (
      await actor.c.rpc("life_review_learning_request", {
        r: id,
        new_status: "PLANNED",
        reply: "unauthorized",
      })
    ).error,
  );
assert(
  (
    await learner.c
      .from("life_learning_requests")
      .insert({
        person_id: learner.person,
        org_id: org,
        title: args.title,
        goal: args.goal,
      })
  ).error,
);
assert(
  (
    await learner.c
      .from("life_learning_requests")
      .update({ status: "PLANNED" })
      .eq("id", id)
  ).error,
);
assert(
  (await learner.c.from("life_learning_requests").delete().eq("id", id)).error,
);
assert((await create().from("life_learning_requests").select("*")).error);
ok(
  await manager.c.rpc("life_review_learning_request", {
    r: id,
    new_status: "REVIEWING",
    reply: "다음 학기 교육과정 수요조사에 반영하여 검토하겠습니다.",
  }),
);
assert.equal(
  ok(await learner.c.rpc("life_my_learning")).requests[0].status,
  "REVIEWING",
);
pass(
  "direct writes/deletes and cross-role review denied; manager reply reaches learner",
);
for (const change of [
  { o: foreignOrg },
  { title: "x" },
  { title: null },
  { goal: "short" },
  { schedule: "x".repeat(201) },
])
  assert(
    (
      await learner.c.rpc("life_submit_learning_request", {
        ...args,
        ...change,
      })
    ).error,
  );
assert((await create().rpc("life_submit_learning_request", args)).error);
for (let i = 0; i < 4; i++)
  ok(
    await learner.c.rpc("life_submit_learning_request", {
      ...args,
      title: "추가 제안 " + i,
    }),
  );
assert.equal(
  (
    await learner.c.rpc("life_submit_learning_request", {
      ...args,
      title: "한도 초과 제안",
    })
  ).error.message,
  "RATE_LIMIT",
);
pass(
  "server rejects invalid input, foreign organization, anonymous submissions and daily quota excess",
);
sql(
  `update public.life_enrollments set status='WITHDRAWN' where person_id='${other.person}' and offering_id='${offering}';`,
);
const withdrawn = ok(await other.c.rpc("life_my_learning")).courses[0];
assert.equal(withdrawn.active, false);
assert.deepEqual(withdrawn.sessions, []);
assert.deepEqual(withdrawn.lessons, []);
assert.deepEqual(withdrawn.instructors, []);
pass(
  "withdrawn learners cannot read classroom detail through the new projection",
);
mkdirSync("tmp", { recursive: true });
writeFileSync(
  "tmp/student-learning-fixtures.json",
  JSON.stringify(
    {
      offering,
      learner: { email: learner.email, password: learner.password },
      empty: { email: empty.email, password: empty.password },
      other: { email: other.email, password: other.password },
    },
    null,
    2,
  ),
);
for (const c of clients) await c.auth.signOut();
console.log(`${passed} local database checks passed.`);
