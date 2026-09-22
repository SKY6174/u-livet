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
    "--allow-read",
    "--config",
    "supabase/functions/instructor-documents/deno.json",
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
// Deliberately synthetic signature, no personal data. 8x8 black PNG.
const signature =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAADElEQVR4nGNgGAUAAADIAAGpfRGwAAAAAElFTkSuQmCC";
const form = {
  name: "가상 링크 강사",
  date: "2026-09-22",
  phone: "010-0000-0000",
  resident_number: "000000-0000000",
  is_foreign: false,
  english_name: "",
  birth_date: "",
  foreign_number: "",
  affiliation: "가상 기관",
  program: "가상 보조강의",
  period_start: "2026-09-01",
  period_end: "2026-12-31",
  privacy_consent: "YES",
  unique_id_consent: "YES",
  criminal_consent: true,
  integrity_confirm: true,
  relations: ["NO", "NO", "NO"],
  related_name: "",
  related_department: "",
  relationship: "",
  signature,
};
const types = ["PRIVACY_CONSENT", "CRIMINAL_CONSENT", "INTEGRITY_PLEDGE"];
const board = async () =>
  ok(await manager.client.rpc("life_instructor_pool_board", { o: org }));
try {
  for (let i = 0; i < 60; i++) {
    try {
      await fetch("http://localhost:8000");
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  const payload = {
    name: form.name,
    kind: "EXTERNAL",
    teaching_role: "ASSISTANT",
    affiliation: "가상 기관",
    department: "",
    position: "",
    specialty: "",
    phone: "",
    email: "",
    notes: "",
    documents_required: false,
    status: "ACTIVE",
  };
  const save = (payload, p = null, expected_revision = 0) =>
    manager.client.rpc("life_instructor_pool_save", {
      o: org,
      p,
      expected_revision,
      request_key: randomUUID(),
      payload,
    });
  assert.ok((await save({ ...payload, kind: "INTERNAL" })).error);
  pass("assistant cannot be internal");
  person = ok(await save(payload));
  const initial = await board();
  assert.equal(
    initial.items.find((x) => x.id === person).teaching_role,
    "ASSISTANT",
  );
  assert.ok(initial.counts.external >= 1);
  assert.equal(initial.counts.ready, 0);
  pass(
    "assistant counted as external; required consent/resume overrides exemption",
  );
  const invite = ok(await issue(person));
  const entered = await enter(invite);
  assert.equal(entered.ok, true, JSON.stringify(entered));
  const token = entered.data.token;
  const send = (action, type, extra = {}) =>
    call(null, action, { voter_token: token, document_type: type, ...extra });
  const type = types[0];
  let ctx = await send("consent-context", type);
  assert.equal(ctx.ok, true);
  assert.equal(ctx.data.form.privacy_consent, "");
  assert.equal(ctx.data.form.signature, "");
  pass("blank consent and signature defaults");
  assert.equal(
    (
      await send("consent-submit", type, {
        form: { ...form, signature: "" },
        request_id: randomUUID(),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await send("consent-submit", type, {
        form: { ...form, privacy_consent: "" },
        request_id: randomUUID(),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await send("consent-submit", type, {
        form: { ...form, name: "다른 사람" },
        request_id: randomUUID(),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await send("consent-submit", types[2], {
        form: { ...form, relations: ["YES", "NO", "NO"] },
        request_id: randomUUID(),
      })
    ).status,
    400,
  );
  pass(
    "unsigned, unanswered, wrong identity and incomplete relationship rejected",
  );
  assert.equal(
    (
      await send("consent-save-draft", type, {
        form: { ...form, signature: "", privacy_consent: "" },
      })
    ).ok,
    true,
  );
  ctx = await send("consent-context", type);
  assert.equal(ctx.data.has_draft, true);
  assert.equal(ctx.data.history.length, 0);
  assert.equal(
    sql(
      `select encrypted_payload like '%가상%' from public.life_instructor_consent_drafts where org_id='${org}'`,
    ),
    "f",
  );
  pass("encrypted draft roundtrip is not completion");
  const activity = ok(
    await manager.client.rpc("life_instructor_allowance_save", {
      o: org,
      p: person,
      a: null,
      expected_revision: 0,
      request_key: randomUUID(),
      payload: {
        offering_id: "",
        title: "가상 보조강의",
        activity_kind: "TEACHING",
        activity_on: "2026-09-01",
        minutes: "60",
        rate: "50000",
        withholding: "0",
        evidence: "검증",
      },
    }),
  );
  const pay = () =>
    manager.client.rpc("life_instructor_allowance_transition", {
      o: org,
      a: activity,
      expected_revision: 1,
      action: "PAY",
      paid_on: "2026-09-22",
      reference: "LOCAL-TEST",
      evidence: "가상 지급 확인",
    });
  assert.equal((await pay()).error?.message, "DOCUMENTS_REQUIRED");
  for (const document_type of types) {
    const request_id = randomUUID();
    const submitted = await send("consent-submit", document_type, {
      form,
      request_id,
    });
    assert.equal(submitted.ok, true, JSON.stringify(submitted));
    assert.equal(
      (await send("consent-submit", document_type, { form, request_id })).ok,
      true,
    );
    assert.equal(
      sql(
        `select count(*) from public.life_instructor_consent_forms where id='${request_id}'`,
      ),
      "1",
    );
    const link = await send("consent-download", document_type, {
      id: request_id,
    });
    assert.equal(link.ok, true, JSON.stringify(link));
    const bytes = new Uint8Array(
      await (await fetch(link.data.signed_url)).arrayBuffer(),
    );
    assert.equal(new TextDecoder().decode(bytes.slice(0, 8)), "%PDF-1.7");
    writeFileSync(`/tmp/uc-life-${document_type}-signed.pdf`, bytes);
    const after = await send("consent-context", document_type);
    assert.equal(after.data.form.signature, "");
    assert.equal(after.data.history.length, 1);
  }
  pass(
    "three server-rendered private PDFs are 1.7; idempotent final versions and reset signature",
  );
  assert.equal((await pay()).error?.message, "DOCUMENTS_REQUIRED");
  pass("all consent PDFs still require external assistant resume");
  // Store a complete resume through the real authenticated PIN workflow.
  assert.equal(
    (
      await call(null, "advisory-intake-save-profile", {
        voter_token: token,
        resume: {
          korean_name: form.name,
          email: "test@example.invalid",
          resident_number: "000000-0000000",
          address: "가상주소",
          phones: { mobile: "010-0000-0000" },
          education: [],
          careers: [],
          licenses: [],
        },
      })
    ).ok,
    true,
  );
  assert.equal((await board()).counts.ready, 1);
  const decline = await send("consent-submit", type, {
    form: { ...form, privacy_consent: "NO" },
    request_id: randomUUID(),
  });
  assert.equal(decline.ok, true);
  assert.equal((await board()).counts.ready, 0);
  assert.equal((await pay()).error?.message, "DOCUMENTS_REQUIRED");
  pass("latest refused consent overrides previous signed consent");
  assert.equal(
    (await send("consent-submit", type, { form, request_id: randomUUID() })).ok,
    true,
  );
  for (const table of [
    "life_instructor_consent_drafts",
    "life_instructor_consent_forms",
  ])
    assert.ok((await owner.client.from(table).select("*")).error);
  const foreignId = randomUUID();
  assert.equal(
    (await send("consent-download", type, { id: foreignId })).status,
    404,
  );
  const otherSession = await call(owner, "session", {
    person_id: owner.person,
    org_id: org,
  });
  assert.equal(otherSession.ok, true);
  const id = sql(
    `select id from public.life_instructor_consent_forms where org_id='${org}' limit 1`,
  );
  assert.equal(
    (
      await call(owner, "consent-download", {
        voter_token: otherSession.data.token,
        document_type: type,
        id,
      })
    ).status,
    404,
  );
  assert.ok(
    (
      await service
        .from("life_instructor_consent_forms")
        .update({ status: "DECLINED" })
        .eq("id", id)
    ).error,
  );
  pass(
    "direct tables, mutation of signed versions and other person PDFs denied",
  );
  const scoped = await send("consent-context", type, {
    person_id: owner.person,
    org_id: randomUUID(),
  });
  assert.equal(scoped.data.form.name, form.name);
  pass("forged scope fields cannot change PIN target");
  ok(await pay());
  pass("valid external resume plus three latest agreements permits payment");
  assert.equal((await call(null, "logout", { voter_token: token })).ok, true);
  assert.equal((await send("consent-context", type)).status, 403);
  pass("revoked consent session denied");
} catch (error) {
  console.error(error);
  throw error;
} finally {
  try {
    process.kill(-worker.pid, "SIGTERM");
  } catch {}
  const files = ok(
    await service
      .from("life_instructor_consent_forms")
      .select("object_path")
      .eq("org_id", org),
  );
  if (files?.length)
    ok(
      await service.storage
        .from("instructor-private-documents")
        .remove(files.map((x) => x.object_path)),
    );
  sql(
    `delete from public.life_instructor_consent_drafts where org_id='${org}';delete from public.life_instructor_consent_forms where org_id='${org}';delete from public.life_instructor_document_sessions where org_id='${org}';delete from public.life_instructor_document_invites where org_id='${org}';delete from public.life_instructor_private_profiles where person_id='${person}';delete from life_private.instructor_allowances where org_id='${org}';delete from life_private.instructor_pool_history where org_id='${org}';delete from life_private.instructor_pool where org_id='${org}';delete from public.life_audit_events where org_id='${org}';delete from public.life_role_assignments where org_id='${org}';delete from public.life_organizations where id='${org}';delete from public.life_people where id='${person}';`,
  );
}
console.log(`${checks} instructor consent checks passed.`);
