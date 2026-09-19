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
const ORG = "10000000-0000-4000-8000-000000000001",
  PRIVACY = "20000000-0000-4000-8000-000000000011",
  ENROLL = "20000000-0000-4000-8000-000000000012",
  COMPLETE = "20000000-0000-4000-8000-000000000013";
const iso = (ms) => new Date(Date.now() + ms).toISOString();
const day = (n) =>
  new Date(Date.now() + 9 * 3600000 + n * 86400000).toISOString().slice(0, 10);
async function account(label, role) {
  const email = label + "@example.invalid";
  let u = ok(await service.auth.admin.listUsers({ perPage: 1000 })).users.find(
    (u) => u.email === email,
  );
  if (!u)
    u = ok(
      await service.auth.admin.createUser({
        email,
        password: "Local-Only-2026!",
        email_confirm: true,
        user_metadata: {
          name: "테스트 " + label,
          privacy_policy_id: PRIVACY,
          privacy_accepted: true,
        },
      }),
    ).user;
  const c = client();
  ok(await c.auth.signInWithPassword({ email, password: "Local-Only-2026!" }));
  await ensureLocalMfa(c);
  const p = ok(await c.rpc("life_identity")).id;
  if (role)
    sql(
      `insert into public.life_role_assignments(person_id,org_id,role) select '${p}','${ORG}','${role}' where not exists(select 1 from public.life_role_assignments where person_id='${p}' and org_id='${ORG}' and role='${role}');`,
    );
  return { c, p };
}
const manager = await account("operator", "COURSE_MANAGER"),
  teacher = await account("instructor", "INSTRUCTOR"),
  preparer = await account("performance-preparer", "PERFORMANCE"),
  approver = await account("performance-approver", "PERFORMANCE"),
  learners = [];
for (let i = 1; i <= 3; i++)
  learners.push(await account("survey-learner-" + i));
const outsider = await account("annual-outsider");
for (const [p, permission] of [
  [preparer.p, "PREPARE"],
  [preparer.p, "APPROVE"],
  [approver.p, "APPROVE"],
])
  sql(
    `insert into public.life_performance_grants(org_id,person_id,permission,valid_from,valid_until,approval_reference) values('${ORG}','${p}','${permission}',now()-interval '1 day',now()+interval '30 days','LOCAL-TEST');`,
  );
const year = randomUUID(),
  year2 = randomUUID(),
  other = randomUUID(),
  otherYear = randomUUID();
sql(
  `insert into public.life_project_years(id,org_id,label,starts_on,ends_on) values('${year}','${ORG}','[테스트] 연차평가 ${year.slice(0, 8)}','2026-03-01','2027-02-28'),('${year2}','${ORG}','[테스트] 다음 사업연도','2027-03-01','2028-02-29');insert into public.life_organizations(id,slug,name) values('${other}','annual-${other}','연차 테스트 타기관');insert into public.life_project_years(id,org_id,label,starts_on,ends_on) values('${otherYear}','${other}','타기관 연차','2026-03-01','2027-02-28');`,
);
async function offering(title, y = year, starts = -10, ends = -4) {
  return ok(
    await manager.c.rpc("life_create_offering", {
      o: ORG,
      y,
      title,
      academy: "로컬 성과 검증",
      summary: "실제 성과가 아닌 가상 검증",
      curriculum: "로컬 테스트",
      mode: "ONLINE",
      location: "로컬",
      capacity: 20,
      selection_method: "FIRST_COME",
      apply_from: iso(-86400000),
      apply_until: iso(86400000),
      starts_on: day(starts),
      ends_on: day(ends),
    }),
  );
}
const f = await offering("[테스트] 만족도·과정 개선"),
  f2 = await offering("[테스트] 개선 반영 기수", year, -3, -1),
  f3 = await offering("[테스트] 다른 연도", year2, 190, 200);
for (const x of [f, f2, f3])
  ok(
    await manager.c.rpc("life_publish", {
      f: x,
      enrollment_policy: ENROLL,
      completion_policy: COMPLETE,
    }),
  );
for (const l of learners)
  ok(await l.c.rpc("life_apply", { f, policy: ENROLL }));
