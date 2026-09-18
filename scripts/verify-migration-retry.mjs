import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Disposable local database test. Never loads env files or accepts a remote target.
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const CONTAINER = 'supabase_db_uc-life-core';
const BASELINE_COMMIT = '1a4bf135113778ff701a31b4ad7fbac6e60dadd6';
const FILES = [
  '009_fix_rls_recursion_and_optimize_performance.sql',
  '010_role_based_db_separation_and_optimization.sql',
];
const dbName = `uc_life_retry_${randomBytes(10).toString('hex')}`;
const env = { ...process.env };
for (const key of ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']) delete env[key];
let checks = 0;
let created = false;

function run(command, args, input) {
  return spawnSync(command, args, { cwd: ROOT, env, input, encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
}
function requireSuccess(result, label) {
  if (result.error || result.status !== 0) throw new Error(`${label}: ${result.error?.message ?? result.stderr}`);
  return result.stdout.trim();
}
const context = requireSuccess(run('docker', ['context', 'show']), 'Docker context');
const endpoint = requireSuccess(run('docker', ['context', 'inspect', context, '--format', '{{.Endpoints.docker.Host}}']), 'Docker endpoint');
assert.ok(endpoint.startsWith('unix:///'), 'Only a local Unix Docker socket is supported');
function docker(args, input) {
  return run('docker', ['--host', endpoint, ...args], input);
}
function query(sql, database = dbName) {
  return docker(['exec', '-i', CONTAINER, 'psql', '-X', '-qAt', '-U', 'postgres', '-d', database,
    '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-f', '-'], sql);
}
function apply(sql) {
  return query(`BEGIN;\n${sql}\nCOMMIT;`);
}
function sql(sqlText, database = dbName) {
  return requireSuccess(query(sqlText, database), 'SQL');
}
function pass(label, verify) {
  verify();
  checks += 1;
  console.log(`PASS ${label}`);
}
function quoted(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}
const originals = FILES.map(name => requireSuccess(run('git', ['show', `${BASELINE_COMMIT}:supabase/migrations/${name}`]), name));
const patched = FILES.map(name => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8'));
const policyPattern = /CREATE POLICY "([^"]+)"\s+ON public\.(\w+)/g;
const policies = patched.flatMap(text => [...text.matchAll(policyPattern)].map(match => ({ name: match[1], table: match[2] })));
const baseSql = readdirSync(new URL('../supabase/migrations/', import.meta.url))
  .filter(name => /^00[1-8]_.*\.sql$/.test(name)).sort()
  .map(name => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')).join('\n');

function setup() {
  assert.match(dbName, /^uc_life_retry_[a-f0-9]{20}$/);
  requireSuccess(query(`CREATE DATABASE ${quoted(dbName)} TEMPLATE template0;`, 'postgres'), 'Create disposable database');
  created = true;
  requireSuccess(apply(`
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    ${baseSql}
    INSERT INTO auth.users (id,email,raw_user_meta_data) VALUES
      ('00000000-0000-4000-8000-000000000001','retry-learner@example.invalid','{"name":"검증 학습자"}'),
      ('00000000-0000-4000-8000-000000000002','retry-instructor@example.invalid','{"name":"검증 강사","role":"INSTRUCTOR"}');
    INSERT INTO public.instructor_profiles(id,specialty) VALUES ('00000000-0000-4000-8000-000000000002','검증');
    INSERT INTO public.courses(id,title,category,apply_start_at,apply_end_at,course_start_at,course_end_at)
      VALUES ('00000000-0000-4000-8000-000000000003','검증 강좌','검증','2026-09-01','2026-09-10','2026-09-11','2026-09-12');
    INSERT INTO public.course_enrollments(course_id,user_id) VALUES
      ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001');
  `), 'Base migrations and synthetic fixtures');
}
function cleanup() {
  if (!created) return;
  requireSuccess(query(`DROP DATABASE ${quoted(dbName)};`, 'postgres'), 'Remove disposable database');
  created = false;
}
function schemaSnapshot() {
  const queries = {
    policies: "SELECT tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public'",
    indexes: "SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public'",
    functions: "SELECT p.proname,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f'",
    views: "SELECT viewname,definition FROM pg_views WHERE schemaname='public'",
    columns: "SELECT table_name,column_name,ordinal_position,column_default,is_nullable,data_type,udt_name FROM information_schema.columns WHERE table_schema='public'",
    grants: "SELECT table_name,grantor,grantee,privilege_type,is_grantable FROM information_schema.role_table_grants WHERE table_schema='public'",
    rls: "SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'",
  };
  return Object.fromEntries(Object.entries(queries).map(([key, queryText]) => [key,
    sql(`SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]') FROM (${queryText}) r;`)]));
}
function dataSnapshot() {
  const tables = JSON.parse(sql("SELECT json_agg(tablename ORDER BY tablename) FROM pg_tables WHERE schemaname='public';"));
  return Object.fromEntries(tables.map(table => [table, sql(`SELECT count(*)||':'||md5(coalesce(string_agg(to_jsonb(r)::text, '' ORDER BY to_jsonb(r)::text),'')) FROM public.${quoted(table)} r;`)]));
}
try {
  pass('changes add only missing exact-name DROP POLICY statements', () => {
    let guards = 0;
    originals.forEach((original, index) => {
      const expected = original.replace(policyPattern, (match, name, table, offset) => {
        const drop = `DROP POLICY IF EXISTS "${name}" ON public.${table};`;
        if (original.slice(0, offset).includes(drop)) return match;
        guards += 1;
        return `${drop}\n${match}`;
      });
      assert.equal(patched[index].trim(), expected.trim());
    });
    assert.equal(guards, 15);
    assert.equal(policies.length, 24);
  });
  setup();
  const originalData = dataSnapshot();
  pass('original 009 and 010 apply once', () => originals.forEach(text => requireSuccess(apply(text), 'Original migration')));
  const originalSchema = schemaSnapshot();
  originals.forEach((text, index) => pass(`original ${FILES[index].slice(0, 3)} retry reproduces SQLSTATE 42710`, () => {
    const result = apply(text);
    assert.equal(result.status, 3);
    assert.match(result.stderr, /42710.*policy .* already exists/);
  }));
  pass('failed retries roll back without changing schema or rows', () => {
    assert.deepEqual(schemaSnapshot(), originalSchema);
    assert.deepEqual(dataSnapshot(), originalData);
  });
  pass('patched retry preserves all catalog definitions and rows', () => {
    patched.forEach(text => requireSuccess(apply(text), 'Patched retry'));
    assert.deepEqual(schemaSnapshot(), originalSchema);
    assert.deepEqual(dataSnapshot(), originalData);
  });
  pass('partial and changed policies converge while unrelated policy survives', () => {
    policies.filter((_, index) => index % 2 === 0).forEach(({ name, table }) => sql(`DROP POLICY ${quoted(name)} ON public.${quoted(table)};`));
    const { name, table } = policies[1];
    sql(`ALTER POLICY ${quoted(name)} ON public.${quoted(table)} USING (false);`);
    sql('CREATE POLICY retry_unrelated ON public.user_profiles AS RESTRICTIVE FOR SELECT USING (false);');
    patched.forEach(text => requireSuccess(apply(text), 'Partial-state retry'));
    assert.equal(sql("SELECT count(*) FROM pg_policies WHERE schemaname='public' AND policyname='retry_unrelated' AND permissive='RESTRICTIVE' AND qual='false';"), '1');
    sql('DROP POLICY retry_unrelated ON public.user_profiles;');
    assert.deepEqual(schemaSnapshot(), originalSchema);
    assert.deepEqual(dataSnapshot(), originalData);
  });
  cleanup();
  setup();
  const freshData = dataSnapshot();
  pass('patched first apply on 001–008 equals original first apply', () => {
    patched.forEach(text => requireSuccess(apply(text), 'Fresh patched migration'));
    assert.deepEqual(schemaSnapshot(), originalSchema);
    assert.deepEqual(dataSnapshot(), freshData);
  });
  pass('second patched retry on fresh database remains stable', () => {
    patched.forEach(text => requireSuccess(apply(text), 'Second patched retry'));
    assert.deepEqual(schemaSnapshot(), originalSchema);
    assert.deepEqual(dataSnapshot(), freshData);
  });
} finally {
  cleanup();
}
pass('temporary database removed', () => assert.equal(sql(`SELECT count(*) FROM pg_database WHERE datname='${dbName}';`, 'postgres'), '0'));
console.log(`${checks} migration retry checks passed. Local PostgreSQL only; hosted Auth and release approval are not covered.`);
