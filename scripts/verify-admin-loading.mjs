// Dedicated local DB only. Every fixture, view and function change rolls back.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const body = path => readFileSync(path, 'utf8').replace(/^begin;\s*/i, '').replace(/commit;\s*$/i, '');
const migration = body('supabase/migrations/20261017100647_optimize_admin_parking_workspace_reads.sql');
const prerequisites = [
  '20261008131827_course_catalog_organization.sql',
  '20261017062713_admin_operational_records.sql',
].map(name => body(`supabase/migrations/${name}`)).join('\n');
const fixture = readFileSync('scripts/verify-admin-loading.sql', 'utf8');
const result = spawnSync('docker', ['exec', '-i', 'supabase_db_uc-life-issues',
  'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], {
  input: `begin;\n${prerequisites}\n${fixture.replace('-- APPLY_OPTIMIZATION_HERE', migration)}`,
  encoding: 'utf8', timeout: 240000, maxBuffer: 4 * 1024 * 1024,
});
if (result.status !== 0) {
  process.stderr.write(result.stderr);
  throw Error('LOCAL_ADMIN_LOADING_VERIFICATION_FAILED');
}
assert.match(result.stdout, /ROLLBACK/);
const passes = [...result.stderr.matchAll(/PASS (.+)/g)].map(match => match[1]);
assert.equal(passes.length, 15);
const pairs = [...result.stderr.matchAll(/PAIR (parking|catalog) (\d+) old_ms ([\d.]+) new_ms ([\d.]+)/g)]
  .map(([, kind, pair, oldMs, newMs]) => ({ kind, pair: Number(pair), oldMs: Number(oldMs), newMs: Number(newMs) }));
assert.equal(pairs.length, 16);
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const measurements = ['parking', 'catalog'].map(kind => {
  const warm = pairs.filter(pair => pair.kind === kind && pair.pair > 1);
  return { kind, warmPairs: warm.length, oldMedianMs: median(warm.map(pair => pair.oldMs)),
    newMedianMs: median(warm.map(pair => pair.newMs)) };
});
const plans = Object.fromEntries([...result.stderr.matchAll(/PLAN (old|new) (.+)/g)]
  .map(([, kind, value]) => [kind, JSON.parse(value)]));
assert.equal(Object.keys(plans).length, 2);
const hashes = result.stderr.match(/FUNCTION_HASH old (\w+) new (\w+)/);
assert(hashes);
console.log(JSON.stringify({ passes, pairs, measurements, plans,
  functionHashes: { old: hashes[1], new: hashes[2] }, rollback: true }, null, 2));
