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
const org = "10000000-0000-4000-8000-000000000001",
  year = "10000000-0000-4000-8000-000000000002",
  privacy = "20000000-0000-4000-8000-000000000011",
  enroll = "20000000-0000-4000-8000-000000000012";
const stamp = randomUUID();
async function account(label, role) {
  const email = label + "@example.invalid";
  let user = (
    await admin.auth.admin.listUsers({ perPage: 1000 })
  ).data.users.find((u) => u.email === email);
  if (!user)
    user = ok(
      await admin.auth.admin.createUser({
        email,
        password: "Local-Only-2026!",
        email_confirm: true,
        user_metadata: {
          name: "테스트 " + label,
          privacy_policy_id: privacy,
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
      `insert into public.life_role_assignments(person_id,org_id,role) select '${p}','${org}','${role}' where not exists(select 1 from public.life_role_assignments where person_id='${p}' and org_id='${org}' and role='${role}');`,
    );
  return { c, p };
}
const manager = await account("operator", "COURSE_MANAGER"),
  cashier = await account("cashier", "FINANCE"),
  approver = await account("finance-approver", "FINANCE"),
  bare = await account("finance-unassigned", "FINANCE"),
  learner = await account("finance-learner"),
  other = await account("finance-outsider");
sql(
  `delete from public.life_finance_grants where person_id='${learner.p}';delete from public.life_role_assignments where person_id='${learner.p}' and role='FINANCE';`,
);
const grant = (who, perm) =>
  sql(
    `insert into public.life_finance_grants(org_id,person_id,permission,valid_from,valid_until,approved_by,approval_reference) values('${org}','${who.p}','${perm}',now()-interval '1 hour',now()+interval '30 days','${manager.p}','TEST ONLY ${stamp}') returning id;`,
  );
grant(cashier, "RECORD");
grant(cashier, "PAYOUT");
grant(approver, "APPROVE");
const policy = randomUUID(),
  ruleFull = randomUUID(),
  rulePartial = randomUUID(),
  ruleZero = randomUUID();
const completion = sql(
  `select id from public.life_policy_versions where kind='COMPLETION' and status='APPROVED' and org_id='${org}' order by effective_from desc limit 1`,
);
// These fractions and policy text are synthetic fixtures, never institutional defaults.
sql(
  `insert into public.life_policy_versions(id,org_id,kind,version,title,body,status,approved_by,approved_at) values('${policy}','${org}','REFUND','TEST-${stamp}','[테스트] 수납·환불 규정','로컬 검증 전용: 전체, 2/3, 0원 조항. 실제 대학 규정이 아니며 실제 계좌/송금에 사용하지 않음.','APPROVED','${manager.p}',now());insert into public.life_refund_rules(id,policy_id,label,basis,numerator,denominator) values('${ruleFull}','${policy}','[테스트] 전액 조항','TUITION',1,1),('${rulePartial}','${policy}','[테스트] 2/3 조항','TUITION',2,3),('${ruleZero}','${policy}','[테스트] 0원 조항','TUITION',0,1);`,
);
const iso = (d) => new Date(Date.now() + d).toISOString();
const day = (d) =>
  new Date(Date.now() + 9 * 3600000 + d * 86400000).toISOString().slice(0, 10);
async function course({
  amount = 100000,
  capacity = 10,
  selection = "FIRST_COME",
  publish = true,
} = {}) {
  const f = ok(
    await manager.c.rpc("life_create_offering", {
      o: org,
      y: year,
      title: "[테스트] 수납·환불 연결",
      academy: "수납 검증",
      summary: "가상 입금·환불 검증",
      curriculum: "로컬 검증",
      mode: "ONLINE",
      location: "로컬",
      capacity,
      selection_method: selection,
      apply_from: iso(-86400000),
      apply_until: iso(86400000 * 7),
      starts_on: day(8),
      ends_on: day(30),
    }),
  );
  ok(
    await manager.c.rpc("life_configure_finance", {
      f,
      tuition: amount,
      policy,
      hours: 24,
      instructions:
        "[테스트] 실제 입금하지 마세요. 로컬 가상 거래만 기록합니다.",
    }),
  );
  if (publish)
    ok(
      await manager.c.rpc("life_publish", {
        f,
        enrollment_policy: enroll,
        completion_policy: completion,
      }),
    );
  return f;
}
const denied = async (c, name, args) =>
  assert((await c.rpc(name, args)).error, `${name} must reject`);
const overview = async (who, staff = false) =>
  ok(await who.c.rpc("life_finance_overview", { as_staff: staff }));
const inv = async (who, f) =>
  (await overview(who)).invoices.find((i) => i.offering_id === f);
async function apply(who, f) {
  return ok(await who.c.rpc("life_apply", { f, policy: enroll }));
}
async function payment(i, amount) {
  const args = {
    i,
    amount,
    depositor: "검증 입금자",
    deposited_at: iso(-60000),
    external_ref: "TEST-" + randomUUID(),
    evidence: "로컬 가상 은행거래 검증",
  };
  return { id: ok(await cashier.c.rpc("life_record_payment", args)), args };
}
async function allocate(i, p, amount, key = randomUUID()) {
  return ok(
    await cashier.c.rpc("life_allocate_payment", {
      i,
      p,
      amount,
      request_key: key,
    }),
  );
}
const f = await course({ publish: false });
await denied(learner.c, "life_configure_finance", {
  f,
  tuition: 100,
  policy,
  hours: 24,
  instructions: "test",
});
await denied(manager.c, "life_configure_finance", {
  f,
  tuition: 100,
  policy: randomUUID(),
  hours: 24,
  instructions: "test",
});
pass("only course manager configures paid draft with approved refund policy");
ok(
  await manager.c.rpc("life_publish", {
    f,
    enrollment_policy: enroll,
    completion_policy: completion,
  }),
);
await denied(manager.c, "life_configure_finance", {
  f,
  tuition: 200,
  policy,
  hours: 24,
  instructions: "changed",
});
pass("published tuition and policy cannot be changed");
assert.equal(
  ok(await client().rpc("life_offering_finance", { f })).policy_id,
  policy,
);
await denied(client(), "life_finance_overview", { as_staff: false });
pass("public refund guidance visible but anonymous finance ledger denied");
const a = await apply(learner, f);
assert.equal(await apply(learner, f), a);
let invoice = await inv(learner, f);
assert.equal(invoice.status, "OPEN");
assert.equal(
  sql(`select status from public.life_applications where id='${a}'`),
  "PENDING_PAYMENT",
);
assert.equal(
  sql(
    `select count(*) from public.life_enrollments where application_id='${a}'`,
  ),
  "0",
);
pass("paid application is idempotent and reserves without LMS enrollment");
const report = {
  i: invoice.id,
  amount: 100000,
  depositor: "검증 신고자",
  deposited_at: iso(-60000),
  request_key: randomUUID(),
};
const rid = ok(await learner.c.rpc("life_payment_report", report));
assert.equal(ok(await learner.c.rpc("life_payment_report", report)), rid);
assert.equal((await inv(learner, f)).paid, 0);
pass("payment report is idempotent and never treated as confirmed funds");
await denied(other.c, "life_payment_report", {
  ...report,
  request_key: randomUUID(),
});
await denied(learner.c, "life_payment_report", {
  ...report,
  amount: -1,
  request_key: randomUUID(),
});
pass("payment report ownership and positive amount enforced");
await denied(manager.c, "life_record_payment", {
  i: invoice.id,
  amount: 100000,
  depositor: "test",
  deposited_at: iso(-60000),
  external_ref: "x",
  evidence: "x",
});
await denied(bare.c, "life_record_payment", {
  i: invoice.id,
  amount: 100000,
  depositor: "test",
  deposited_at: iso(-60000),
  external_ref: "x",
  evidence: "x",
});
pass(
  "course manager and finance role without delegation cannot verify receipts",
);
const p1 = await payment(invoice.id, 40000);
const duplicates = await Promise.all([
  cashier.c.rpc("life_record_payment", p1.args),
  cashier.c.rpc("life_record_payment", p1.args),
]);
duplicates.forEach((x) => assert.equal(ok(x), p1.id));
await denied(cashier.c, "life_record_payment", { ...p1.args, amount: 40001 });
pass(
  "bank reference is idempotent under concurrency and conflicting facts rejected",
);
const key = randomUUID();
const al = await allocate(invoice.id, p1.id, 40000, key);
assert.equal(await allocate(invoice.id, p1.id, 40000, key), al);
await denied(cashier.c, "life_allocate_payment", {
  i: invoice.id,
  p: p1.id,
  amount: 1,
  request_key: randomUUID(),
});
assert.equal((await inv(learner, f)).status, "OPEN");
pass(
  "partial allocation preserves pending enrollment and cannot spend same receipt twice",
);
const p2 = await payment(invoice.id, 60000);
await allocate(invoice.id, p2.id, 60000);
assert.equal((await inv(learner, f)).status, "SETTLED");
assert.equal(
  sql(`select status from public.life_enrollments where application_id='${a}'`),
  "ACTIVE",
);
pass("only full verified allocation confirms enrollment");
await denied(manager.c, "life_decide", { a, decision: "CANCELLED" });
pass("ordinary cancellation cannot bypass paid refund workflow");
assert.equal(
  (await overview(other)).invoices.some((i) => i.id === invoice.id),
  false,
);
assert.equal((await overview(manager, true)).invoices.length, 0);
for (const table of [
  "life_invoices",
  "life_payments",
  "life_refunds",
  "life_finance_grants",
])
  assert((await learner.c.from(table).select("*")).error);
assert((await cashier.c.from("life_payments").insert({})).error);
pass("raw ledgers and cross-person or non-finance reads are denied");
const otherApp = await apply(other, f);
const otherInvoice = await inv(other, f);
await denied(cashier.c, "life_allocate_payment", {
  i: otherInvoice.id,
  p: p1.id,
  amount: 1,
  request_key: randomUUID(),
});
pass("cross-person receipt allocation rejected");
const g = grant(learner, "RECORD");
sql(
  `insert into public.life_role_assignments(person_id,org_id,role) values('${learner.p}','${org}','FINANCE');`,
);
await denied(learner.c, "life_record_payment", {
  ...p1.args,
  external_ref: "SELF-" + stamp,
});
sql(
  `delete from public.life_finance_grants where id='${g}';delete from public.life_role_assignments where person_id='${learner.p}' and role='FINANCE';`,
);
pass("finance staff cannot verify their own payment");
const rr = {
  i: invoice.id,
  reason: "로컬 환불 검증",
  request_key: randomUUID(),
};
const r = ok(await learner.c.rpc("life_request_refund", rr));
assert.equal(ok(await learner.c.rpc("life_request_refund", rr)), r);
assert.equal(
  sql(`select status from public.life_enrollments where application_id='${a}'`),
  "WITHDRAWN",
);
pass("refund request is idempotent and immediately ends learning access");
await denied(other.c, "life_request_refund", {
  ...rr,
  request_key: randomUUID(),
});
await denied(approver.c, "life_decide_refund", {
  r,
  expected_revision: 1,
  approve: true,
  reason: "not reviewed",
});
pass("refund ownership and prior calculation required");
const review = {
  r,
  expected_revision: 1,
  rule: rulePartial,
  basis: "테스트 조항과 요청시점 근거 확인",
  payee_reference: "TEST 원입금자 반환 확인 문서",
};
await denied(cashier.c, "life_review_refund", {
  ...review,
  rule: randomUUID(),
});
assert.equal(ok(await cashier.c.rpc("life_review_refund", review)), 66666);
pass(
  "server calculates approved fraction with KRW floor and matching policy only",
);
await denied(cashier.c, "life_review_refund", review);
const selfApprove = grant(cashier, "APPROVE");
await denied(cashier.c, "life_decide_refund", {
  r,
  expected_revision: 2,
  approve: true,
  reason: "self",
});
sql(`delete from public.life_finance_grants where id='${selfApprove}'`);
pass("stale review and reviewer self-approval rejected");
const decision = {
  r,
  expected_revision: 2,
  approve: true,
  reason: "별도 검토 완료",
};
const approvals = await Promise.all([
  approver.c.rpc("life_decide_refund", decision),
  approver.c.rpc("life_decide_refund", decision),
]);
approvals.forEach(ok);
assert.equal((await inv(learner, f)).reserved, 66666);
assert.equal(
  sql(
    `select sum(amount) from public.life_refund_allocations where refund_id='${r}'`,
  ),
  "66666",
);
pass("concurrent approvals reserve exactly one bounded refund allocation");
const payoutGrant = grant(approver, "PAYOUT");
await denied(approver.c, "life_start_refund_transfer", {
  r,
  expected_revision: 3,
});
sql(`delete from public.life_finance_grants where id='${payoutGrant}'`);
pass("refund approver cannot execute their own approved payout");
const t = ok(
  await cashier.c.rpc("life_start_refund_transfer", {
    r,
    expected_revision: 3,
  }),
);
assert.equal(
  ok(
    await cashier.c.rpc("life_start_refund_transfer", {
      r,
      expected_revision: 3,
    }),
  ),
  t,
);
pass("retry of transfer start returns the same pending attempt");
ok(
  await cashier.c.rpc("life_resolve_refund_transfer", {
    t,
    result: "RECONCILING",
    external_ref: "",
    evidence: "테스트 은행 응답 확인 중",
    confirmed_amount: null,
  }),
);
await denied(cashier.c, "life_start_refund_transfer", {
  r,
  expected_revision: 5,
});
pass("uncertain bank result blocks another transfer attempt");
await denied(cashier.c, "life_resolve_refund_transfer", {
  t,
  result: "PAID",
  external_ref: "TEST-WRONG-" + stamp,
  evidence: "wrong",
  confirmed_amount: 1,
});
pass("payout amount must equal the approved amount");
ok(
  await cashier.c.rpc("life_resolve_refund_transfer", {
    t,
    result: "NOT_PAID",
    external_ref: "",
    evidence: "은행 원거래 미지급 확인",
    confirmed_amount: null,
  }),
);
const current = (await inv(learner, f)).refunds.find((x) => x.id === r);
const t2 = ok(
  await cashier.c.rpc("life_start_refund_transfer", {
    r,
    expected_revision: current.revision,
  }),
);
assert.notEqual(t, t2);
pass(
  "confirmed nonpayment preserves failed attempt and allows one new attempt",
);
const paid = {
  t: t2,
  result: "PAID",
  external_ref: "TEST-OUT-" + stamp,
  evidence: "가상 은행 명세 대사 완료",
  confirmed_amount: 66666,
};
ok(await cashier.c.rpc("life_resolve_refund_transfer", paid));
ok(await cashier.c.rpc("life_resolve_refund_transfer", paid));
invoice = await inv(learner, f);
assert.equal(invoice.refunded, 66666);
assert.equal(invoice.credited, 66666);
assert.equal(invoice.balance, 0);
assert.equal(invoice.reserved, 0);
pass(
  "paid refund and credit note are atomic, idempotent, and do not create false arrears",
);
const r2 = ok(
  await learner.c.rpc("life_request_refund", {
    ...rr,
    reason: "추가 반환 검토",
    request_key: randomUUID(),
  }),
);
assert.equal(
  ok(
    await cashier.c.rpc("life_review_refund", {
      ...review,
      r: r2,
      rule: ruleFull,
    }),
  ),
  33334,
);
pass("subsequent refund subtracts already paid amount from entitlement");
ok(
  await approver.c.rpc("life_decide_refund", {
    r: r2,
    expected_revision: 2,
    approve: false,
    reason: "검증 종료 반려",
  }),
);
assert.equal((await inv(learner, f)).reserved, 0);
pass("rejection reserves no funds and records reason");
// One confirmed receipt may fund multiple invoices for the same person.
const f2 = await course({ amount: 40000 }),
  f3 = await course({ amount: 60000 });
await apply(learner, f2);
await apply(learner, f3);
const i2 = await inv(learner, f2),
  i3 = await inv(learner, f3);
const p3 = await payment(i2.id, 100000);
await allocate(i2.id, p3.id, 40000);
await allocate(i3.id, p3.id, 60000);
assert.equal((await inv(learner, f2)).status, "SETTLED");
assert.equal((await inv(learner, f3)).status, "SETTLED");
pass(
  "one receipt allocates across multiple invoices without duplicating funds",
);
const one = await course({ capacity: 1 });
const race = await Promise.all([apply(learner, one), apply(other, one)]);
assert.equal(
  sql(
    `select count(*) from public.life_applications where offering_id='${one}' and status='PENDING_PAYMENT'`,
  ),
  "1",
);
assert.equal(
  sql(
    `select count(*) from public.life_applications where offering_id='${one}' and status='WAITLISTED'`,
  ),
  "1",
);
pass("concurrent paid applications cannot over-reserve capacity");
const pending = sql(
  `select person_id from public.life_applications where offering_id='${one}' and status='PENDING_PAYMENT'`,
);
const pendingActor = pending === learner.p ? learner : other;
const late = await inv(pendingActor, one);
const lp = await payment(late.id, 30000);
await allocate(late.id, lp.id, 30000);
sql(
  `update public.life_invoices set due_at=now()-interval '1 minute' where id='${late.id}'`,
);
ok(await cashier.c.rpc("life_expire_invoices", { f: one }));
assert.equal((await inv(pendingActor, one)).credited, 70000);
const waiting = sql(
  `select id from public.life_applications where offering_id='${one}' and status='WAITLISTED'`,
);
ok(await manager.c.rpc("life_decide", { a: waiting, decision: "ACCEPTED" }));
pass(
  "expired partial payment releases seat and credits unpaid amount for next applicant",
);
const lp2 = await payment(late.id, 70000);
await allocate(late.id, lp2.id, 70000);
const li = await inv(pendingActor, one);
assert.equal(li.status, "EXPIRED");
assert.equal(li.credited, 0);
assert.equal(li.balance, 0);
assert.equal(
  sql(
    `select count(*) from public.life_enrollments where application_id='${late.application_id}'`,
  ),
  "0",
);
pass("late payment is preserved for refund without taking a released seat");
const revoked = sql(
  `select id from public.life_finance_grants where person_id='${cashier.p}' and permission='RECORD' order by valid_until desc limit 1`,
);
sql(
  `update public.life_finance_grants set valid_until=now()-interval '1 minute' where person_id='${cashier.p}' and permission='RECORD'`,
);
await denied(cashier.c, "life_record_payment", {
  ...p1.args,
  external_ref: "REVOKED-" + stamp,
});
sql(
  `update public.life_finance_grants set valid_until=now()+interval '30 days' where id='${revoked}'`,
);
pass("expired delegation immediately loses payment authority");
assert.equal(
  sql(
    `select has_function_privilege('authenticated','life_private.decide_free(uuid,text)','execute')`,
  ),
  "f",
);
assert.equal(
  sql(
    `select has_function_privilege('authenticated','life_private.expire_finance(uuid)','execute')`,
  ),
  "f",
);
pass(
  "internal legacy cancellation and expiration helpers cannot bypass scoped RPCs",
);
const foreignOrg = randomUUID();
sql(
  `insert into public.life_organizations(id,slug,name) values('${foreignOrg}','test-${foreignOrg}','TEST OTHER ORG');insert into public.life_role_assignments(person_id,org_id,role) values('${bare.p}','${foreignOrg}','FINANCE');insert into public.life_finance_grants(org_id,person_id,permission,valid_from,valid_until,approved_by,approval_reference) values('${foreignOrg}','${bare.p}','RECORD',now()-interval '1 hour',now()+interval '1 day','${manager.p}','TEST');`,
);
await denied(bare.c, "life_record_payment", {
  ...p1.args,
  external_ref: "FOREIGN-" + stamp,
});
pass("a finance delegation from another institution grants no receipt access");
const rzero = ok(
  await learner.c.rpc("life_request_refund", {
    ...rr,
    reason: "0원 조항 검증",
    request_key: randomUUID(),
  }),
);
assert.equal(
  ok(
    await cashier.c.rpc("life_review_refund", {
      ...review,
      r: rzero,
      rule: ruleZero,
    }),
  ),
  0,
);
await denied(approver.c, "life_decide_refund", {
  r: rzero,
  expected_revision: 2,
  approve: true,
  reason: "zero",
});
ok(
  await approver.c.rpc("life_decide_refund", {
    r: rzero,
    expected_revision: 2,
    approve: false,
    reason: "0원 산출 반려",
  }),
);
pass("zero refund amount cannot enter payout processing");
const ca = await course({ amount: 20000 }),
  cb = await course({ amount: 20000 });
await apply(learner, ca);
await apply(learner, cb);
const ia = await inv(learner, ca),
  ib = await inv(learner, cb);
const concurrentReceipt = await payment(ia.id, 30000);
const allocations = await Promise.all([
  cashier.c.rpc("life_allocate_payment", {
    i: ia.id,
    p: concurrentReceipt.id,
    amount: 20000,
    request_key: randomUUID(),
  }),
  cashier.c.rpc("life_allocate_payment", {
    i: ib.id,
    p: concurrentReceipt.id,
    amount: 20000,
    request_key: randomUUID(),
  }),
]);
assert.equal(allocations.filter((x) => !x.error).length, 1);
assert.equal(
  sql(
    `select sum(amount) from public.life_payment_allocations where payment_id='${concurrentReceipt.id}'`,
  ),
  "20000",
);
pass(
  "concurrent allocations across invoices cannot overspend a shared receipt",
);
await denied(cashier.c, "life_allocate_payment", {
  i: ia.id,
  p: concurrentReceipt.id,
  amount: null,
  request_key: randomUUID(),
});
await denied(cashier.c, "life_record_payment", {
  ...p1.args,
  amount: 100000001,
  external_ref: "TOO-LARGE-" + stamp,
});
pass("null and oversized money inputs are rejected at database boundary");
// Fresh browser fixture, with a pending invoice and no verified deposit.
const browserOffering = await course({ amount: 120000 });
await apply(learner, browserOffering);
const browserInvoice = await inv(learner, browserOffering);
writeFileSync(
  "/tmp/uc-life-finance-browser.json",
  JSON.stringify({
    offering: browserOffering,
    invoice: browserInvoice.id,
    ruleFull,
    learner: learner.p,
  }),
  { mode: 0o600 },
);
console.log(
  `Verified ${checks} finance checks. Synthetic funds only; no actual transfers.`,
);
