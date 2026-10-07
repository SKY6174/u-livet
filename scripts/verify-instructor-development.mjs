import { ensureLocalMfa } from "./local-mfa.mjs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const status = JSON.parse(
  execFileSync("supabase", ["status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }),
);
assert.equal(status.API_URL, "http://127.0.0.1:55321");
const sql = (q) =>
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
      "-qtA",
    ],
    { input: q, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
const client = () =>
  createClient(status.API_URL, status.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const ok = (r) => {
  assert.equal(r.error, null, JSON.stringify(r.error));
  return r.data;
};
const denied = (r) => assert(r.error, "must reject");
let checks = 0;
const pass = (s) => {
  checks++;
  console.log("PASS " + s);
};
const day = (n) =>
  new Date(Date.now() + 9 * 3600000 + n * 86400000).toISOString().slice(0, 10);
const iso = (n) => new Date(Date.now() + n * 86400000).toISOString();
async function account(label) {
  const email = label + "@example.invalid";
  let u = ok(await service.auth.admin.listUsers({ perPage: 1000 })).users.find(
    (x) => x.email === email,
  );
  if (!u)
    u = ok(
      await service.auth.admin.createUser({
        email,
        password: "Local-Only-2026!",
        email_confirm: true,
        user_metadata: {
          name: "검증 " + label,
          privacy_policy_id: "20000000-0000-4000-8000-000000000011",
          privacy_accepted: true,
        },
      }),
    ).user;
  const c = client();
  ok(await c.auth.signInWithPassword({ email, password: "Local-Only-2026!" }));
  await ensureLocalMfa(c);
  return { c, p: ok(await c.rpc("life_identity")).id };
}
const owner = await account("development-instructor"),
  manager = await account("instructor-reviewer"),
  other = await account("profile-outsider");
const o = randomUUID(),
  y = randomUUID(),
  policies = {};
sql(
  `insert into public.life_organizations(id,slug,name) values('${o}','test-${o}','[검증용] 강사·개발 사업단');insert into public.life_project_years(id,org_id,label,starts_on,ends_on) values('${y}','${o}','가상 개발연도','${day(-180)}','${day(180)}');insert into public.life_role_assignments(person_id,org_id,role) values('${manager.p}','${o}','COURSE_MANAGER');`,
);
for (const kind of [
  "INSTRUCTOR_PRIVACY",
  "INSTRUCTOR_REVIEW",
  "INSTRUCTOR_PUBLIC",
  "DEVELOPMENT",
  "COMPLETION",
  "ENROLLMENT",
]) {
  const id = randomUUID();
  policies[kind] = id;
  sql(
    `insert into public.life_policy_versions(id,org_id,kind,version,title,body,status,approved_by,approved_at) values('${id}','${o}','${kind}','TEST-${id}','[검증용] ${kind}','로컬 가상 기준입니다. 개인정보: 전문분야·이력·증빙 참조를 심사 목적으로 로컬 환경 삭제까지 보관. 공개는 선택사항으로 이름·전문분야·공개 소개만 표시하며 언제든 철회 가능. 실제 기관 기준이 아닙니다.','APPROVED','${manager.p}',now());`,
  );
}
const call = (who, name, args = {}) => who.c.rpc("life_" + name, args);
denied(await call(other, "instructor_dossiers", { o, staff: true }));
denied(await client().rpc("life_instructor_options"));
pass("anonymous and non-manager cannot inspect internal instructor records");
denied(
  await call(owner, "start_dossier", {
    o,
    privacy: policies.INSTRUCTOR_PRIVACY,
    confirmed: false,
  }),
);
denied(
  await call(owner, "start_dossier", {
    o,
    privacy: policies.DEVELOPMENT,
    confirmed: true,
  }),
);
pass("separate approved privacy notice and explicit consent required");
let v = ok(
  await call(owner, "start_dossier", {
    o,
    privacy: policies.INSTRUCTOR_PRIVACY,
    confirmed: true,
  }),
);
const d = sql(
  `select dossier_id from public.life_instructor_dossier_versions where id='${v}'`,
);
assert.equal(
  ok(
    await call(owner, "start_dossier", {
      o,
      privacy: policies.INSTRUCTOR_PRIVACY,
      confirmed: true,
    }),
  ),
  v,
);
denied(await call(manager, "instructor_dossier", { d }));
assert.equal(
  ok(await call(manager, "instructor_dossiers", { o, staff: true })).items
    .length,
  0,
);
pass("one open draft per person and private drafts hidden from staff");
const payload = {
  specialty: "현장 디지털 실무",
  introduction: "가상 강사 심사용 소개",
  public_intro: "실습으로 배우는 디지털 도구 활용",
  claims: [
    {
      kind: "QUALIFICATION",
      title: "[가상] 실무 자격",
      organization: "검증 발급기관",
      started_on: day(-100),
      ended_on: "",
      expires_on: day(60),
      evidence: "LOCAL-PRIVATE-EVIDENCE-123",
    },
  ],
};
denied(await call(other, "save_dossier", { v, revision: 0, payload }));
denied(
  await call(owner, "save_dossier", {
    v,
    revision: 0,
    payload: { ...payload, approved: true },
  }),
);
denied(
  await call(owner, "save_dossier", {
    v,
    revision: 0,
    payload: {
      ...payload,
      claims: [{ ...payload.claims[0], started_on: day(2) }],
    },
  }),
);
pass("dossier ownership, unknown keys and future history dates rejected");
ok(await call(owner, "save_dossier", { v, revision: 0, payload }));
denied(await call(owner, "save_dossier", { v, revision: 0, payload }));
pass("optimistic revision prevents another tab overwriting saved history");
ok(
  await call(owner, "submit_dossier", {
    v,
    revision: 1,
    policy: policies.INSTRUCTOR_REVIEW,
    confirmed: true,
  }),
);
denied(await call(owner, "save_dossier", { v, revision: 2, payload }));
denied(await call(other, "instructor_dossier", { d }));
assert.equal(
  ok(await call(manager, "instructor_dossier", { d })).versions[0].payload
    .claims[0].evidence,
  payload.claims[0].evidence,
);
pass(
  "submitted history frozen and only institution reviewer can inspect evidence",
);
sql(
  `insert into public.life_role_assignments(person_id,org_id,role) values('${owner.p}','${o}','COURSE_MANAGER');`,
);
denied(
  await call(owner, "decide_dossier", {
    v,
    decision: "APPROVED",
    reason: "self",
    valid_until: day(30),
    verified: true,
  }),
);
pass("dual-role author cannot approve their own dossier");
ok(
  await call(manager, "decide_dossier", {
    v,
    decision: "CHANGES_REQUESTED",
    reason: "증빙 참조 보완 요청",
    valid_until: null,
    verified: false,
  }),
);
const old = v;
v = ok(
  await call(owner, "start_dossier", {
    o,
    privacy: policies.INSTRUCTOR_PRIVACY,
    confirmed: true,
  }),
);
assert.notEqual(v, old);
assert.equal(
  ok(await call(manager, "instructor_dossier", { d })).versions.length,
  1,
);
ok(
  await call(owner, "save_dossier", {
    v,
    revision: 0,
    payload: { ...payload, introduction: "증빙 보완한 가상 이력" },
  }),
);
ok(
  await call(owner, "submit_dossier", {
    v,
    revision: 1,
    policy: policies.INSTRUCTOR_REVIEW,
    confirmed: true,
  }),
);
assert.equal(
  ok(await call(manager, "instructor_dossier", { d })).versions.length,
  2,
);
pass(
  "supplement creates a new version while previous submitted history is preserved",
);
denied(
  await call(manager, "decide_dossier", {
    v,
    decision: "APPROVED",
    reason: "검증",
    valid_until: day(30),
    verified: false,
  }),
);
denied(
  await call(manager, "decide_dossier", {
    v,
    decision: "APPROVED",
    reason: "검증",
    valid_until: day(90),
    verified: true,
  }),
);
denied(
  await call(manager, "decide_dossier", {
    v,
    decision: "APPROVED",
    reason: "",
    valid_until: day(30),
    verified: true,
  }),
);
pass(
  "approval requires evidence confirmation, reason and validity within qualification expiry",
);
ok(
  await call(manager, "decide_dossier", {
    v,
    decision: "APPROVED",
    reason: "가상 외부 증빙과 기준 확인",
    valid_until: day(30),
    verified: true,
  }),
);
assert(ok(await call(owner, "instructor_dossier", { d })).current);
assert(
  !ok(await call(owner, "identity")).roles.some(
    (x) => x.org_id === o && x.role === "INSTRUCTOR",
  ),
);
pass(
  "approved dossier enables proposals without silently granting appointment or teaching role",
);
for (const table of [
  "life_instructor_dossiers",
  "life_instructor_dossier_versions",
  "life_course_proposals",
  "life_course_proposal_versions",
  "life_development_openings",
  "life_instructor_development_events",
])
  denied(await owner.c.from(table).select("*"));
pass("direct ledger and evidence table reads blocked");
const f = ok(
  await call(manager, "create_offering", {
    o,
    y,
    title: "[테스트] 공개 강사 소개",
    academy: "가상 분야",
    summary: "가상 소개 검증",
    curriculum: "개인정보 없음",
    mode: "ONLINE",
    location: "로컬",
    capacity: 10,
    selection_method: "REVIEW",
    apply_from: iso(-1),
    apply_until: iso(1),
    starts_on: day(2),
    ends_on: day(3),
  }),
);
ok(
  await call(manager, "publish", {
    f,
    enrollment_policy: policies.ENROLLMENT,
    completion_policy: policies.COMPLETION,
  }),
);
denied(
  await call(manager, "assign_instructor", { f, p: owner.p, enabled: true }),
);
assert.equal(
  ok(await client().rpc("life_public_instructors", { f })).length,
  0,
);
pass("profile approval alone cannot grant class assignment or public listing");
sql(
  `insert into public.life_role_assignments(person_id,org_id,role) values('${owner.p}','${o}','INSTRUCTOR');`,
);
ok(await call(manager, "assign_instructor", { f, p: owner.p, enabled: true }));
let rev = ok(await call(owner, "instructor_dossier", { d })).revision;
denied(
  await call(owner, "set_instructor_public", {
    d,
    enabled: true,
    policy: policies.INSTRUCTOR_PUBLIC,
    confirmed: false,
    revision: rev,
  }),
);
ok(
  await call(owner, "set_instructor_public", {
    d,
    enabled: true,
    policy: policies.INSTRUCTOR_PUBLIC,
    confirmed: true,
    revision: rev,
  }),
);
const pub = ok(await client().rpc("life_public_instructors", { f }));
assert.equal(pub.length, 1);
assert.deepEqual(Object.keys(pub[0]).sort(), [
  "introduction",
  "name",
  "responsible",
  "specialty",
]);
assert(!JSON.stringify(pub).includes("LOCAL-PRIVATE"));
pass(
  "separate optional public consent exposes only approved name and short introduction",
);
denied(
  await call(owner, "set_instructor_public", {
    d,
    enabled: false,
    policy: null,
    confirmed: false,
    revision: rev,
  }),
);
rev++;
ok(
  await call(owner, "set_instructor_public", {
    d,
    enabled: false,
    policy: null,
    confirmed: false,
    revision: rev,
  }),
);
assert.equal(
  ok(await client().rpc("life_public_instructors", { f })).length,
  0,
);
pass("public setting revision guard and immediate withdrawal");
rev++;
ok(
  await call(owner, "set_instructor_public", {
    d,
    enabled: true,
    policy: policies.INSTRUCTOR_PUBLIC,
    confirmed: true,
    revision: rev,
  }),
);
ok(await call(manager, "assign_instructor", { f, p: owner.p, enabled: false }));
assert.equal(
  ok(await client().rpc("life_public_instructors", { f })).length,
  0,
);
ok(await call(manager, "assign_instructor", { f, p: owner.p, enabled: true }));
pass("assignment withdrawal immediately removes public profile");
sql(`update public.life_people set active=false where id='${owner.p}';`);
assert.equal(
  ok(await client().rpc("life_public_instructors", { f })).length,
  0,
);
sql(`update public.life_people set active=true where id='${owner.p}';`);
const auth = sql(
  `select auth_user_id from public.life_auth_links where person_id='${owner.p}'`,
);
sql(
  `update public.life_auth_links set auth_user_id=null where person_id='${owner.p}';`,
);
assert.equal(
  ok(await client().rpc("life_public_instructors", { f })).length,
  0,
);
sql(
  `update public.life_auth_links set auth_user_id='${auth}' where person_id='${owner.p}';`,
);
pass("inactive or detached authentication identity hides public profile");
const draft = ok(
  await call(owner, "start_dossier", {
    o,
    privacy: policies.INSTRUCTOR_PRIVACY,
    confirmed: true,
  }),
);
assert.equal(
  ok(await client().rpc("life_public_instructors", { f })).length,
  0,
);
assert(!ok(await call(owner, "instructor_dossier", { d })).current);
ok(
  await call(owner, "withdraw_dossier", {
    v: draft,
    reason: "검증용 변경 철회",
  }),
);
pass(
  "new dossier version suspends previous public approval and withdrawal preserves history",
);
denied(
  await call(other, "start_development", {
    o,
    y,
    kind: "NEW",
    target: null,
    p: null,
  }),
);
pass(
  "ordinary learner cannot propose a course without instructor role or approved dossier",
);
const p = ok(
  await call(owner, "start_development", {
    o,
    y,
    kind: "NEW",
    target: null,
    p: null,
  }),
);
let detail = ok(await call(owner, "development_detail", { p })),
  dv = detail.versions[0].id;
denied(await call(manager, "development_detail", { p }));
denied(await call(other, "development_detail", { p }));
pass("unsubmitted course proposal visible only to author");
const proposal = {
  title: "[가상] 현장 디지털 실무",
  academy: "디지털 아카데미",
  summary: "현장 문서 자동화 실습",
  rationale: "가상 산업체 수요 확인",
  target: "성인 재직자",
  outcomes: "기초 자동화 실습 수행",
  prerequisites: "기초 컴퓨터 활용",
  assessment: "실습 산출물 확인 제안 — 실제 수료는 승인 정책 적용",
  materials: "노트북",
  budget: "가상 재료비 없음, 운영 승인 전 예산 미확정",
  capacity: 20,
  theory_minutes: 60,
  practice_minutes: 60,
  sessions: [
    {
      title: "업무 사례",
      content: "도구와 사례 학습",
      equipment: "노트북",
      assessment: "구두 확인",
      minutes: 60,
      method: "THEORY",
    },
    {
      title: "자동화 실습",
      content: "가상 문서 실습",
      equipment: "노트북",
      assessment: "산출물 확인",
      minutes: 60,
      method: "PRACTICE",
    },
  ],
};
denied(
  await call(owner, "save_development", {
    v: dv,
    revision: 0,
    payload: { ...proposal, role: "SYSTEM_ADMIN" },
  }),
);
denied(
  await call(other, "save_development", {
    v: dv,
    revision: 0,
    payload: proposal,
  }),
);
ok(
  await call(owner, "save_development", {
    v: dv,
    revision: 0,
    payload: { ...proposal, theory_minutes: 90 },
  }),
);
denied(
  await call(owner, "submit_development", {
    v: dv,
    revision: 1,
    policy: policies.DEVELOPMENT,
    completion: policies.COMPLETION,
    confirmed: true,
  }),
);
pass(
  "proposal unknown fields, ownership and theory/practice totals enforced at RPC boundary",
);
ok(
  await call(owner, "save_development", {
    v: dv,
    revision: 1,
    payload: proposal,
  }),
);
ok(
  await call(owner, "submit_development", {
    v: dv,
    revision: 2,
    policy: policies.DEVELOPMENT,
    completion: policies.COMPLETION,
    confirmed: true,
  }),
);
denied(
  await call(owner, "save_development", {
    v: dv,
    revision: 3,
    payload: proposal,
  }),
);
denied(
  await call(owner, "decide_development", {
    v: dv,
    decision: "APPROVED",
    reason: "self",
  }),
);
pass("submitted syllabus immutable and dual-role author cannot self-approve");
ok(
  await call(manager, "decide_development", {
    v: dv,
    decision: "CHANGES_REQUESTED",
    reason: "실습 준비물 보완",
  }),
);
ok(
  await call(owner, "start_development", {
    o,
    y,
    kind: "NEW",
    target: null,
    p,
  }),
);
detail = ok(await call(owner, "development_detail", { p }));
assert.equal(detail.versions.length, 2);
dv = detail.versions[0].id;
ok(
  await call(owner, "save_development", {
    v: dv,
    revision: 0,
    payload: proposal,
  }),
);
ok(
  await call(owner, "submit_development", {
    v: dv,
    revision: 1,
    policy: policies.DEVELOPMENT,
    completion: policies.COMPLETION,
    confirmed: true,
  }),
);
pass("course supplement version preserves earlier review reason");
const issued = await Promise.all([
  call(manager, "decide_development", {
    v: dv,
    decision: "APPROVED",
    reason: "가상 기준과 수업계획 확인",
  }),
  call(manager, "decide_development", {
    v: dv,
    decision: "APPROVED",
    reason: "가상 기준과 수업계획 확인",
  }),
]);
const cv = ok(issued[0]);
assert.equal(ok(issued[1]), cv);
assert.equal(
  sql(`select count(*) from public.life_course_versions where id='${cv}'`),
  "1",
);
pass("concurrent course approval produces one immutable course version");
assert.throws(() =>
  sql(
    `update public.life_course_versions set summary='forged' where id='${cv}'`,
  ),
);
assert.throws(() =>
  sql(
    `update public.life_course_proposal_versions set payload='{}' where id='${dv}'`,
  ),
);
pass("approved syllabus and resulting course content cannot be overwritten");
const opening = {
  year: y,
  name: "[가상] 승인과정 1기",
  mode: "ONLINE",
  location: "로컬 강의실",
  capacity: 20,
  selection_method: "REVIEW",
  apply_from: iso(1),
  apply_until: iso(2),
  starts_on: day(3),
  ends_on: day(5),
};
denied(
  await call(other, "open_development", {
    v: dv,
    request_key: randomUUID(),
    input: opening,
  }),
);
denied(
  await call(manager, "open_development", {
    v: dv,
    request_key: randomUUID(),
    input: { ...opening, capacity: 21 },
  }),
);
denied(
  await call(manager, "open_development", {
    v: dv,
    request_key: randomUUID(),
    input: { ...opening, ends_on: day(300) },
  }),
);
pass("opening checks staff, approved capacity and project-year dates");
const key = randomUUID(),
  opens = await Promise.all([
    call(manager, "open_development", {
      v: dv,
      request_key: key,
      input: opening,
    }),
    call(manager, "open_development", {
      v: dv,
      request_key: key,
      input: opening,
    }),
  ]);
const first = ok(opens[0]);
assert.equal(ok(opens[1]), first);
denied(
  await call(manager, "open_development", {
    v: dv,
    request_key: key,
    input: { ...opening, name: "충돌" },
  }),
);
pass(
  "concurrent duplicate opening returns one offering and conflicting input rejected",
);
const second = ok(
  await call(manager, "open_development", {
    v: dv,
    request_key: randomUUID(),
    input: { ...opening, name: "[가상] 승인과정 2기" },
  }),
);
let board = ok(await call(manager, "development_board", { o, staff: true }));
assert.equal(board.counts[0].new_count, 1);
assert.equal(board.counts[0].revision_count, 0);
assert.equal(
  ok(await call(owner, "development_detail", { p })).openings.length,
  2,
);
pass("multiple offerings remain one new development record");
const mismatchedPolicy = randomUUID();
sql(
  `insert into public.life_policy_versions(id,org_id,kind,version,title,body,status,approved_by,approved_at) values('${mismatchedPolicy}','${o}','COMPLETION','TEST-${mismatchedPolicy}','다른 가상 수료 기준','다른 승인 원문','APPROVED','${manager.p}',now());`,
);
denied(
  await call(manager, "publish", {
    f: first,
    enrollment_policy: policies.ENROLLMENT,
    completion_policy: mismatchedPolicy,
  }),
);
assert.equal(
  ok(await call(manager, "development_detail", { p })).versions[0].notices
    .length,
  2,
);
pass(
  "publication cannot substitute another completion policy and reviewers see submitted policy text",
);
const oldApprover = sql(
  `select approved_by from public.life_course_versions where id='${cv}'`,
);
ok(
  await call(manager, "publish", {
    f: first,
    enrollment_policy: policies.ENROLLMENT,
    completion_policy: policies.COMPLETION,
  }),
);
assert.equal(
  sql(`select approved_by from public.life_course_versions where id='${cv}'`),
  oldApprover,
);
pass(
  "publication retains curriculum approval and uses the existing enrollment workflow",
);
ok(
  await call(manager, "revoke_development", {
    v: dv,
    reason: "가상 검증 철회",
  }),
);
denied(
  await call(manager, "open_development", {
    v: dv,
    request_key: randomUUID(),
    input: opening,
  }),
);
denied(
  await call(manager, "publish", {
    f: second,
    enrollment_policy: policies.ENROLLMENT,
    completion_policy: policies.COMPLETION,
  }),
);
assert.equal(
  sql(`select status from public.life_offerings where id='${first}'`),
  "PUBLISHED",
);
pass(
  "approval revocation blocks future openings/publication and preserves existing teaching records",
);
ok(
  await call(owner, "start_development", {
    o,
    y,
    kind: "NEW",
    target: null,
    p,
  }),
);
let latest = ok(await call(owner, "development_detail", { p })).versions[0];
ok(
  await call(owner, "save_development", {
    v: latest.id,
    revision: 0,
    payload: { ...proposal, title: "[가상] 실무 개편" },
  }),
);
ok(
  await call(owner, "submit_development", {
    v: latest.id,
    revision: 1,
    policy: policies.DEVELOPMENT,
    completion: policies.COMPLETION,
    confirmed: true,
  }),
);
const cv2 = ok(
  await call(manager, "decide_development", {
    v: latest.id,
    decision: "APPROVED",
    reason: "후속 개편 확인",
  }),
);
assert.equal(
  sql(
    `select count(distinct course_id) from public.life_course_versions where id in ('${cv}','${cv2}')`,
  ),
  "1",
);
board = ok(await call(manager, "development_board", { o, staff: true }));
assert.equal(board.counts[0].new_count, 0);
assert.equal(board.counts[0].revision_count, 1);
pass(
  "later approved version keeps course identity and counts as revision, not another new course",
);
const role = sql(
  `select id from public.life_role_assignments where person_id='${owner.p}' and org_id='${o}' and role='INSTRUCTOR'`,
);
sql(
  `update public.life_role_assignments set valid_from=now()-interval '2 days',valid_until=now()-interval '1 day' where id='${role}'`,
);
denied(
  await call(owner, "start_development", {
    o,
    y,
    kind: "NEW",
    target: null,
    p: null,
  }),
);
assert(ok(await call(owner, "development_detail", { p })));
sql(
  `update public.life_role_assignments set valid_until=null where id='${role}'`,
);
pass(
  "expired instructor role blocks new writing while owner can read past proposal",
);
const foreign = randomUUID();
sql(
  `insert into public.life_organizations(id,slug,name) values('${foreign}','test-${foreign}','다른 가상 기관');insert into public.life_role_assignments(person_id,org_id,role) values('${other.p}','${foreign}','COURSE_MANAGER');`,
);
denied(await call(other, "development_board", { o, staff: true }));
denied(await call(other, "instructor_dossier", { d }));
denied(
  await call(other, "decide_development", {
    v: latest.id,
    decision: "APPROVED",
    reason: "cross org",
  }),
);
pass(
  "other-organization manager cannot read or decide instructor and development records",
);
// Leave a fresh dossier and proposal for the real browser flow, without automatically approving them.
const browserV = ok(
  await call(owner, "start_dossier", {
    o,
    privacy: policies.INSTRUCTOR_PRIVACY,
    confirmed: true,
  }),
);
ok(await call(owner, "save_dossier", { v: browserV, revision: 0, payload }));
const browserP = ok(
  await call(owner, "start_development", {
    o,
    y,
    kind: "NEW",
    target: null,
    p: null,
  }),
);
const browserDV = ok(await call(owner, "development_detail", { p: browserP }))
  .versions[0].id;
ok(
  await call(owner, "save_development", {
    v: browserDV,
    revision: 0,
    payload: proposal,
  }),
);
writeFileSync(
  "/tmp/uc-life-instructor-browser.json",
  JSON.stringify({
    org: o,
    year: y,
    dossier: d,
    dossierVersion: browserV,
    proposal: browserP,
    proposalVersion: browserDV,
    policies,
    offering: f,
    validUntil: day(30),
  }),
  { mode: 0o600 },
);
console.log(
  `Instructor/development verification passed: ${checks} checks. Synthetic local data; no external verification or appointment.`,
);
