import { ensureLocalMfa } from "./local-mfa.mjs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
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
      "-tA",
    ],
    { input: q, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
const client = () =>
  createClient(status.API_URL, status.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const ok = (r) => {
  assert.equal(r.error, null, JSON.stringify(r.error));
  return r.data;
};
let checks = 0;
const pass = (s) => {
  checks++;
  console.log("PASS " + s);
};
const ORG = "10000000-0000-4000-8000-000000000001",
  YEAR = "10000000-0000-4000-8000-000000000002",
  PRIVACY = "20000000-0000-4000-8000-000000000011",
  ENROLL = "20000000-0000-4000-8000-000000000012";
const password = "Local-Only-2026!";
async function account(label, role) {
  const email = label + "@example.invalid";
  let user = (
    await admin.auth.admin.listUsers({ perPage: 1000 })
  ).data.users.find((u) => u.email === email);
  if (!user)
    user = ok(
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name: "테스트 " + label,
          privacy_policy_id: PRIVACY,
          privacy_accepted: true,
        },
      }),
    ).user;
  const c = client();
  ok(await c.auth.signInWithPassword({ email, password }));
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
  learner = await account("evaluation-learner"),
  reviewer = await account("reviewer", "CERTIFIER"),
  stranger = await account("evaluation-outsider");
const policy = randomUUID();
// Synthetic thresholds for local verification only; never institution defaults.
sql(
  `insert into public.life_policy_versions(id,org_id,kind,version,title,body,status,approved_by,approved_at) values('${policy}','${ORG}','COMPLETION','TEST-${policy}','[테스트] 출결·시험 수료기준','로컬 검증 전용: 출석 80% 이상, 모든 과제 60점 이상, 모든 시험 60점 이상. 실제 수료·증명 발급 근거로 사용하지 않음.','APPROVED','${manager.p}',now());`,
);
const iso = (delta) => new Date(Date.now() + delta).toISOString();
const day = (delta) =>
  new Date(Date.now() + 9 * 3600000 + delta * 86400000)
    .toISOString()
    .slice(0, 10);
const offering = ok(
  await manager.c.rpc("life_create_offering", {
    o: ORG,
    y: YEAR,
    title: "[테스트] 출결·시험·수료 연결",
    academy: "로컬 검증",
    summary: "출결·객관식 시험·수료 승인 검증",
    curriculum: "로컬 검증",
    mode: "BLENDED",
    location: "로컬",
    capacity: 20,
    selection_method: "FIRST_COME",
    apply_from: iso(-86400000),
    apply_until: iso(86400000),
    starts_on: day(-10),
    ends_on: day(-1),
  }),
);
ok(
  await manager.c.rpc("life_publish", {
    f: offering,
    enrollment_policy: ENROLL,
    completion_policy: policy,
  }),
);
ok(
  await manager.c.rpc("life_assign_instructor", {
    f: offering,
    p: teacher.p,
    enabled: true,
  }),
);
ok(await learner.c.rpc("life_apply", { f: offering, policy: ENROLL }));
const rpc = async (c, name, args) => ok(await c.rpc(name, args));
const run = async () => {
  const id = await rpc(manager.c, "life_calculate_completion", {
    f: offering,
    p: learner.p,
  });
  return ok(
    await manager.c
      .from("life_completion_runs")
      .select("*")
      .eq("id", id)
      .single(),
  );
};
assert.equal((await run()).outcome, "NEEDS_REVIEW");
pass("missing approved rules and evidence cannot produce completion");
assert(
  (
    await learner.c.rpc("life_propose_rules", {
      policy,
      attendance: 80,
      assignment_score: 60,
      quiz_score: 60,
    })
  ).error,
);
ok(
  await manager.c.rpc("life_propose_rules", {
    policy,
    attendance: 80,
    assignment_score: 60,
    quiz_score: 60,
  }),
);
assert.equal(
  ok(
    await learner.c
      .from("life_completion_rules")
      .select("*")
      .eq("policy_id", policy),
  ).length,
  0,
);
pass("unapproved rules hidden from learner; learner cannot propose");
let rule = ok(
  await reviewer.c
    .from("life_completion_rules")
    .select("*")
    .eq("policy_id", policy)
    .single(),
);
assert(
  (
    await reviewer.c.rpc("life_approve_rules", {
      policy,
      expected_created_at: iso(-100000),
    })
  ).error,
);
pass("stale rule approval rejected");
const temporaryRole = randomUUID();
sql(
  `insert into public.life_role_assignments(id,person_id,org_id,role) values('${temporaryRole}','${manager.p}','${ORG}','CERTIFIER');`,
);
assert.equal(
  (
    await manager.c.rpc("life_approve_rules", {
      policy,
      expected_created_at: rule.created_at,
    })
  ).error.message,
  "SELF_APPROVAL_FORBIDDEN",
);
sql(`delete from public.life_role_assignments where id='${temporaryRole}';`);
pass("combined manager/reviewer roles still cannot approve own rules");

