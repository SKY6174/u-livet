// Synthetic local-only identities. Exercises the real PostgREST authorization boundary.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { ensureLocalMfa } from "./local-mfa.mjs";

const status = JSON.parse(
  execFileSync("supabase", ["status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }),
);
assert.equal(status.API_URL, "http://127.0.0.1:55321");
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const run = Date.now().toString(36);
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
    { input: query, encoding: "utf8" },
  ).trim();
sql(
  "update auth.users u set email=p.email from public.user_profiles p where u.id=p.id and u.email='yhlee4@uc.ac.kr' and p.email like 'parking-%@example.invalid'",
);
const org = sql(
  `insert into public.life_organizations(slug,name) values('parking-${run}','주차권 검증 조직') returning id`,
).split("\n")[0];
const year = sql(
  `insert into public.life_project_years(org_id,label,starts_on,ends_on) values('${org}','2026 검증','2026-03-01','2027-02-28') returning id`,
).split("\n")[0];
const ok = (result) => {
  assert.equal(result.error, null, JSON.stringify(result.error));
  return result.data;
};
const deny = (result, expected) => {
  assert.ok(result.error, "expected denial");
  if (expected) assert.equal(result.error.message, expected);
};
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
}).format(new Date());
const plus = (days) =>
  new Date(Date.parse(`${today}T12:00:00+09:00`) + days * 86400000)
    .toISOString()
    .slice(0, 10);