ok(await learners[0].c.rpc("life_apply", { f: f2, policy: ENROLL }));
ok(await learners[0].c.rpc("life_apply", { f: f3, policy: ENROLL }));
sql(
  `insert into public.life_offering_instructors(offering_id,person_id) values('${f}','${teacher.p}'),('${f2}','${teacher.p}');update public.life_offerings set academic_sealed=true where id in ('${f}','${f2}');`,
);
// Synthetic immutable completion evidence isolates aggregation tests. Academic workflow has its own 33 regressions.
for (const x of [f, f2])
  for (const l of x === f ? learners : [learners[0]]) {
    const run = sql(
      `insert into public.life_completion_runs(enrollment_id,offering_id,person_id,input_revision,outcome,reasons,evidence,calculated_by) select e.id,e.offering_id,e.person_id,o.academic_revision,'${l === learners[0] ? "READY" : "INELIGIBLE"}','[]','{"policy_id":"${COMPLETE}"}','${manager.p}' from public.life_enrollments e join public.life_offerings o on o.id=e.offering_id where e.offering_id='${x}' and e.person_id='${l.p}' returning id;`,
    );
    if (l === learners[0])
      sql(
        `insert into public.life_completion_approvals(run_id,approved_by) values('${run}','${approver.p}');`,
      );
  }
const board = async (y = year, a = null) =>
  ok(await manager.c.rpc("life_performance_board", { y, a }));
let b = await board();
assert.equal(b.facts.totals.enrollments, 4);
assert.equal(b.facts.totals.enrolled_people, 3);
assert.equal(b.facts.totals.completions, 2);
assert.equal(b.facts.totals.completed_people, 1);
assert.equal(b.facts.totals.completion_rate, 50);
pass("multiple enrollments and completions deduplicate people independently");
assert.equal((await board(year2)).facts.totals.enrollments, 1);
assert.equal(
  (await board(year, "없는 분야")).facts.totals.completion_rate,
  null,
);
pass("project year and academy scope; empty denominator is null");
denied(await outsider.c.rpc("life_performance_board", { y: year }));
denied(await teacher.c.rpc("life_performance_board", { y: year }));
denied(await manager.c.rpc("life_performance_board", { y: otherYear }));
denied(await client().rpc("life_performance_options"));
pass("learner, teacher, anonymous and cross-organization annual access denied");
for (const t of [
  "life_survey_rounds",
  "life_survey_results",
  "life_survey_policies",
  "life_course_reviews",
  "life_improvement_actions",
  "life_metric_definitions",
  "life_metric_observations",
  "life_performance_reports",
  "life_performance_grants",
  "life_annual_events",
])
  denied(await manager.c.from(t).select("*"));
denied(await learnerSchema());
async function learnerSchema() {
  return learners[0].c
    .schema("life_private")
    .from("survey_answers")
    .select("*");
}
pass("direct browser source, survey-answer and report access denied");
assert.equal((await board()).metrics.length, 0);
denied(
  await preparer.c.rpc("life_create_performance_report", {
    y: year,
    request_key: randomUUID(),
    reason: "등록 지표 없음",
  }),
);
pass("no institution metric approval or synthetic KPI is seeded");
const sp = randomUUID();
sql(
  `insert into public.life_policy_versions(id,org_id,kind,version,title,body,status,approved_by,approved_at) values('${sp}','${ORG}','SURVEY','TEST-${sp}','[테스트] 선택 만족도 조사','로컬 검증 전용. 가상 3문항(전반 만족·교육내용·활용가능성) 1~5점. 참여확인과 응답을 분리 보관. 보유: 로컬 환경 삭제까지. 미참여해도 수료에 불이익 없음. 완전 익명 보장 아님.','APPROVED','${manager.p}',now());insert into public.life_survey_policies(policy_id,min_responses,approval_reference) values('${sp}',3,'LOCAL-ONLY');`,
);
denied(
  await teacher.c.rpc("life_open_survey", {
    f,
    policy: sp,
    closes: iso(60000),
  }),
);
denied(
  await manager.c.rpc("life_open_survey", {
    f,
    policy: ENROLL,
    closes: iso(60000),
  }),
);
denied(
  await manager.c.rpc("life_open_survey", {
    f: f3,
    policy: sp,
    closes: iso(60000),
  }),
);
pass("survey opening requires course end, manager and approved survey policy");
const closes = iso(8000);
const round = ok(
    await manager.c.rpc("life_open_survey", { f, policy: sp, closes }),
  ),
  smallRound = ok(
    await manager.c.rpc("life_open_survey", { f: f2, policy: sp, closes }),
  );
