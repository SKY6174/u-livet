// Synthetic accounts on the dedicated local Supabase only. No email, AI or transfers.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { ensureLocalMfa } from "./local-mfa.mjs";
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
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const ok = (r) => {
  assert.ifError(r.error);
  return r.data;
};
async function account(label) {
  const email = `pool-${label}@example.invalid`;
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
          name: `가상 강사대장 ${label}`,
          privacy_policy_id: "20000000-0000-4000-8000-000000000011",
          privacy_accepted: true,
          mobile_phone: "+821000000000",
        },
      }),
    ).user;
  const db = createClient(status.API_URL, status.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  ok(await db.auth.signInWithPassword({ email, password: "Local-Only-2026!" }));
  await ensureLocalMfa(db);
  return {
    db,
    id: u.id,
    person: sql(
      `select person_id from public.life_auth_links where auth_user_id='${u.id}'`,
    ),
  };
}
const originalSignup = JSON.parse(
  sql("select row_to_json(s) from life_private.signup_settings s"),
);
let manager, outsider, instructor;
try {
  sql(
    "update life_private.signup_settings set enabled=true,policy_id='20000000-0000-4000-8000-000000000011',org_id=(select org_id from public.life_policy_versions where id='20000000-0000-4000-8000-000000000011')",
  );
  manager = await account("manager");
  outsider = await account("outsider");
  instructor = await account("instructor");
} finally {
  sql(
    `update life_private.signup_settings set enabled=${originalSignup.enabled},policy_id=${originalSignup.policy_id ? "'" + originalSignup.policy_id + "'" : "null"},org_id='${originalSignup.org_id}'`,
  );
}
const org = randomUUID(),
  otherOrg = randomUUID();
let checks = 0;
const pass = (label) => {
  checks++;
  console.log("PASS " + label);
};
const payload = (name = "가상 교외 강사") => ({
  name,
  kind: "EXTERNAL",
  affiliation: "검증 기관",
  department: "교육팀",
  position: "강사",
  specialty: "디지털 교육",
  phone: "01000000000",
  email: "",
  notes: "가상 검증 자료",
  documents_required: true,
  status: "ACTIVE",
});
const save = (input, p = null, revision = 0, key = randomUUID()) =>
  manager.db.rpc("life_instructor_pool_save", {
    o: org,
    p,
    expected_revision: revision,
    request_key: key,
    payload: input,
  });
const board = (extra) =>
  manager.db.rpc("life_instructor_pool_board", { o: org, ...extra });
