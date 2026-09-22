// Dedicated local database only; synthetic accounts, no outbound email or AI calls.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { ensureLocalMfa } from "./local-mfa.mjs";
import { writeFileSync } from "node:fs";

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
let checks = 0;
const pass = (text) => {
  checks++;
  console.log("PASS " + text);
};
async function account(label) {
  const email = `documents-${label}@example.invalid`;
  let user = ok(
    await service.auth.admin.listUsers({ perPage: 1000 }),
  ).users.find((u) => u.email === email);
  if (!user)
    user = ok(
      await service.auth.admin.createUser({
        email,
        password: "Local-Only-2026!",
        email_confirm: true,
        user_metadata: {
          name: "가상 서류 " + label,
          privacy_policy_id: "20000000-0000-4000-8000-000000000011",
          privacy_accepted: true,
        },
      }),
    ).user;
  const client = createClient(status.API_URL, status.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  ok(
    await client.auth.signInWithPassword({
      email,
      password: "Local-Only-2026!",
    }),
  );
  await ensureLocalMfa(client);
  return {
    client,
    id: user.id,
    person: ok(await client.rpc("life_identity")).id,
  };
}
const owner = await account("owner"),
  other = await account("other"),
  manager = await account("manager");
const org = randomUUID();
let person = "00000000-0000-4000-8000-000000000000";
sql(
  `insert into public.life_organizations(id,slug,name) values('${org}','document-links-${org}','가상 서류 링크 검증');insert into public.life_role_assignments(person_id,org_id,role) values('${manager.person}','${org}','COURSE_MANAGER'),('${owner.person}','${org}','INSTRUCTOR');`,
);
const worker = spawn(
  "npx",
  [
    "-y",
    "deno",
    "run",
    "--allow-env",
    "--allow-net",
    "supabase/functions/instructor-documents/index.ts",
  ],
  {
    env: {
      ...process.env,
      SUPABASE_URL: status.API_URL,
      SUPABASE_ANON_KEY: status.ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
      ADVISORY_PII_KEY: randomBytes(32).toString("base64"),
      INSTRUCTOR_DOCUMENT_ALLOWED_ORIGINS: "http://localhost:3100",
      OPENAI_API_KEY: "",
      GEMINI_API_KEY: "",
    },
    stdio: ["ignore", "ignore", "ignore"],
    detached: true,
  },
);
async function call(actor, action, body = {}) {
  const jwt = actor
    ? ok(await actor.client.auth.getSession()).session.access_token
    : "";
  const r = await fetch("http://localhost:8000", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    body: JSON.stringify({ action, ...body }),
  });
  return { status: r.status, ...(await r.json()) };
}
const issue = (p) =>
  manager.client.rpc("life_instructor_document_invite_create", { o: org, p });
const enter = (invite) =>
  call(null, "invite-auth", {
    public_code: invite.public_code,
    pin: invite.pin,
    name: "가상 링크 강사",
  });
const context = (token) =>
  call(null, "advisory-intake-context", {
    voter_token: token,
    person_id: other.person,
    org_id: randomUUID(),
  });