ok(
  await reviewer.c.rpc("life_approve_rules", {
    policy,
    expected_created_at: rule.created_at,
  }),
);
assert(
  (
    await manager.c.rpc("life_propose_rules", {
      policy,
      attendance: 0,
      assignment_score: null,
      quiz_score: null,
    })
  ).error,
);
pass("approved rules are immutable");
const makeSession = (title, replaces = null) =>
  rpc(teacher.c, "life_schedule_class", {
    f: offering,
    title,
    starts_at: iso(-3 * 86400000),
    ends_at: iso(-3 * 86400000 + 3600000),
    replaces,
  });
const session = await makeSession("1차 수업"),
  missing = await makeSession("휴강 예정 수업");
assert(
  (
    await learner.c.rpc("life_record_attendance", {
      s: session,
      p: learner.p,
      minutes: 60,
      reason: "forged",
      expected_revision: 0,
    })
  ).error,
);
assert(
  (
    await learner.c.from("life_attendance").insert({
      session_id: session,
      person_id: learner.p,
      credited_minutes: 60,
      reason: "forged",
      recorded_by: learner.p,
    })
  ).error,
);
pass("learner cannot forge attendance via RPC or table");
assert(
  (
    await teacher.c.rpc("life_record_attendance", {
      s: session,
      p: learner.p,
      minutes: 61,
      reason: "invalid",
      expected_revision: 0,
    })
  ).error,
);
ok(
  await teacher.c.rpc("life_record_attendance", {
    s: session,
    p: learner.p,
    minutes: 60,
    reason: "로컬 출석부 확인",
    expected_revision: 0,
  }),
);
assert(
  (
    await teacher.c.rpc("life_record_attendance", {
      s: session,
      p: learner.p,
      minutes: 0,
      reason: "stale",
      expected_revision: 0,
    })
  ).error,
);
pass("attendance minute bounds and optimistic revision enforced");
assert.equal(
  ok(
    await stranger.c
      .from("life_attendance")
      .select("*")
      .eq("session_id", session),
  ).length,
  0,
);
pass("outsider cannot read learner attendance");
let r = await run();
assert(r.reasons.some((s) => s.includes("출결")));
assert.equal(r.evidence.sessions.length, 2);
pass("all planned sessions form denominator; missing attendance needs review");
ok(
  await teacher.c.rpc("life_cancel_class", {
    s: missing,
    reason: "로컬 휴강 테스트",
  }),
);
const replacement = await makeSession("보강 수업", missing);
ok(
  await teacher.c.rpc("life_record_attendance", {
    s: replacement,
    p: learner.p,
    minutes: 60,
    reason: "보강 출석 확인",
    expected_revision: 0,
  }),
);
assert(
  (
    await teacher.c.rpc("life_record_attendance", {
      s: missing,
      p: learner.p,
      minutes: 60,
      reason: "cancelled",
      expected_revision: 0,
    })
  ).error,
);
pass(
  "cancelled class excluded and replacement linked; cancelled attendance denied",
);
const assignment = await rpc(teacher.c, "life_teaching_content", {
  f: offering,
  kind: "ASSIGNMENT",
  title: "로컬 평가 과제",
  body: "업무 개선안을 입력하세요.",
  ordinal: 1,
  due_at: iso(86400000),
});
const submission = await rpc(learner.c, "life_submit", {
  a: assignment,
  body: "로컬 검증 답안",
});
sql(
  `update public.life_assignments set due_at=now()-interval '1 second' where id='${assignment}';`,
);
r = await run();
assert(r.reasons.some((s) => s.includes("채점")));
pass("ungraded submitted work never defaults to full credit");
ok(
  await teacher.c.rpc("life_grade", {
    s: submission,
    revision: 1,
    score: 90,
    feedback: "로컬 검증 채점",
  }),
);
const quiz = await rpc(teacher.c, "life_create_quiz", {
  f: offering,
  title: "기본 이해도 시험",
  opens_at: iso(-60000),
  closes_at: iso(3600000),
  duration_minutes: 30,
  questions: [
    {
      text: "출석은 무엇으로 확인하나요?",
      options: ["공식 출석기록", "화면 열람"],
      secretAnswer: "NEVER_SEND",
    },
  ],
  answer_key: [0],
});
assert((await learner.c.from("life_quizzes").select("*")).error);
assert(
  (await learner.c.schema("life_private").from("quiz_keys").select("*")).error,
);
pass(
  "quiz definitions and private answer keys unavailable through direct Data API",
);
assert((await stranger.c.rpc("life_start_quiz", { q: quiz })).error);
assert((await stranger.c.rpc("life_exam_room", { f: offering })).error);
pass("unenrolled user cannot start or inspect exam");
const [attempt, again] = await Promise.all([
  rpc(learner.c, "life_start_quiz", { q: quiz }),
  rpc(learner.c, "life_start_quiz", { q: quiz }),
]);
assert.equal(attempt, again);
pass("concurrent exam start creates one timed attempt");
let room = await rpc(learner.c, "life_exam_room", { f: offering });
assert(!JSON.stringify(room).includes("NEVER_SEND"));
assert.equal(room.attempts[0].score, null);
pass("exam snapshot whitelists public question fields and withholds score");
assert(
  (
    await stranger.c.rpc("life_answer_quiz", {
      a: attempt,
      answers: [0],
      finalize: true,
    })
  ).error,
);
assert(
  (
    await learner.c.rpc("life_answer_quiz", {
      a: attempt,
      answers: [5],
      finalize: true,
    })
  ).error,
);
pass("attempt ownership and assigned answer option bounds enforced");
assert.equal(
  await rpc(learner.c, "life_answer_quiz", {
    a: attempt,
    answers: [0],
    finalize: false,
  }),
  "OPEN",
);
room = await rpc(learner.c, "life_exam_room", { f: offering });
assert.deepEqual(room.attempts[0].answers, [0]);
pass("draft answers survive reload");
assert.equal(
  await rpc(learner.c, "life_answer_quiz", {
    a: attempt,
    answers: [0],
    finalize: true,
  }),
  "SUBMITTED",
);
assert.equal(
  await rpc(learner.c, "life_answer_quiz", {
    a: attempt,
    answers: [1],
    finalize: true,
  }),
  "SUBMITTED",
);
assert.equal(
  sql(
    `select score from life_private.quiz_results where attempt_id='${attempt}'`,
  ),
  "100.00",
);
pass("final submission is idempotent and cannot replace graded answer");
room = await rpc(learner.c, "life_exam_room", { f: offering });
assert.equal(room.attempts[0].score, null);
pass("score stays private until exam window closes");
const timed = await rpc(teacher.c, "life_create_quiz", {
  f: offering,
  title: "시간 종료 검증",
  opens_at: iso(-60000),
  closes_at: iso(3600000),
  duration_minutes: 1,
  questions: [{ text: "테스트", options: ["A", "B"] }],
  answer_key: [0],
});
const late = await rpc(learner.c, "life_start_quiz", { q: timed });
sql(
  `update public.life_quiz_attempts set expires_at=now()-interval '1 second' where id='${late}';`,
);
assert.equal(
  await rpc(learner.c, "life_answer_quiz", {
    a: late,
    answers: [0],
    finalize: true,
  }),
  "EXPIRED",
);
assert.equal(
  sql(
    `select count(*) from life_private.quiz_results where attempt_id='${late}'`,
  ),
  "0",
);
pass("server timer rejects late answer and produces no grade");
r = await run();
assert(r.reasons.some((s) => s.includes("응시")));
pass("expired required exam remains needs review");
// Remove only this deliberately expired synthetic quiz from the isolated test case.
sql(
  `delete from public.life_quiz_attempts where id='${late}';delete from life_private.quiz_keys where quiz_id='${timed}';delete from public.life_quizzes where id='${timed}';update public.life_quizzes set closes_at=now()-interval '1 second',opens_at=now()-interval '1 hour' where id='${quiz}';`,
);
room = await rpc(learner.c, "life_exam_room", { f: offering });
assert.equal(room.attempts[0].score, 100);
pass("ended exam publishes computed score");
let offeringRow = ok(
  await manager.c
    .from("life_offerings")
    .select("*")
    .eq("id", offering)
    .single(),
);
ok(
  await manager.c.rpc("life_seal_academics", {
    f: offering,
    expected_revision: offeringRow.academic_revision,
  }),
);
r = await run();
assert.equal(r.outcome, "READY");
assert.equal(r.evidence.sessions.length, 2);
assert.equal(r.evidence.attendance_percent, 100);
pass("completed evidence and approved rules produce READY with full snapshot");
assert((await manager.c.rpc("life_confirm_completion", { r: r.id })).error);
assert((await learner.c.rpc("life_confirm_completion", { r: r.id })).error);
pass("manager and learner cannot confirm without designated approval role");
const self = await rpc(reviewer.c, "life_calculate_completion", {
  f: offering,
  p: learner.p,
});
assert((await reviewer.c.rpc("life_confirm_completion", { r: self })).error);
pass("reviewer cannot approve own calculated result");
r = await run();
ok(
  await teacher.c.rpc("life_record_attendance", {
    s: session,
    p: learner.p,
    minutes: 59,
    reason: "출석부 정정 검증",
    expected_revision: 1,
  }),
);
assert((await reviewer.c.rpc("life_confirm_completion", { r: r.id })).error);
pass("attendance revision change blocks stale completion approval");
r = await run();
ok(await reviewer.c.rpc("life_confirm_completion", { r: r.id }));
ok(await reviewer.c.rpc("life_confirm_completion", { r: r.id }));
assert.equal(
  sql(
    `select count(*) from public.life_completion_approvals where run_id='${r.id}'`,
  ),
  "1",
);
let history = await rpc(learner.c, "life_completion_history", {});
assert(history.find((h) => h.offering_id === offering).approved_at);
assert.equal(history.find((h) => h.offering_id === offering).stale, false);
pass("separate reviewer confirms once and learner reads current completion");
ok(
  await teacher.c.rpc("life_grade", {
    s: submission,
    revision: 1,
    score: 40,
    feedback: "점수 정정 테스트",
  }),
);
history = await rpc(learner.c, "life_completion_history", {});
assert.equal(history.find((h) => h.offering_id === offering).stale, true);
r = await run();
assert.equal(r.outcome, "INELIGIBLE");
assert((await reviewer.c.rpc("life_confirm_completion", { r: r.id })).error);
pass(
  "post-approval grade correction marks old result stale and prevents failed completion",
);
assert((await learner.c.rpc("life_completion_board", { f: offering })).error);
assert.equal(
  ok(
    await learner.c
      .from("life_completion_runs")
      .select("*")
      .eq("offering_id", offering),
  ).length,
  0,
);
pass("learner cannot inspect other learners completion evidence");
assert(
  Number(
    sql(
      `select count(*) from public.life_audit_events where action='ATTENDANCE_UPDATE' and entity_id='${session}' and details->'before'->>'credited_minutes'='60' and details->'after'->>'credited_minutes'='59'`,
    ),
  ) >= 1,
);
pass("attendance correction retains before/after and actor evidence");