const activity = (p, extra = {}) => ({
  o: org,
  p,
  a: null,
  expected_revision: 0,
  request_key: randomUUID(),
  payload: {
    offering_id: "",
    title: "가상 강의",
    activity_kind: "TEACHING",
    activity_on: "2026-09-01",
    minutes: "120",
    rate: "100000",
    withholding: "6000",
    evidence: "가상 산출 근거",
  },
  ...extra,
});
try {
  sql(
    `insert into public.life_organizations(id,slug,name) values('${org}','pool-${org}','가상 강사 관리 검증 기관'),('${otherOrg}','pool-${otherOrg}','가상 타 기관');insert into public.life_role_assignments(person_id,org_id,role) values('${manager.person}','${org}','COURSE_MANAGER'),('${outsider.person}','${otherOrg}','COURSE_MANAGER'),('${instructor.person}','${org}','INSTRUCTOR');`,
  );
  assert.ok(
    (await outsider.db.rpc("life_instructor_pool_board", { o: org })).error,
  );
  assert.ok(
    (await instructor.db.rpc("life_instructor_pool_board", { o: org })).error,
  );
  pass("other organization and ordinary instructor cannot read pool");
  assert.ok(ok(await board()).items.some((x) => x.id === instructor.person));
  pass("existing instructor is listed without a submitted dossier");
  const request = randomUUID(),
    person = ok(await save(payload(), null, 0, request));
  assert.equal(ok(await save(payload(), null, 0, request)), person);
  pass("new instructor and idempotent retry");
  assert.equal(
    sql(
      `select count(*) from public.life_auth_links where person_id='${person}'`,
    ),
    "0",
  );
  assert.equal(
    sql(
      `select count(*) from public.life_role_assignments where person_id='${person}'`,
    ),
    "0",
  );
  pass("pool registration does not create login or teaching permissions");
  assert.ok((await save(payload(), null)).error);
  assert.ok((await save(payload(), outsider.person)).error);
  pass("duplicate profile and cross-organization identity linking denied");
  const added = { ...payload(), department: "변경 부서" };
  ok(await save(added, person, 1));
  assert.ok((await save(added, person, 1)).error);
  assert.equal(ok(await board({ p: person })).profile_history.length, 2);
  pass("optimistic revision and affiliation change history");
  const dir = ok(
    await manager.db.rpc("life_instructor_document_directory", { p_org: org }),
  );
  assert.ok(dir.items.some((x) => x.id === person));
  assert.equal(
    ok(
      await manager.db.rpc("life_instructor_document_access", {
        p_person: person,
        p_org: org,
      }),
    ).department,
    "변경 부서",
  );
  assert.ok(
    (
      await outsider.db.rpc("life_instructor_document_access", {
        p_person: person,
        p_org: org,
      })
    ).error,
  );
  pass("new pool instructor uses scoped private document workflow");
  const before = ok(await board()).total;
  assert.ok(
    (
      await manager.db.rpc("life_instructor_pool_import", {
        o: org,
        rows: [
          { request_key: randomUUID(), payload: payload("일괄 유효") },
          {
            request_key: randomUUID(),
            payload: { ...payload("일괄 오류"), phone: "bad" },
          },
        ],
      })
    ).error,
  );
  assert.equal(ok(await board()).total, before);
  pass("bulk registration rolls back every row on validation error");
  const bulk = [
    { request_key: randomUUID(), payload: payload("일괄 강사 1") },
    { request_key: randomUUID(), payload: payload("일괄 강사 2") },
  ];
  assert.equal(
    ok(
      await manager.db.rpc("life_instructor_pool_import", {
        o: org,
        rows: bulk,
      }),
    ),
    2,
  );
  assert.equal(ok(await board({ q: "일괄" })).total, 2);
  pass("bulk registration and server search");
  const internal = ok(
    await save({
      ...payload("가상 교내 강사"),
      kind: "INTERNAL",
      documents_required: false,
    }),
  );
  assert.equal(ok(await board({ kind: "INTERNAL" })).total, 1);
  assert.equal(ok(await board({ page_size: 2, page: 2 })).items.length, 2);
  pass("affiliation filtering and real pagination");
  const input = activity(person),
    aid = ok(await manager.db.rpc("life_instructor_allowance_save", input));
  assert.equal(
    ok(await manager.db.rpc("life_instructor_allowance_save", input)),
    aid,
  );
  const detail = ok(
    await manager.db.rpc("life_instructor_allowance_detail", {
      o: org,
      a: aid,
    }),
  );
  assert.equal(detail.person_id, person);
  assert.ok(
    (
      await outsider.db.rpc("life_instructor_allowance_detail", {
        o: otherOrg,
        a: aid,
      })
    ).error,
  );
  pass("allowance detail is independently scoped, regardless of pagination");
  ok(await save({ ...added, affiliation: "변경된 기관" }, person, 2));
  assert.equal(
    ok(
      await manager.db.rpc("life_instructor_allowance_detail", {
        o: org,
        a: aid,
      }),
    ).instructor_snapshot.affiliation,
    "검증 기관",
  );
  pass("past allowance affiliation survives current profile changes");
  const item = ok(await board({ p: person })).allowances[0];
  assert.equal(item.gross, 200000);
  assert.equal(item.net, 194000);
  pass("allowance calculation and duplicate request protection");
  assert.ok(
    (
      await manager.db.rpc(
        "life_instructor_allowance_save",
        activity(person, {
          payload: { ...input.payload, withholding: "200001" },
        }),
      )
    ).error,
  );
  assert.ok(
    (
      await manager.db.rpc(
        "life_instructor_allowance_save",
        activity(person, {
          payload: { ...input.payload, offering_id: randomUUID() },
        }),
      )
    ).error,
  );
  pass("over-deduction and invalid course rejected");
  const transition = (a, action = "PAY", revision = 1) => ({
    o: org,
    a,
    expected_revision: revision,
    action,
    paid_on: "2026-09-02",
    reference: "TEST-001",
    evidence: "가상 확인 근거",
  });
  assert.equal(
    (
      await manager.db.rpc(
        "life_instructor_allowance_transition",
        transition(aid),
      )
    ).error?.message,
    "DOCUMENTS_REQUIRED",
  );
  pass("external missing documents block paid record");
  const internalActivity = ok(
    await manager.db.rpc("life_instructor_allowance_save", activity(internal)),
  );
  assert.ok(
    (
      await manager.db.rpc("life_instructor_allowance_transition", {
        ...transition(internalActivity),
        evidence: "",
      })
    ).error,
  );
  ok(
    await manager.db.rpc(
      "life_instructor_allowance_transition",
      transition(internalActivity),
    ),
  );
  assert.equal(ok(await board()).counts.paid, 194000);
  assert.ok(
    (
      await manager.db.rpc(
        "life_instructor_allowance_save",
        activity(internal, { a: internalActivity, expected_revision: 2 }),
      )
    ).error,
  );
  pass("payment evidence required and paid record immutable");
  ok(
    await manager.db.rpc(
      "life_instructor_allowance_transition",
      transition(internalActivity, "CANCEL", 2),
    ),
  );
  assert.equal(ok(await board()).counts.paid, 0);
  assert.equal(
    ok(await board({ p: internal })).allowances[0].reference,
    "TEST-001",
  );
  pass("cancellation preserves original payment and excludes aggregate");
  const authSession = ok(await manager.db.auth.getSession()).session;
  const unauth = createClient(status.API_URL, status.ANON_KEY, {
    auth: { persistSession: false },
  });
  assert.ok((await unauth.rpc("life_instructor_pool_board", { o: org })).error);
  const result = sql(
    `begin;set local role authenticated;select has_table_privilege('authenticated','life_private.instructor_pool','select');rollback;`,
  );
  assert.equal(result, "f");
  pass("anonymous and direct table access denied");
  if (process.env.KEEP_POOL_FIXTURE === "1") {
    writeFileSync(
      "/tmp/uc-life-pool-fixture.json",
      JSON.stringify({
        org,
        otherOrg,
        person,
        internal,
        manager: manager.person,
        session: authSession,
      }),
      { mode: 0o600 },
    );
    console.log(
      "Local synthetic browser fixture retained in a private temp file.",
    );
  }
} finally {
  if (process.env.KEEP_POOL_FIXTURE !== "1") {
    sql(
      `create temp table pool_cleanup as select person_id from life_private.instructor_pool where org_id='${org}';delete from public.life_audit_events where org_id in ('${org}','${otherOrg}');delete from life_private.instructor_allowances where org_id='${org}';delete from life_private.instructor_pool_history where org_id='${org}';delete from life_private.instructor_pool where org_id='${org}';delete from public.life_role_assignments where org_id in ('${org}','${otherOrg}');delete from public.life_organizations where id in ('${org}','${otherOrg}');delete from public.life_people p using pool_cleanup c where p.id=c.person_id and not exists(select 1 from public.life_auth_links l where l.person_id=p.id);`,
    );
  }
}
console.log(`${checks} instructor pool checks passed.`);