try {
  for (let i = 0; i < 40; i++) {
    try {
      await fetch("http://localhost:8000");
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  person = ok(
    await manager.client.rpc("life_instructor_pool_save", {
      o: org,
      p: null,
      expected_revision: 0,
      request_key: randomUUID(),
      payload: {
        name: "가상 링크 강사",
        kind: "EXTERNAL",
        affiliation: "검증 기관",
        department: "교육팀",
        position: "강사",
        specialty: "교육",
        phone: "",
        email: "",
        notes: "가상 검증 자료",
        documents_required: true,
        status: "ACTIVE",
      },
    }),
  );
  assert.ok(
    (
      await other.client.rpc("life_instructor_document_invite_create", {
        o: org,
        p: person,
      })
    ).error,
  );
  pass("outsider cannot issue link");
  const anonymous = createClient(status.API_URL, status.ANON_KEY, {
    auth: { persistSession: false },
  });
  for (const client of [anonymous, owner.client, manager.client]) {
    assert.ok(
      (await client.from("life_instructor_document_invites").select("*")).error,
    );
    assert.ok(
      (
        await client.rpc("life_instructor_document_invite_verify", {
          code: "a".repeat(43),
          person_name: "x",
          pin: "123456",
        })
      ).error,
    );
    assert.ok(
      (
        await client.rpc("life_instructor_document_invite_access", {
          i: randomUUID(),
        })
      ).error,
    );
  }
  pass("PIN tables and verification RPC accessible only to service role");
  let invite = ok(await issue(person));
  assert.match(invite.public_code, /^[A-Za-z0-9_-]{43}$/);
  assert.match(invite.pin, /^\d{6}$/);
  assert.equal(
    sql(
      `select (pin_hash<> '${invite.pin}' and length(code_hash)=64)::text from public.life_instructor_document_invites where person_id='${person}' and revoked_at is null`,
    ),
    "true",
  );
  pass("opaque code and PIN stored as hashes");
  assert.equal(
    (await call(null, "session", { person_id: person, org_id: org })).status,
    403,
  );
  const staff = await call(manager, "session", {
    person_id: person,
    org_id: org,
  });
  assert.equal(staff.ok, true);
  assert.equal((await context(staff.data.token)).status, 403);
  pass("staff session still requires matching login JWT");
  assert.equal(
    (
      await call(null, "invite-auth", {
        public_code: invite.public_code,
        pin: invite.pin,
        name: "다른 이름",
      })
    ).status,
    403,
  );
  const badPin = invite.pin === "000000" ? "111111" : "000000";
  const attempts = await Promise.all(
    Array.from({ length: 4 }, () =>
      call(null, "invite-auth", {
        public_code: invite.public_code,
        pin: badPin,
        name: "가상 링크 강사",
      }),
    ),
  );
  assert.ok(attempts.some((x) => x.status === 429));
  assert.equal((await enter(invite)).status, 429);
  pass("name checks and concurrent PIN failures lock after five attempts");
  sql(
    `update public.life_instructor_document_invites set locked_until=now()-interval '1 second' where person_id='${person}'`,
  );
  let guest = await enter(invite);
  assert.equal(guest.ok, true);
  assert.ok(Date.parse(guest.data.expires_at) - Date.now() <= 1800000);
  pass("correct PIN enters after cooldown with a 30-minute session");
  const draft = {
    korean_name: "가상 링크 강사",
    address: "가상 링크 주소",
    phones: {},
    education: [],
    careers: [],
    licenses: [],
  };
  assert.equal(
    (
      await call(null, "advisory-intake-save-profile-draft", {
        voter_token: guest.data.token,
        resume: draft,
        person_id: other.person,
      })
    ).ok,
    true,
  );
  assert.equal(
    (await context(guest.data.token)).data.resume.address,
    "가상 링크 주소",
  );
  assert.equal(
    sql(
      `select count(*) from public.life_instructor_private_profile_drafts where person_id='${person}' and encrypted_resume not like '%가상 링크 주소%'`,
    ),
    "1",
  );
  pass("anonymous guest saves encrypted draft bound to invited person");
  assert.equal(
    (await call(null, "logout", { voter_token: guest.data.token })).ok,
    true,
  );
  assert.equal((await context(guest.data.token)).status, 403);
  pass("guest logout revokes session");
  guest = await enter(invite);
  const previous = invite;
  invite = ok(await issue(person));
  assert.equal((await enter(previous)).status, 403);
  assert.equal((await context(guest.data.token)).status, 403);
  pass("reissue revokes old PIN link and active guest session");
  guest = await enter(invite);
  sql(
    `update public.life_role_assignments set valid_until=now() where org_id='${org}' and person_id='${manager.person}'`,
  );
  assert.equal((await context(guest.data.token)).status, 403);
  assert.equal((await enter(invite)).status, 403);
  sql(
    `update public.life_role_assignments set valid_until=null where org_id='${org}' and person_id='${manager.person}'`,
  );
  pass("issuer role revocation immediately closes guest access");
  sql(
    `update public.life_instructor_document_invites set expires_at=now()-interval '1 second' where person_id='${person}' and revoked_at is null`,
  );
  assert.equal((await context(guest.data.token)).status, 403);
  assert.equal((await enter(invite)).status, 403);
  pass("expired link denies both login and existing session");
  const roleInvite = ok(await issue(owner.person));
  sql(
    `update public.life_role_assignments set valid_until=now() where org_id='${org}' and person_id='${owner.person}'`,
  );
  assert.equal(
    ok(
      await service.rpc("life_instructor_document_invite_verify", {
        code: roleInvite.public_code,
        pin: roleInvite.pin,
        person_name: "가상 서류 owner",
      }),
    ).error,
    "INVALID_CREDENTIALS",
  );
  pass("target instructor role revocation closes role-only invitation");
  invite = ok(await issue(person));
  guest = await enter(invite);
  const allowance = ok(
    await manager.client.rpc("life_instructor_allowance_save", {
      o: org,
      p: person,
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
    }),
  );
  assert.ok(
    (
      await manager.client.rpc("life_instructor_pool_remove", {
        o: org,
        p: person,
        expected_revision: 0,
      })
    ).error,
  );
  pass("delete checks current revision");
  ok(
    await manager.client.rpc("life_instructor_pool_remove", {
      o: org,
      p: person,
      expected_revision: 1,
    }),
  );
  const board = ok(
    await manager.client.rpc("life_instructor_pool_board", {
      o: org,
      p: person,
    }),
  );
  assert.ok(!board.items.some((p) => p.id === person));
  assert.ok(board.allowances.some((a) => a.id === allowance));
  assert.equal(board.counts.pending, 194000);
  assert.equal(board.selected.removed, true);
  assert.equal(board.selected.document_access, false);
  assert.equal(
    sql(
      `select count(*) from public.life_instructor_private_profile_drafts where person_id='${person}'`,
    ),
    "1",
  );
  assert.ok(
    !ok(
      await manager.client.rpc("life_instructor_document_directory", {
        p_org: org,
      }),
    ).items.some((p) => p.id === person),
  );
  pass(
    "delete hides master and directory while retaining financial totals and documents",
  );
  assert.equal((await context(guest.data.token)).status, 403);
  assert.ok((await issue(person)).error);
  assert.ok(
    (
      await manager.client.rpc("life_instructor_document_access", {
        p_org: org,
        p_person: person,
      })
    ).error,
  );
  pass("removed instructor cannot reuse guest or manager document entry");
  if (process.env.KEEP_DOCUMENT_LINK_FIXTURE === "1") {
    sql(
      `delete from life_private.instructor_pool_removals where org_id='${org}';update life_private.instructor_pool set status='ACTIVE' where org_id='${org}';`,
    );
    const fresh = ok(await issue(person));
    writeFileSync(
      "/tmp/uc-life-document-links-fixture.json",
      JSON.stringify({
        org,
        person,
        invite: fresh,
        name: "가상 링크 강사",
        session: ok(await manager.client.auth.getSession()).session,
      }),
      { mode: 0o600 },
    );
    console.log("Private local browser fixture retained.");
  }
} finally {
  try {
    process.kill(-worker.pid, "SIGTERM");
  } catch {}
  if (process.env.KEEP_DOCUMENT_LINK_FIXTURE !== "1")
    sql(
      `delete from public.life_instructor_document_sessions where org_id='${org}';delete from public.life_instructor_document_invites where org_id='${org}';delete from public.life_audit_events where org_id='${org}';delete from life_private.instructor_pool_removals where org_id='${org}';delete from life_private.instructor_allowances where org_id='${org}';delete from life_private.instructor_pool_history where org_id='${org}';delete from life_private.instructor_pool where org_id='${org}';delete from public.life_instructor_private_profile_drafts where person_id='${person}';delete from public.life_role_assignments where org_id='${org}';delete from public.life_organizations where id='${org}';delete from public.life_people where id='${person}';`,
    );
}
console.log(`${checks} document link checks passed.`);
