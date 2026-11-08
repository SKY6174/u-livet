// Explicitly authorized, temporary synthetic production accounts; no email is sent.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_CLI } from "./lib/supabase-cli.mjs";

assert.ok(process.argv.includes("--production"), "Explicit production test authorization is required");
const mode = process.argv[2];
assert.ok(["setup", "cleanup", "learner-stage", "administrator-stage"].includes(mode));
const option = name => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const project = "uoebygejgglgiivzgyks", org = "10000000-0000-4000-8000-000000000001";
const file = resolve("ops/evidence/production-role-pages/accounts.private.json");
if (mode === "cleanup" && existsSync(file)) {
  const previous = JSON.parse(readFileSync(file, "utf8"));
  if (previous.project === project && previous.org === org && previous.cleanedAt && previous.remainingGrantedRoles === 0) {
    console.log("Temporary production account setup is already cleaned up"); process.exit(0);
  }
}
const run = args => {
  try { return JSON.parse(execFileSync(SUPABASE_CLI, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })); }
  catch { throw new Error("Production account operation failed; private CLI output was not logged"); }
};
const query = (sql, write = false) => run(["db", "query", `--remote=${project}`, write ? "--yes" : "--read-only", "-o", "json", sql]).rows;
const uuid = value => { assert.match(value ?? "", /^[a-f0-9-]{36}$/); return value; };
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const keys = ["setup", "cleanup"].includes(mode) ? run(["projects", "api-keys", `--remote=${project}`, "--reveal", "-o", "json"]) : [];
const create = key => createClient(`https://${project}.supabase.co`, key, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = keys.length ? create(keys.find(key => key.name === "service_role").api_key) : null;
const publicKey = keys.find(key => key.name === "anon")?.api_key;
const checked = response => { if (response.error) throw new Error(`Synthetic account operation failed: ${response.error.code ?? "AUTH"}`); return response.data; };
mkdirSync(resolve("ops/evidence/production-role-pages"), { recursive: true });
const save = data => { writeFileSync(file, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 }); chmodSync(file, 0o600); };
let record;
if (["learner-stage", "administrator-stage"].includes(mode)) {
  record = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(record.project, project); assert.equal(record.org, org); assert.ok(record.privateFixture && !record.cleanedAt);
  const actor = record.accounts.find(account => account.role === "administrator"); uuid(actor.person);
  assert.equal(actor.email, `prod-page-administrator-${record.nonce}@example.invalid`);
  assert.ok(record.createdUsers.some(user => user.user === actor.user && user.email === actor.email));
  if (mode === "learner-stage") {
    assert.ok(!record.suspendedAdministratorGrants);
    const grants = query(`select id,valid_until from life_role_assignments where person_id='${actor.person}' and org_id='${org}' and role<>'INSTRUCTOR' and valid_until>now()`);
    assert.equal(grants.length, 5);
    for (const grant of grants) assert.ok(record.roleIds.includes(uuid(grant.id)));
    record.suspendedAdministratorGrants = grants; save(record);
    query(`update life_role_assignments set valid_until=now()-interval '1 second' where id in (${grants.map(grant => quote(grant.id)).join(",")}) and person_id='${actor.person}' and org_id='${org}'`, true);
    console.log("Temporarily removed the synthetic administrator's five grants for the learner-only stage");
  } else {
    const grants = record.suspendedAdministratorGrants; assert.equal(grants?.length, 5);
    for (const grant of grants) { uuid(grant.id); assert.ok(Date.parse(grant.valid_until) > Date.now(), "Original grant expiry passed; clean up and start a fresh test run"); }
    const restored = query(`update life_role_assignments r set valid_until=s.expires::timestamptz from (values ${grants.map(grant => `(${quote(grant.id)},${quote(grant.valid_until)})`).join(",")}) s(id,expires) where r.id=s.id::uuid and r.person_id='${actor.person}' and r.org_id='${org}' returning r.id`, true);
    assert.equal(restored.length, 5); delete record.suspendedAdministratorGrants; save(record);
    console.log("Restored exactly the original five synthetic administrator grants and their original expiry");
  }
  process.exit(0);
}
if (mode === "setup") {
  if (existsSync(file)) {
    const previous = JSON.parse(readFileSync(file, "utf8"));
    assert.ok(previous.project === project && previous.cleanedAt && previous.remainingGrantedRoles === 0, "Existing private setup is active; clean it up first");
  }
  const original = JSON.parse(readFileSync(resolve(option("source") ?? ""), "utf8"));
  assert.equal(original.project, project);
  const learner = original.accounts[0];
  assert.match(learner.email, /^dummy-\d{2}-issue124@example\.invalid$/);
  uuid(learner.user); uuid(learner.person); uuid(original.offering);
  const settings = query("select enabled,policy_id,org_id from life_private.signup_settings where singleton")[0];
  assert.equal(settings.enabled, true, "Signup policy must already permit the test identity; never change it");
  assert.equal(settings.org_id, org);
  uuid(settings.policy_id);
  record = { project, org, createdAt: new Date().toISOString(), offering: original.offering,
    nonce: randomBytes(6).toString("hex"), accounts: [{ ...learner, role: "learner", password: original.password }], createdUsers: [], roleIds: [] };
  save(record);
  try {
    for (const [role, grants] of Object.entries({ instructor: ["INSTRUCTOR"], administrator: ["SYSTEM_ADMIN", "COURSE_MANAGER", "CERTIFIER", "FINANCE", "PERFORMANCE"] })) {
      const email = `prod-page-${role}-${record.nonce}@example.invalid`;
      const password = `ProductionQa-${randomBytes(24).toString("hex")}!`;
      const user = checked(await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: {
        name: `[검증용] production pages ${role}`, privacy_policy_id: settings.policy_id, privacy_accepted: true, mobile_phone: "+821000009999",
      } })).user;
      record.createdUsers.push({ user: uuid(user.id), email }); save(record);
      const db = create(publicKey);
      try {
        checked(await db.auth.signInWithPassword({ email, password }));
        const me = checked(await db.rpc("life_identity")); uuid(me.id);
        const rows = query(`insert into public.life_role_assignments(person_id,org_id,role,valid_until)
          select '${me.id}','${org}',role,now()+interval '60 minutes' from unnest(array[${grants.map(quote).join(",")}]) roles(role) returning id`, true);
        record.roleIds.push(...rows.map(row => uuid(row.id)));
        record.accounts.push({ role, email, password, user: user.id, person: me.id, memberEntryOperator: false }); save(record);
      } finally { await db.auth.signOut({ scope: "local" }); }
      console.log(`Created temporary ${role}; roles expire within 60 minutes`);
    }
  } catch (error) {
    try { execFileSync(process.execPath, [fileURLToPath(import.meta.url), "cleanup", "--production"], { stdio: ["ignore", "pipe", "pipe"] }); }
    catch { throw new Error("Setup failed and cleanup is incomplete; use the saved private manifest to run cleanup"); }
    throw error;
  }
} else {
  record = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(record.project, project); assert.equal(record.org, org);
  assert.ok(!record.privateFixture, "Clean up the private classroom before removing its instructor");
  if (record.cleanedAt) { console.log("Temporary production account setup is already cleaned up"); process.exit(0); }
  assert.match(record.nonce, /^[a-f0-9]{12}$/);
  for (const row of record.createdUsers) {
    uuid(row.user); assert.match(row.email, new RegExp(`^prod-page-(instructor|administrator)-${record.nonce}@example\\.invalid$`));
    const lookup = await admin.auth.admin.getUserById(row.user);
    if (lookup.error?.status === 404) continue;
    const user = checked(lookup).user;
    assert.equal(user.email, row.email, "Refuse to clean up a different user");
    const links = query(`select person_id from public.life_auth_links where auth_user_id='${row.user}'`);
    assert.equal(links.length, 1);
    const person = uuid(links[0].person_id);
    const saved = record.accounts.find(account => account.user === row.user);
    if (saved) assert.equal(saved.person, person);
    else record.accounts.push({ role: "cleanup", user: row.user, person });
    const grants = query(`select id from public.life_role_assignments where person_id='${person}' and org_id='${org}'`);
    record.roleIds = [...new Set([...record.roleIds, ...grants.map(grant => uuid(grant.id))])]; save(record);
    query(`delete from public.life_instructor_document_sessions where actor_user_id='${row.user}'`, true);
    // Supabase's Auth deletion removes refresh sessions. Expired/revoked DB roles
    // are also removed explicitly; existing learner credentials are preserved.
    checked(await admin.auth.admin.deleteUser(row.user));
  }
  if (record.roleIds.length) query(`delete from public.life_role_assignments where id in (${record.roleIds.map(id => quote(uuid(id))).join(",")}) and org_id='${org}' and person_id in (${record.accounts.filter(row => row.role !== "learner").map(row => quote(uuid(row.person))).join(",")})`, true);
  const remaining = query(`select count(*)::int count from public.life_role_assignments where id in (${record.roleIds.map(id => quote(uuid(id))).join(",") || "null"})`)[0].count;
  assert.equal(remaining, 0);
  const userIds = record.createdUsers.map(row => quote(uuid(row.user))).join(",") || "null";
  const remainingAuth = query(`select ((select count(*) from auth.users where id in (${userIds}))+(select count(*) from auth.sessions where user_id in (${userIds}))+(select count(*) from life_instructor_document_sessions where actor_user_id in (${userIds})))::int count`)[0].count;
  assert.equal(remainingAuth, 0, "Temporary authentication rows remain");
  const safe = { project, org, nonce: record.nonce, createdAt: record.createdAt, cleanedAt: new Date().toISOString(), createdAccountCount: record.createdUsers.length, remainingGrantedRoles: remaining };
  writeFileSync(file, JSON.stringify(safe, null, 2) + "\n", { mode: 0o600 });
  console.log("Removed temporary Auth accounts, sessions and granted roles; private passwords discarded");
}