const selfSubmission = randomUUID();
sql(
  `insert into public.life_submissions(id,assignment_id,person_id,body) values('${selfSubmission}','${assignment}','${teacher.p}','자기 채점 차단 검증');`,
);
assert.equal(
  (
    await teacher.c.rpc("life_grade", {
      s: selfSubmission,
      revision: 1,
      score: 100,
      feedback: "self",
    })
  ).error.message,
  "SELF_APPROVAL_FORBIDDEN",
);
sql(`delete from public.life_submissions where id='${selfSubmission}';`);
pass("assigned instructor cannot grade their own submission");
// Restore a valid final local preview record, without issuing any document.
ok(
  await teacher.c.rpc("life_grade", {
    s: submission,
    revision: 1,
    score: 90,
    feedback: "로컬 검증 최종 점수",
  }),
);
r = await run();
ok(await reviewer.c.rpc("life_confirm_completion", { r: r.id }));

assert.equal((await run()).id, r.id);
pass("recalculation of unchanged approved evidence preserves the approval");
const [changed, confirmed] = await Promise.all([
  teacher.c.rpc("life_record_attendance", {
    s: session,
    p: learner.p,
    minutes: 58,
    reason: "동시 정정 검증",
    expected_revision: 2,
  }),
  reviewer.c.rpc("life_confirm_completion", { r: r.id }),
]);
ok(changed);
if (confirmed.error) assert.equal(confirmed.error.message, "REVISION_CHANGED");
history = await rpc(learner.c, "life_completion_history", {});
assert.equal(history.find((h) => h.offering_id === offering).stale, true);
pass(
  "concurrent correction and approval cannot leave a current stale approval",
);
r = await run();
ok(await reviewer.c.rpc("life_confirm_completion", { r: r.id }));
sql(
  `update public.life_offerings set status='DRAFT' where name='[테스트] 출결·시험·수료 연결' and id<>'${offering}';`,
);
console.log(`Verified ${checks} checks. Local offering: ${offering}`);
