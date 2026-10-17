// Dedicated local database only; fixture/auth/DDL changes are always rolled back.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const body = path => readFileSync(path, 'utf8').replace(/^begin;\s*/im, '').replace(/(?:commit|rollback);\s*$/i, '');
const prerequisites = [
  '20261008131827_course_catalog_organization.sql',
  '20261017062713_admin_operational_records.sql',
  '20261017065240_operational_account_directory.sql',
  '20261017084245_operational_finance_records.sql',
  '20261017085926_operational_academic_records.sql',
  '20261017090601_preserve_operational_academic_history.sql',
].map(name => body(`supabase/migrations/${name}`)).join('\n');
const clone = `do $$declare name text;begin
 foreach name in array array['instructor_home_summary','completion_history'] loop
  execute replace(pg_get_functiondef(format('life_private.%I()',name)::regprocedure),
   'CREATE OR REPLACE FUNCTION life_private.'||name,'CREATE OR REPLACE FUNCTION pg_temp.before_'||name);
 end loop;
end$$;`;
const fixture = body('scripts/verify-operational-academic.sql').replace(
  'create temp table academic_preserved',
  () => `${clone}\n${body('supabase/migrations/20261017105436_optimize_learner_instructor_reads.sql')}\ncreate temp table academic_preserved`,
);
const result = spawnSync('docker', ['exec', '-i', 'supabase_db_uc-life-issues',
  'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], {
  input: `begin;\nset local statement_timeout='30s';\n${prerequisites}\n${fixture}\n${readFileSync('scripts/verify-learner-instructor-loading.sql','utf8')}`,
  encoding: 'utf8', timeout: 240000, maxBuffer: 4 * 1024 * 1024,
});
if (result.status !== 0) {
  process.stderr.write(result.stderr);
  throw Error('LOCAL_LEARNER_INSTRUCTOR_VERIFICATION_FAILED');
}
assert.match(result.stdout, /ROLLBACK/);
const passes = [...result.stderr.matchAll(/PASS (.+)/g)].map(match => match[1]);
assert.equal(passes.length, 17);
const pairs = [...result.stderr.matchAll(/PAIR (summary|history) (\d+) old_ms ([\d.]+) new_ms ([\d.]+)/g)]
  .map(([, kind, pair, oldMs, newMs]) => ({ kind, pair: +pair, oldMs: +oldMs, newMs: +newMs }));
assert.equal(pairs.length, 16);
const median = values => [...values].sort((a,b) => a-b)[Math.floor(values.length/2)];
const measurements = ['summary','history'].map(kind => {
  const warm = pairs.filter(x => x.kind===kind && x.pair>1);
  return { kind, warmPairs: warm.length, oldMedianMs: median(warm.map(x => x.oldMs)), newMedianMs: median(warm.map(x => x.newMs)) };
});
const plans = Object.fromEntries([...result.stderr.matchAll(/PLAN (old|new) (.+)/g)].map(([, key, value]) => [key,JSON.parse(value)]));
assert.equal(Object.keys(plans).length, 2);
console.log(JSON.stringify({ passes, measurements, pairs, plans, rollback: true },null,2));
