// Native Auth -> real RPC boundaries in the dedicated synthetic local database.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const dir = process.env.APPLICATION_TEST_DB_DIR;
assert.ok(dir, "Dedicated APPLICATION_TEST_DB_DIR is required.");
assert.match(readFileSync(resolve(dir, "supabase/config.toml"), "utf8"), /^project_id = "uc-life-issues"$/m);
const config = JSON.parse(execFileSync("supabase", ["status", "--workdir", dir, "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
assert.equal(config.API_URL, "http://127.0.0.1:56321");
const container = "supabase_db_uc-life-issues";
assert.equal(JSON.parse(execFileSync("docker", ["inspect", container], { encoding: "utf8" }))[0].Config.Labels["com.supabase.cli.project"], "uc-life-issues");
const sql = q => execFileSync("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qtA"], { input: q, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
const { ids, learner, password } = JSON.parse(readFileSync("/tmp/u-livet-issues-browser-fixtures.json", "utf8"));
for (const id of [ids.offering, learner.person]) assert.match(id, /^[0-9a-f-]{36}$/);
assert.ok(sql(`select name from public.life_offerings where id='${ids.offering}';`).startsWith("[검증용]"));
assert.equal(sql(`select count(*) from public.life_catalog where id='${ids.offering}';`), "1");
const client = () => createClient(config.API_URL, config.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const db = client(), anon = client();
assert.ifError((await db.auth.signInWithPassword({ email: learner.email, password })).error);
const draft = randomUUID(), guide = `db-course-test-${randomUUID()}`, documents = [];
const pdf = Buffer.from("%PDF-1.7\n% synthetic database course fixture\n%%EOF\n");
const payload = { k: "APPLICATION", f: ids.offering, request_key: randomUUID(), course_name: "위조된 과정명", applicant_name: "[검증용] 합성 회원", phone: "01000001211", occurrence: null, amount: null, pdf_base64: pdf.toString("base64"), pdf_sha256: createHash("sha256").update(pdf).digest("hex") };
const submit = (overrides = {}) => db.rpc("life_submit_learner_document", { ...payload, request_key: randomUUID(), ...overrides });
const accepted = async overrides => { const result = await submit(overrides); assert.ifError(result.error); documents.push(result.data); return result.data; };
let checks = 0;
const pass = label => { checks++; console.log("PASS " + label); };
try {
  sql(`insert into public.life_offerings(id,org_id,project_year_id,course_version_id,name,mode,location,capacity,tuition,selection_method,status,apply_from,apply_until,starts_on,ends_on,enrollment_policy_id)
    select '${draft}',org_id,project_year_id,course_version_id,'[검증용] DB 원서 준비 기수',mode,location,capacity,tuition,selection_method,'DRAFT',apply_from,apply_until,starts_on,ends_on,enrollment_policy_id
    from public.life_offerings where id='${ids.offering}';`);
  assert.ok((await anon.rpc("life_submit_learner_document", payload)).error);
  pass("비로그인 제출 차단");
  const before = sql(`select count(*) from public.life_learner_document_requests where person_id='${learner.person}';`);
  for (const f of [null, randomUUID(), draft]) {
    const result = await submit({ f });
    if (result.data) documents.push(result.data);
    assert.equal(result.error?.message, "COURSE_NOT_FOUND");
  }
  assert.equal(sql(`select count(*) from public.life_learner_document_requests where person_id='${learner.person}';`), before);
  pass("ID 누락·없는 기수·비공개 기수는 문서 생성 없이 거부");
  const key = randomUUID(), registered = await accepted({ request_key: key });
  assert.equal(sql(`select offering_id from public.life_learner_document_requests where id='${registered}';`), ids.offering);
  assert.equal(sql(`select course_name from public.life_learner_document_requests where id='${registered}';`), sql(`select name from public.life_offerings where id='${ids.offering}';`));
  pass("등록된 개설 기수 접수와 DB 과정명 저장");
  assert.equal((await submit({ request_key: key })).data, registered);
  assert.equal((await submit({ request_key: key, f: null })).data, registered);
  assert.equal((await submit({ request_key: key, f: draft })).error?.message, "IDEMPOTENCY_CONFLICT");
  pass("재시도는 원래 기수를 유지하고 다른 기수로 변경하면 거부");
  sql(`insert into public.life_course_guides(id,year,sort_order,name,academy,summary,curriculum,mode,capacity,teaching_hours,period_label,time_label,location,offering_id,published,org_id)
    select '${guide}',2026,(select coalesce(max(sort_order),0)+1 from public.life_course_guides where year=2026),name,'검증','합성 자료',array['검증'],mode,capacity,10,'검증용 기간','검증용 시간',location,id,true,org_id
    from public.life_offerings where id='${draft}';`);
  assert.equal(sql(`select count(*) from public.life_course_introductions('${draft}');`), "0");
  const prepared = await accepted({ f: draft });
  assert.equal(sql(`select offering_id from public.life_learner_document_requests where id='${prepared}';`), draft);
  pass("공개 안내에 연결된 DB 준비 기수 원서 허용");
  const legacyKey = randomUUID(), legacy = await accepted({ request_key: legacyKey });
  sql(`update public.life_learner_document_requests set offering_id=null,course_name='[검증용] 과거 미연결 원서' where id='${legacy}';`);
  assert.equal((await submit({ request_key: legacyKey, f: null })).data, legacy);
  assert.equal(sql(`select offering_id is null from public.life_learner_document_requests where id='${legacy}';`), "t");
  assert.equal(sql(`select pdf_sha256 from life_private.learner_document_files where request_id='${legacy}';`), payload.pdf_sha256);
  pass("과거 미연결 원서 재시도는 기록과 PDF를 보존");
  assert.equal(sql("select has_function_privilege('authenticated','life_private.submit_learner_document_base(text,uuid,uuid,text,text,text,text,integer,text,text)','EXECUTE');"), "f");
  pass("내부 제출 함수 직접 실행 권한 없음");
  console.log(`${checks} real database course boundary checks passed.`);
} finally {
  if (documents.length) sql(`delete from public.life_learner_document_requests where id in (${documents.map(id => `'${id}'`).join(",")}) and person_id='${learner.person}';`);
  sql(`delete from public.life_course_guides where id='${guide}'; delete from public.life_offerings where id='${draft}';`);
  await db.auth.signOut();
}
