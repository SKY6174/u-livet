import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { ensureLocalMfa } from "./local-mfa.mjs";

const status = JSON.parse(execFileSync("supabase", ["status", "-o", "json"], { encoding: "utf8" }));
assert.equal(status.API_URL, "http://127.0.0.1:55321");
const sql = (query) => execFileSync("docker", ["exec", "-i", "supabase_db_uc-life-core",
  "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qtA"],
{ input: query, encoding: "utf8" }).trim();
const ok = (result) => {
  assert.equal(result.error, null, JSON.stringify(result.error));
  return result.data;
};
const slug = randomUUID();
// Local signup may be intentionally closed; reuse the existing synthetic instructor.
const email = "documents-owner@example.invalid";
const password = "Local-Only-2026!";
const client = createClient(status.API_URL, status.ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
ok(await client.auth.signInWithPassword({ email, password }));
await ensureLocalMfa(client);
const person = ok(await client.rpc("life_identity")).id;
const anchor = sql("select id from public.life_organizations where slug='uc-anchor'");
const sanhak = sql("select id from public.life_organizations where slug='uc-sanhak'");
assert(anchor && sanhak);
for (const org of [anchor, sanhak]) {
  const years = sql(`select extract(year from starts_on)::int from public.life_project_years
    where org_id='${org}' and (label ~ '년 \\([1-5]차년도\\)'
      or ('${org}'='${anchor}' and label='2차년도 · 2026')) order by starts_on`);
  assert.equal(years, "2025\n2026\n2027\n2028\n2029");
  sql(`insert into public.life_role_assignments(person_id,org_id,role)
    values('${person}','${org}','INSTRUCTOR'),('${person}','${org}','COURSE_MANAGER');
    insert into public.life_policy_versions(org_id,kind,version,title,body,status,approved_by,approved_at)
    values('${org}','DEVELOPMENT','TEST-${slug}','분류 검증','로컬 검증 전용','APPROVED','${person}',now());`);
}
const year = (org, n) => sql(`select id from public.life_project_years
  where org_id='${org}' and (label='${n}년 (${n - 2024}차년도)'
    or ('${org}'='${anchor}' and ${n}=2026 and label='2차년도 · 2026')) limit 1`);
const start = (org, n, track) => client.rpc("life_start_development_classified", {
  o: org, y: year(org, n), kind: "NEW", target: null, track,
});
assert((await start(anchor, 2025, "WORKER")).error);
assert((await start(sanhak, 2025, "RCC")).error);
assert((await start(anchor, 2025, null)).error);
const a = ok(await start(anchor, 2025, "RCC"));
const b = ok(await start(anchor, 2026, "ECC"));
const c = ok(await start(sanhak, 2025, "WORKER"));
assert.equal(ok(await client.rpc("life_development_detail", { p: a })).track, "RCC");
const board = (org, n, track) => client.rpc("life_development_board_filtered", {
  o: org, staff: false, y: year(org, n), track,
});
assert(ok(await board(anchor, 2025, "RCC")).items.some((item) => item.id === a));
assert.equal(ok(await board(anchor, 2025, "ECC")).items.length, 0);
assert(ok(await board(anchor, 2026, null)).items.some((item) => item.id === b));
assert(ok(await board(sanhak, 2025, "WORKER")).items.some((item) => item.id === c));
const staffBoard = ok(await client.rpc("life_development_board_classified", {
  o: anchor, staff: true, y: year(anchor, 2025), track: "RCC", academy: null,
}));
assert.equal(staffBoard.counts[0].project_year_id, year(anchor, 2025));
assert(staffBoard.items.some((item) => item.id === a), "manager sees their own draft");
assert((await client.rpc("life_development_board_filtered", {
  o: anchor, staff: false, y: year(sanhak, 2025), track: null,
})).error);
const stranger = createClient(status.API_URL, status.ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
assert((await stranger.rpc("life_development_board_filtered", {
  o: anchor, staff: true, y: year(anchor, 2025), track: null,
})).error);
console.log("Development year/track RPC checks passed (local synthetic data).");