denied(await manager.c.rpc("life_open_survey", { f, policy: sp, closes }));
pass("one frozen survey cohort per offering");
denied(await manager.c.rpc("life_finalize_survey", { r: round }));
denied(await teacher.c.rpc("life_finalize_survey", { r: round }));
pass("survey finalization requires closed round and manager");
const answer = (l, r = round, v = 5) =>
  l.c.rpc("life_answer_survey", {
    r,
    policy: sp,
    overall: v,
    content: v,
    usefulness: v,
    confirmed: true,
  });
denied(await answer(outsider));
denied(await answer(learners[0], round, 6));
denied(
  await learners[0].c.rpc("life_answer_survey", {
    r: round,
    policy: sp,
    overall: 5,
    content: 5,
    usefulness: 5,
    confirmed: false,
  }),
);
pass("non-invite, invalid rating and missing consent rejected");
const parallel = await Promise.all([answer(learners[0]), answer(learners[0])]);
parallel.forEach(ok);
for (const l of learners.slice(1)) ok(await answer(l));
ok(await answer(learners[0], smallRound));
const qb = async () => ok(await manager.c.rpc("life_quality_board", { f }));
assert.equal((await qb()).survey.responses, 3);
assert.equal((await qb()).survey.overall, null);
pass(
  "duplicate survey submission counted once and results hidden before closure",
);
assert(!JSON.stringify(await qb()).includes(learners[0].p));
assert(
  !JSON.stringify(ok(await learners[0].c.rpc("life_my_surveys"))).includes(
    "overall",
  ),
);
pass("staff never receives respondent links and learner receipts omit answers");
await new Promise((r) =>
  setTimeout(r, Math.max(0, Date.parse(closes) - Date.now() + 150)),
);
assert.equal((await qb()).survey.overall, null);
ok(await manager.c.rpc("life_finalize_survey", { r: round }));
ok(await manager.c.rpc("life_finalize_survey", { r: round }));
ok(await manager.c.rpc("life_finalize_survey", { r: smallRound }));
assert.equal((await qb()).survey.overall, 5);
assert.throws(() =>
  sql(
    `update public.life_survey_results set summary='{}' where round_id='${round}';`,
  ),
);
const small = ok(await teacher.c.rpc("life_quality_board", { f: f2 })).survey;
assert.equal(small.overall, null);
assert.equal(small.responses, 1);
pass("closed cohort releases only above the approved response threshold");
// Existing submissions remain idempotent after close. New invite below tests late entry.
sql(
  `insert into life_private.survey_participation(round_id,person_id) values('${round}','${outsider.p}');`,
);
denied(await answer(outsider));
pass("new survey submission after close denied");
assert.throws(() =>
  sql(
    `update public.life_survey_rounds set min_responses=1 where id='${round}';`,
  ),
);
pass("survey question/privacy threshold and close time cannot be edited");
ok(
  await teacher.c.rpc("life_quality_feedback", {
    f,
    note: "실습 예제를 더 늘려 주세요.",
    revision: 0,
  }),
);
denied(
  await teacher.c.rpc("life_quality_feedback", {
    f,
    note: "동시 수정",
    revision: 0,
  }),
);
denied(
  await outsider.c.rpc("life_quality_feedback", {
    f,
    note: "타인 의견",
    revision: 0,
  }),
);
pass("instructor feedback uses assignment and optimistic revision");
const review = ok(
  await manager.c.rpc("life_review_course", {
    f,
    decision: "REVISE",
    summary: "실습 자료를 보완해 다음 기수에 반영",
    revision: 0,
  }),
);
denied(
  await manager.c.rpc("life_review_course", {
    f,
    decision: "KEEP",
    summary: "낡은 버전",
    revision: 0,
  }),
);
assert.throws(() =>
  sql(
    `update public.life_course_reviews set summary='overwrite' where id='${review}';`,
  ),
);
pass("course decision versions append without overwriting evidence");
denied(
  await manager.c.rpc("life_add_improvement", {
    r: review,
    owner: outsider.p,
    plan: "부적격 담당자",
    due: day(5),
  }),
);
const improvement = ok(
  await manager.c.rpc("life_add_improvement", {
    r: review,
    owner: teacher.p,
    plan: "실습 자료 2개 추가",
    due: day(5),
  }),
);
denied(
  await outsider.c.rpc("life_report_improvement", {
    i: improvement,
    target: f2,
    evidence: "타인",
    revision: 1,
  }),
);
denied(
  await teacher.c.rpc("life_report_improvement", {
    i: improvement,
    target: f,
    evidence: "같은 기수",
    revision: 1,
  }),
);
ok(
  await teacher.c.rpc("life_report_improvement", {
    i: improvement,
    target: f2,
    evidence: "TEST-CURRICULUM-REVISION-2",
    revision: 1,
  }),
);
pass("improvement owner and valid later offering required");
sql(
  `insert into public.life_role_assignments(person_id,org_id,role) values('${teacher.p}','${ORG}','COURSE_MANAGER');`,
);
assert.equal(
  (
    await teacher.c.rpc("life_verify_improvement", {
      i: improvement,
      note: "자기 확인",
      revision: 2,
    })
  ).error?.message,
  "SELF_APPROVAL_FORBIDDEN",
);
sql(
  `delete from public.life_role_assignments where person_id='${teacher.p}' and role='COURSE_MANAGER';`,
);
denied(
  await manager.c.rpc("life_verify_improvement", {
    i: improvement,
    note: "낡은 버전",
    revision: 1,
  }),
);
ok(
  await manager.c.rpc("life_verify_improvement", {
    i: improvement,
    note: "가상 개편 자료 검토 완료",
    revision: 2,
  }),
);
assert.equal((await qb()).improvements[0].status, "VERIFIED");
pass("separate manager verifies next-cohort evidence with revision guard");
const metricData = (code, source = "ENROLLMENTS", formula = "COUNT") => ({
  code,
  title: "[테스트] " + code,
  unit: formula === "COUNT" ? "건" : "%",
  source,
  formula,
  target: 100,
  population: "해당 사업연도 귀속 기수의 등록자",
  dedup_rule: "정의된 source 기준, 수강건수와 사람 수 구분",
  calculation: "COHORT_CURRENT_V1 또는 승인 외부 집계",
  evidence_requirement: "현재 원장 또는 검증용 외부 문서 참조",
});
const createMetric = async (code, source, formula) =>
  ok(
    await preparer.c.rpc("life_create_metric", {
      y: year,
      d: metricData(code, source, formula),
    }),
  );
