import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { totp } from "./local-mfa.mjs";
const status = JSON.parse(
  execFileSync("supabase", ["status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }),
);
assert.equal(status.API_URL, "http://127.0.0.1:55321");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const api = () => createClient(status.API_URL, status.ANON_KEY, options);
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, options);
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
const ok = (r) => {
  assert.ifError(r.error);
  return r.data;
};
let checks = 0;
const pass = (label) => {
  checks++;
  console.log("PASS " + label);
};
const ORG = "10000000-0000-4000-8000-000000000001",
  YEAR = "10000000-0000-4000-8000-000000000002";
const PASSWORD = "Local-Only-2026!";
const date = (d) =>
  new Date(Date.now() + d * 86400000 + 9 * 3600000).toISOString().slice(0, 10);
const args = {
  o: ORG,
  y: YEAR,
  title: "[MFA 검증] " + randomUUID(),
  academy: "테스트",
  summary: "MFA 검증",
  curriculum: "가상 과정",
  mode: "ONLINE",
  location: "로컬",
  capacity: 2,
  selection_method: "FIRST_COME",
  apply_from: new Date(Date.now() - 86400000).toISOString(),
  apply_until: new Date(Date.now() + 86400000).toISOString(),
  starts_on: date(1),
  ends_on: date(2),
};
async function account(staff = false) {
  const email = `mfa-${randomUUID()}@example.invalid`;
  const user = ok(
    await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: {
        name: "MFA 검증 계정",
        privacy_policy_id: "20000000-0000-4000-8000-000000000011",
        privacy_accepted: true,
      },
    }),
  ).user;
  const c = api();
  const signed = ok(
    await c.auth.signInWithPassword({ email, password: PASSWORD }),
  );
  const person = ok(await c.rpc("life_identity")).id;
  if (staff)
    sql(
      `insert into public.life_role_assignments(person_id,org_id,role) values('${person}','${ORG}','COURSE_MANAGER')`,
    );
  return { c, user, person, email, session: signed.session };
}
const raw = (token) =>
  createClient(status.API_URL, status.ANON_KEY, {
    ...options,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
assert.equal(totp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 59000), "287082");
pass("test TOTP generator matches RFC vector");
const manager = await account(true),
  learner = await account(),
  other = await account();
assert.equal(ok(await manager.c.rpc("life_identity")), null);
assert.equal(
  ok(await manager.c.rpc("life_security_status")).staff_required,
  true,
);
pass("administrator without MFA cannot read identity through direct API");
assert((await manager.c.rpc("life_create_offering", args)).error);
pass("administrator password alone cannot mutate business records");
assert.equal(ok(await learner.c.rpc("life_identity")).id, learner.person);
assert.equal(
  ok(await learner.c.rpc("life_security_status")).mfa_required,
  false,
);
pass("ordinary learner may continue without optional MFA");
ok(
  await manager.c.auth.updateUser({
    data: { aal: "aal2", mfa_verified: true, mfa_required: false },
  }),
);
assert.equal(ok(await manager.c.rpc("life_identity")), null);
pass("user metadata cannot bypass MFA");
assert((await manager.c.auth.mfa.enroll({factorType:"totp",friendlyName:"unapproved"})).error);pass("direct Auth factor enrollment requires a bound change permit");
const enrollmentName = ok(await manager.c.rpc("life_prepare_mfa_change", {k:"ENROLL"}));
const factor = ok(
  await manager.c.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: enrollmentName,
    issuer: "U-LIFE TEST",
  }),
);
assert.equal(ok(await manager.c.rpc("life_identity")), null);
pass("enrollment without code verification grants no access");
assert((await other.c.auth.mfa.challenge({ factorId: factor.id })).error);
pass("another account cannot challenge this factor");
const wrong = (Number(totp(factor.totp.secret)) + 1) % 1000000;
assert(
  (
    await manager.c.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code: String(wrong).padStart(6, "0"),
    })
  ).error,
);
pass("incorrect TOTP is refused");
const challenge = ok(
  await manager.c.auth.mfa.challenge({ factorId: factor.id }),
);
const verified = ok(
  await manager.c.auth.mfa.verify({
    factorId: factor.id,
    challengeId: challenge.id,
    code: totp(factor.totp.secret),
  }),
);
assert.equal(ok(await manager.c.rpc("life_security_status")).recent, true);
assert.equal(ok(await manager.c.rpc("life_identity")).id, manager.person);
pass("native verified MFA enables administrator identity and recent status");
assert(
  (
    await manager.c.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.id,
      code: totp(factor.totp.secret),
    })
  ).error,
);
pass("consumed challenge cannot be replayed");
assert.equal(
  ok(await raw(manager.session.access_token).rpc("life_identity")),
  null,
);
pass("pre-MFA AAL1 token does not inherit elevated access");
const offering = ok(await manager.c.rpc("life_create_offering", args));
assert.ok(offering);
pass("recent MFA allows an authorized management write");
const claims = JSON.parse(
  Buffer.from(verified.access_token.split(".")[1], "base64url").toString(),
);
assert.match(claims.session_id, /^[0-9a-f-]{36}$/);
sql(
  `update auth.mfa_amr_claims set updated_at=now()-interval '16 minutes' where session_id='${claims.session_id}' and authentication_method='totp'`,
);
assert.equal(
  ok(await manager.c.rpc("life_security_status")).mfa_verified,
  true,
);
assert.equal(ok(await manager.c.rpc("life_security_status")).recent, false);
assert.equal(ok(await manager.c.rpc("life_identity")).id, manager.person);
pass(
  "expired recent authentication preserves read access but requires step-up",
);
const count = sql("select count(*) from public.life_courses");
assert.equal(
  (await manager.c.rpc("life_create_offering", args)).error?.message,
  "MFA_REAUTH_REQUIRED",
);
assert.equal(sql("select count(*) from public.life_courses"), count);
pass("expired step-up rejects the entire mutation without partial writes");
assert.equal((await manager.c.rpc("life_prepare_mfa_change",{k:"ENROLL"})).error?.message,"MFA_REAUTH_REQUIRED");
assert((await manager.c.auth.mfa.enroll({factorType:"totp",friendlyName:"stale-session-bypass"})).error);
assert((await manager.c.auth.mfa.unenroll({factorId:factor.id})).error);
pass("stale AAL2 cannot enroll or remove a factor to manufacture recent authentication");
const stale = ok(await manager.c.auth.refreshSession()).session;
assert.equal(ok(await manager.c.rpc("life_security_status")).recent, false);
assert.equal(
  (await manager.c.rpc("life_create_offering", args)).error?.message,
  "MFA_REAUTH_REQUIRED",
);
pass("token refresh does not renew actual TOTP authentication time");
ok(
  await manager.c.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code: totp(factor.totp.secret),
  }),
);
assert.equal(ok(await manager.c.rpc("life_security_status")).recent, true);
assert.ok(ok(await manager.c.rpc("life_create_offering", args)));
pass("fresh TOTP restores authorized saving");
const expiredPermit=ok(await manager.c.rpc("life_prepare_mfa_change",{k:"ENROLL"}));
sql(`update life_private.mfa_change_permits set expires_at=now()-interval '1 second' where user_id='${manager.user.id}'`);
assert((await manager.c.auth.mfa.enroll({factorType:"totp",friendlyName:expiredPermit})).error);
pass("expired factor-change permit is refused");
const once=ok(await manager.c.rpc("life_prepare_mfa_change",{k:"ENROLL"}));
assert((await other.c.auth.mfa.enroll({factorType:"totp",friendlyName:once})).error);
const spare=ok(await manager.c.auth.mfa.enroll({factorType:"totp",friendlyName:once}));
ok(await manager.c.auth.mfa.unenroll({factorId:spare.id}));
assert((await manager.c.auth.mfa.enroll({factorType:"totp",friendlyName:once})).error);
pass("factor-change permit is owner-bound and consumed once");
assert.equal(
  ok(await raw(stale.access_token).rpc("life_security_status")).recent,
  false,
);
assert.equal(
  (await raw(stale.access_token).rpc("life_create_offering", args)).error
    ?.message,
  "MFA_REAUTH_REQUIRED",
);
pass("old JWT is not revived by another token completing reauthentication");
const learnerEnrollmentName = ok(await learner.c.rpc("life_prepare_mfa_change", {k:"ENROLL"}));
const lf = ok(
  await learner.c.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: learnerEnrollmentName,
  }),
);
ok(
  await learner.c.auth.mfa.challengeAndVerify({
    factorId: lf.id,
    code: totp(lf.totp.secret),
  }),
);
assert.deepEqual(ok(await learner.c.rpc("life_identity")).roles, []);
assert((await learner.c.rpc("life_create_offering", args)).error);
pass("optional learner MFA never grants an administrator role");
const learnerVerified = ok(await learner.c.auth.getSession()).session;
assert((await learner.c.auth.mfa.unenroll({ factorId: lf.id })).error);pass("direct verified factor removal without approval is denied");
ok(await learner.c.rpc("life_prepare_mfa_change", {k:"REMOVE",f:lf.id}));
ok(await learner.c.auth.mfa.unenroll({ factorId: lf.id }));
assert.equal(
  ok(await raw(learnerVerified.access_token).rpc("life_identity")),
  null,
);
pass("removed factor invalidates the associated AAL2 JWT for data access");
const managerBefore = ok(await manager.c.auth.getSession()).session;
const recovery = ok(
  await admin.auth.admin.generateLink({
    type: "recovery",
    email: manager.email,
  }),
);
const recover = api();
ok(
  await recover.auth.verifyOtp({
    type: "recovery",
    token_hash: recovery.properties.hashed_token,
  }),
);
assert.equal(ok(await recover.rpc("life_identity")), null);
assert.equal(ok(await recover.rpc("life_security_status")).mfa_required, true);
pass("email recovery proof alone does not bypass administrator MFA");
assert.equal(
  (await recover.auth.updateUser({ password: "Updated-Only-2026!" })).error
    ?.code,
  "insufficient_aal",
);
pass("native password change also requires MFA after email recovery");
ok(
  await recover.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code: totp(factor.totp.secret),
  }),
);
ok(await recover.auth.updateUser({ password: "Updated-Only-2026!" }));
ok(await recover.auth.signOut({ scope: "global" }));
const again = api();
ok(
  await again.auth.signInWithPassword({
    email: manager.email,
    password: "Updated-Only-2026!",
  }),
);
assert.equal(ok(await again.rpc("life_identity")), null);
assert.ok(
  ok(await again.auth.mfa.listFactors()).totp.some((f) => f.id === factor.id),
);
pass(
  "password recovery preserves MFA enrollment and requires it on next sign-in",
);
assert.equal(
  ok(await raw(managerBefore.access_token).rpc("life_identity")),
  null,
);
pass("password recovery also revokes previous MFA sessions");
ok(
  await again.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code: totp(factor.totp.secret),
  }),
);
const active = ok(await again.auth.getSession()).session;
assert((await again.rpc("life_prepare_mfa_change", {k:"REMOVE",f:factor.id})).error);assert((await again.auth.mfa.unenroll({ factorId: factor.id })).error);pass("administrator last-factor protection also holds at native Auth boundary");
ok(await again.auth.signOut({scope:"local"}));
assert.equal(ok(await raw(active.access_token).rpc("life_identity")), null);
ok(await again.auth.signInWithPassword({email:manager.email,password:"Updated-Only-2026!"}));
assert.equal(ok(await again.rpc("life_security_status")).staff_required, true);
pass("signed-out MFA session cannot access data and role-based requirement remains");
assert.equal(
  sql(
    `select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname like 'life\\_%' escape '\\' and not exists(select 1 from pg_trigger t where t.tgrelid=c.oid and t.tgname='life_recent_mfa_write')`,
  ),
  "0",
);
pass("every current life business table has the recent-MFA write guard");
assert((await api().rpc("life_security_status")).error);
pass("anonymous clients cannot inspect account security status");
const browser = await account(true);
writeFileSync(
  "/tmp/uc-life-mfa-browser.json",
  JSON.stringify({
    email: browser.email,
    userId: browser.user.id,
    personId: browser.person,
    password: PASSWORD,
  }),
  { mode: 0o600 },
);
console.log(
  `Administrator MFA verification passed: ${checks} checks. Synthetic local accounts only.`,
);