const signup = JSON.parse(
  sql("select row_to_json(s) from life_private.signup_settings s"),
);
async function account(label, role = null) {
  const email = `parking-${run}-${label}@example.invalid`;
  const created = ok(
    await admin.auth.admin.createUser({
      email,
      password: "Local-Only-2026!",
      email_confirm: true,
      user_metadata: {
        name: `주차 검증 ${label}`,
        privacy_policy_id: "20000000-0000-4000-8000-000000000011",
        privacy_accepted: true,
        mobile_phone: "+821000000000",
      },
    }),
  );
  const jar = new Map();
  const client = createServerClient(status.API_URL, status.ANON_KEY, {
    cookies: {
      getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
      setAll: (items) =>
        items.forEach((item) => jar.set(item.name, item.value)),
    },
  });
  ok(
    await client.auth.signInWithPassword({
      email,
      password: "Local-Only-2026!",
    }),
  );
  await ensureLocalMfa(client);
  const person = ok(await client.rpc("life_identity")).id;
  if (role)
    sql(
      `insert into public.life_role_assignments(person_id,org_id,role) values('${person}','${org}','${role}')`,
    );
  return { client, person, user: created.user.id, jar };
}
let manager, learner, external, internal, reviewer, outsider;
try {
  sql(
    "update life_private.signup_settings set enabled=true,policy_id='20000000-0000-4000-8000-000000000011',org_id='10000000-0000-4000-8000-000000000001'",
  );
  manager = await account("manager", "COURSE_MANAGER");
  learner = await account("learner");
  external = await account("external", "INSTRUCTOR");
  internal = await account("internal", "INSTRUCTOR");
  reviewer = await account("reviewer", "COURSE_MANAGER");
  outsider = await account("outsider");
} finally {
  sql(
    `update life_private.signup_settings set enabled=${signup.enabled},policy_id=${signup.policy_id ? `'${signup.policy_id}'` : "null"},org_id='${signup.org_id}'`,
  );
}
sql(
  `update life_private.account_classifications set instructor_kind='INTERNAL' where person_id='${internal.person}'`,
);
sql(
  `update auth.users set email='parking-${run}-internal@uc.ac.kr',email_confirmed_at=now() where id='${internal.user}'`,
);
// Keep the fixture's credentials local. A confirmed Auth email, not the JWT's editable metadata, authorizes the center.
sql(
  `update auth.users set email='yhlee4@uc.ac.kr',email_confirmed_at=now() where id='${reviewer.user}'`,
);
const map = sql(
  "select string_agg(code||':'||reviewer_name||':'||reviewer_email,',' order by code) from public.life_parking_centers",
);
assert.match(map, /RCC:이연향:yhlee4@uc.ac.kr/);
assert.match(map, /ECC:이은주:ejlee7@uc.ac.kr/);
assert.match(map, /AID-X:임은애:jslover85@uc.ac.kr/);
const f = ok(
  await manager.client.rpc("life_create_offering", {
    o: org,
    y: year,
    title: `[검증] 무료 주차권 ${run}`,
    academy: "라이프케어",
    summary: "주차권 검증",
    curriculum: "수업",
    mode: "OFFLINE",
    location: "검증실",
    capacity: 10,
    selection_method: "REVIEW",
    apply_from: `${plus(-3)}T00:00:00Z`,
    apply_until: `${plus(-2)}T00:00:00Z`,
    starts_on: today,
    ends_on: plus(7),
  }),
);
sql(`update public.life_offerings set status='PUBLISHED' where id='${f}'`);
sql(
  `insert into public.life_offering_instructors(offering_id,person_id) values('${f}','${external.person}'),('${f}','${internal.person}')`,
);
const policy = sql(
  "select id from public.life_policy_versions where kind='ENROLLMENT' limit 1",
);
assert.ok(policy);
sql(
  `with a as (insert into public.life_applications(offering_id,person_id,status,policy_id) values('${f}','${learner.person}','ACCEPTED','${policy}') returning id,offering_id,person_id) insert into public.life_enrollments(application_id,offering_id,person_id) select * from a`,
);
const before = ok(await learner.client.rpc("life_parking_my_context"));
assert.ok(before.offerings.some((o) => o.id === f && o.center_code === null));
deny(
  await learner.client.rpc("life_parking_request", {
    f,
    d: today,
    n: 1,
    contact: "010-1234-5678",
  }),
  "REQUEST_UNAVAILABLE",
);
ok(await manager.client.rpc("life_parking_assign", { f, c: "RCC" }));
deny(
  await learner.client.rpc("life_parking_assign", { f, c: "ECC" }),
  "FORBIDDEN",
);
deny(
  await internal.client.rpc("life_parking_request", {
    f,
    d: today,
    n: 1,
    contact: "010-1234-5678",
  }),
  "REQUEST_UNAVAILABLE",
);
deny(
  await outsider.client.rpc("life_parking_request", {
    f,
    d: today,
    n: 1,
    contact: "010-1234-5678",
  }),
  "REQUEST_UNAVAILABLE",
);
const request = ok(
  await learner.client.rpc("life_parking_request", {
    f,
    d: today,
    n: 2,
    contact: "010-1234-5678",
  }),
);
assert.ok(request);
deny(
  await learner.client.rpc("life_parking_request", {
    f,
    d: today,
    n: 1,
    contact: "010-1234-5678",
  }),
  "DUPLICATE_REQUEST",
);
assert.equal(
  ok(await outsider.client.rpc("life_parking_my_context")).requests.length,
  0,
);
assert.ok(
  ok(await external.client.rpc("life_parking_my_context")).offerings.some(
    (o) => o.id === f,
  ),
);
deny(
  await manager.client.rpc("life_parking_decide", {
    r: request,
    approve: true,
    note: "",
  }),
  "FORBIDDEN",
);
deny(
  await reviewer.client.rpc("life_parking_decide", {
    r: request,
    approve: true,
    note: "",
  }),
  "INSUFFICIENT_STOCK",
);
ok(
  await manager.client.rpc("life_parking_add_stock", {
    o: org,
    c: "RCC",
    n: 3,
    note: "검증용 3매",
  }),
);
ok(
  await reviewer.client.rpc("life_parking_decide", {
    r: request,
    approve: true,
    note: "교육일 발급",
  }),
);
const dashboard = ok(
  await manager.client.rpc("life_parking_admin_context", {
    y: Number(today.slice(0, 4)),
    c: "RCC",
  }),
);
const row = dashboard.requests.find((item) => item.id === request);
assert.equal(row.status, "APPROVED");
assert.equal(row.remaining_after, 1);
assert.equal(row.reviewer_name, "주차 검증 reviewer");
assert.equal(dashboard.stock.find((s) => s.center_code === "RCC").balance, 1);
const next = ok(
  await external.client.rpc("life_parking_request", {
    f,
    d: plus(1),
    n: 2,
    contact: "010-5555-5555",
  }),
);
deny(
  await reviewer.client.rpc("life_parking_decide", {
    r: next,
    approve: true,
    note: "",
  }),
  "INSUFFICIENT_STOCK",
);
ok(
  await reviewer.client.rpc("life_parking_decide", {
    r: next,
    approve: false,
    note: "수량 재확인 필요",
  }),
);
const cancel = ok(
  await learner.client.rpc("life_parking_request", {
    f,
    d: plus(2),
    n: 1,
    contact: "010-1234-5678",
  }),
);
ok(await learner.client.rpc("life_parking_cancel", { r: cancel }));
deny(
  await learner.client.rpc("life_parking_cancel", { r: request }),
  "FORBIDDEN",
);
const table = await learner.client
  .from("life_parking_requests")
  .select("phone");
deny(table);
mkdirSync("tmp/parking-vouchers", { recursive: true });
for (const [name, actor] of [
  ["manager", manager],
  ["learner", learner],
  ["external", external],
])
  writeFileSync(
    `tmp/parking-vouchers/${name}-state.json`,
    JSON.stringify({
      cookies: Array.from(actor.jar, ([key, value]) => ({
        name: key,
        value,
        domain: "localhost",
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
        expires: -1,
      })),
      origins: [],
    }),
    { mode: 0o600 },
  );
sql(
  `update auth.users u set email=p.email from public.user_profiles p where u.id=p.id and u.id='${reviewer.user}'`,
);
console.log(
  "PASS applicant eligibility, center assignment, named reviewer, stock accounting, cancellation and table isolation",
);