const approveMetric = async (m) =>
  ok(
    await approver.c.rpc("life_approve_metric", {
      m,
      reference: "TEST-DEFINITION-APPROVAL",
    }),
  );
denied(
  await manager.c.rpc("life_create_metric", {
    y: year,
    d: metricData("DENIED"),
  }),
);
denied(
  await preparer.c.rpc("life_create_metric", {
    y: otherYear,
    d: metricData("DENIED"),
  }),
);
pass("official metric editing requires scoped PERFORMANCE prepare grant");
const m = await createMetric("ENROLLMENT_COUNT");
denied(
  await preparer.c.rpc("life_approve_metric", { m, reference: "자기 승인" }),
);
const draftReport = ok(
  await preparer.c.rpc("life_create_performance_report", {
    y: year,
    request_key: randomUUID(),
    reason: "미승인 검증",
  }),
);
denied(
  await approver.c.rpc("life_approve_performance_report", {
    r: draftReport,
    reference: "TEST",
  }),
);
pass("unapproved definition blocks report approval");
await approveMetric(m);
assert.throws(() =>
  sql(`update public.life_metric_definitions set target=1 where id='${m}';`),
);
pass("approved metric definition is immutable");
const external = await createMetric("EXTERNAL_RATE", "EXTERNAL", "RATE");
await approveMetric(external);
assert.equal(
  (await board()).metrics.find((x) => x.definition.id === external).blocker,
  "MISSING_SOURCE",
);
pass("missing external observations stay missing rather than zero");
const observe = (n, d, u = 0, date = day(0)) =>
  preparer.c.rpc("life_record_metric", {
    m: external,
    n,
    d,
    unknown_count: u,
    observed: date,
    source_ref: "TEST-ACADEMIC-COHORT",
    evidence: "TEST-EVIDENCE-001",
  });
denied(await observe(11, 10));
denied(await observe(1, 10, 10));
denied(await observe(1, 10, 0, day(1)));
denied(await observe(1, 10, 0, "2025-01-01"));
denied(await observe(-1, 10));
pass("external numerator, unknown population and observation dates validated");
ok(await observe(0, 0));
assert.equal(
  (await board()).metrics.find((x) => x.definition.id === external).value,
  null,
);
ok(await observe(2, 10, 3));
assert.equal(
  (await board()).metrics.find((x) => x.definition.id === external).blocker,
  "UNCONFIRMED_SOURCE",
);
pass("zero denominator and unknown responses block official confirmation");
const uncertain = ok(
  await preparer.c.rpc("life_create_performance_report", {
    y: year,
    request_key: randomUUID(),
    reason: "미확인 원자료 검증",
  }),
);
denied(
  await approver.c.rpc("life_approve_performance_report", {
    r: uncertain,
    reference: "TEST",
  }),
);
pass("unconfirmed external data cannot be approved");
ok(await observe(2, 10));
const key = randomUUID();
const reports = await Promise.all([
  preparer.c.rpc("life_create_performance_report", {
    y: year,
    request_key: key,
    reason: "동시 보고 생성",
  }),
  preparer.c.rpc("life_create_performance_report", {
    y: year,
    request_key: key,
    reason: "동시 보고 생성",
  }),
]);
assert.equal(ok(reports[0]), ok(reports[1]));
const report = reports[0].data;
denied(
  await preparer.c.rpc("life_create_performance_report", {
    y: year,
    request_key: key,
    reason: "다른 요청내용",
  }),
);
pass(
  "concurrent report requests share a single version and reject key conflicts",
);
assert.equal(
  (
    await preparer.c.rpc("life_approve_performance_report", {
      r: report,
      reference: "자기 승인",
    })
  ).error?.message,
  "SELF_APPROVAL_FORBIDDEN",
);
denied(await outsider.c.rpc("life_performance_report", { r: report }));
denied(
  await manager.c.rpc("life_approve_performance_report", {
    r: report,
    reference: "위임 없음",
  }),
);
pass("report ownership, scoped approval and separation of duties enforced");
sql(
  `insert into public.life_performance_grants(org_id,person_id,permission,valid_from,valid_until,approval_reference) values('${ORG}','${approver.p}','PREPARE',now()-interval '1 day',now()+interval '1 day','LOCAL-SELF-APPROVAL-TEST');`,
);
const someoneElseReport = ok(
  await approver.c.rpc("life_create_performance_report", {
    y: year,
    request_key: randomUUID(),
    reason: "자료 입력자 승인 차단 검증",
  }),
);
assert.equal(
  (
    await preparer.c.rpc("life_approve_performance_report", {
      r: someoneElseReport,
      reference: "자료 입력자 승인",
    })
  ).error?.message,
  "SELF_APPROVAL_FORBIDDEN",
);
sql(
  `delete from public.life_performance_grants where person_id='${approver.p}' and permission='PREPARE';`,
);
pass(
  "external observation author cannot approve another preparer report even with APPROVE grant",
);
const old = ok(await approver.c.rpc("life_performance_report", { r: report }));
sql(
  `update public.life_offerings set academic_revision=academic_revision+1 where id='${f}';`,
);
assert.equal((await board()).facts.totals.completions, 1);
assert.equal((await board()).facts.totals.stale_completions, 1);
denied(
  await approver.c.rpc("life_approve_performance_report", {
    r: report,
    reference: "STALE",
  }),
);
pass("changed academic evidence invalidates old completion and draft report");
const current = ok(
  await preparer.c.rpc("life_create_performance_report", {
    y: year,
    request_key: randomUUID(),
    reason: "원자료 변경 반영",
  }),
);
ok(
  await approver.c.rpc("life_approve_performance_report", {
    r: current,
    reference: "TEST-REPORT-APPROVED",
  }),
);
const frozen = ok(
  await approver.c.rpc("life_performance_report", { r: current }),
);
assert.equal(
  frozen.snapshot.metrics.find((x) => x.definition.id === external).value,
  20,
);
assert.equal(frozen.status, "APPROVED");
assert.throws(() =>
  sql(
    `update public.life_performance_reports set reason='overwrite' where id='${current}';`,
  ),
);
pass("approved snapshot preserves exact values and cannot be overwritten");
ok(await observe(3, 10));
assert.equal(
  ok(await approver.c.rpc("life_performance_report", { r: current })).stale,
  true,
);
assert.equal(
  ok(
    await approver.c.rpc("life_performance_report", { r: current }),
  ).snapshot.metrics.find((x) => x.definition.id === external).value,
  20,
);
const replacement = ok(
  await preparer.c.rpc("life_create_performance_report", {
    y: year,
    request_key: randomUUID(),
    reason: "외부 실적 정정",
  }),
);
const sibling = ok(
  await preparer.c.rpc("life_create_performance_report", {
    y: year,
    request_key: randomUUID(),
    reason: "동일 원자료 다른 초안",
  }),
);
ok(
  await approver.c.rpc("life_approve_performance_report", {
    r: replacement,
    reference: "TEST-CORRECTION",
  }),
);
assert.equal(
  ok(await approver.c.rpc("life_performance_report", { r: replacement }))
    .supersedes_id,
  current,
);
denied(
  await approver.c.rpc("life_approve_performance_report", {
    r: sibling,
    reference: "OLD-BRANCH",
  }),
);
pass(
  "corrections create new versions and outdated report branches cannot finalize",
);
const newer = await createMetric("ENROLLMENT_COUNT");
assert.equal(
  (await board()).metrics.find((x) => x.definition.code === "ENROLLMENT_COUNT")
    .blocker,
  "DEFINITION_UNAPPROVED",
);
await approveMetric(newer);
pass(
  "latest draft definition cannot silently fall back to earlier approved version",
);
// A boundary violation is visible, never silently moved to a calendar-year bucket.
sql(`update public.life_offerings set ends_on='2027-03-02' where id='${f2}';`);
assert.equal((await board()).facts.totals.boundary_issues, 1);
assert.equal(
  (await board()).metrics.find((x) => x.definition.id === newer).blocker,
  "YEAR_BOUNDARY_REVIEW",
);
sql(`update public.life_offerings set ends_on='${day(-1)}' where id='${f2}';`);
pass("business-year boundary exceptions block native official metrics");
sql(
  `update public.life_offering_instructors set valid_until=now()-interval '1 second' where offering_id='${f}' and person_id='${teacher.p}';`,
);
denied(await teacher.c.rpc("life_quality_board", { f }));
denied(
  await teacher.c.rpc("life_quality_feedback", {
    f,
    note: "종료 후 수정",
    revision: 1,
  }),
);
sql(
  `update public.life_offering_instructors set valid_until=null where offering_id='${f}' and person_id='${teacher.p}';`,
);
pass("revoked instructor assignment removes quality access immediately");
sql(
  `update public.life_performance_grants set valid_until=now()-interval '1 second',valid_from=now()-interval '1 day' where person_id='${preparer.p}' and permission='PREPARE';`,
);
denied(
  await preparer.c.rpc("life_create_metric", {
    y: year,
    d: metricData("REVOKED"),
  }),
);
sql(
  `update public.life_performance_grants set valid_until=now()+interval '30 days' where person_id='${preparer.p}' and permission='PREPARE';`,
);
pass("expired performance grants remove mutation access immediately");
assert.equal(old.snapshot.facts.totals.completions, 2);
assert.equal((await board()).facts.totals.enrolled_people, 3);
pass("historic snapshot remains independent of later corrections");
const completionMetric = await createMetric(
  "COMPLETION_CHECK",
  "COMPLETIONS",
  "COUNT",
);
await approveMetric(completionMetric);
let completionRow = (await board()).metrics.find(
  (x) => x.definition.id === completionMetric,
);
assert.equal(completionRow.blocker, "COMPLETION_REVIEW");
assert.equal(completionRow.unknown_count, 3);
const completionReport = ok(
  await preparer.c.rpc("life_create_performance_report", {
    y: year,
    request_key: randomUUID(),
    reason: "수료 미확인 공식 지표 검증",
  }),
);
assert.equal(
  (
    await approver.c.rpc("life_approve_performance_report", {
      r: completionReport,
      reference: "TEST",
    })
  ).error?.message,
  "REPORT_NOT_READY",
);
pass(
  "completion review union deduplicates overlapping stale and unresolved records and blocks finalization",
);
const superseded = await createMetric(
  "COMPLETION_CHECK",
  "ENROLLMENTS",
  "COUNT",
);
await approveMetric(superseded);
// Leave a fresh synthetic cohort for real UI opening, learner response, teacher feedback and review.
const browserOffering = await offering(
  "[테스트] 브라우저 만족도 조사",
  year,
  -8,
  -2,
);
ok(
  await manager.c.rpc("life_publish", {
    f: browserOffering,
    enrollment_policy: ENROLL,
    completion_policy: COMPLETE,
  }),
);
for (const l of learners)
  ok(await l.c.rpc("life_apply", { f: browserOffering, policy: ENROLL }));
sql(
  `insert into public.life_offering_instructors(offering_id,person_id) values('${browserOffering}','${teacher.p}');delete from public.life_performance_grants where person_id='${preparer.p}' and permission='APPROVE';`,
);
writeFileSync(
  "/tmp/uc-life-annual-browser.json",
  JSON.stringify({
    year,
    offering: f,
    browserOffering,
    nextOffering: f2,
    round,
    report: replacement,
    external,
  }),
  { mode: 0o600 },
);
console.log(
  `Annual verification passed: ${checks} checks. Synthetic local data only.`,
);
