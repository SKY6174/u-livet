// Local integration/equivalence benchmark. All DDL and fixtures are rolled back.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const prerequisites = [
  '20261008131827_course_catalog_organization.sql',
  '20261017062713_admin_operational_records.sql',
];
const transactionBody = name => readFileSync(`supabase/migrations/${name}`, 'utf8')
  .replace(/^begin;\s*/i, '').replace(/commit;\s*$/i, '');
const migration = transactionBody('20261017092356_optimize_management_read_scope.sql');
const fixture = readFileSync('scripts/verify-management-read-scope.sql', 'utf8');
const sql = `begin;\n${prerequisites.map(transactionBody).join('\n')}\n${fixture.replace('-- APPLY_OPTIMIZATION_HERE', migration)}`;
const result = spawnSync('docker', [
  'exec', '-i', 'supabase_db_uc-life-issues', 'psql', '-U', 'postgres', '-d',
  'postgres', '-v', 'ON_ERROR_STOP=1', '-At',
], { input: sql, encoding: 'utf8', timeout: 240000, maxBuffer: 2 * 1024 * 1024 });
if (result.status !== 0) {
  process.stderr.write(result.stderr);
  throw Error('LOCAL_MANAGEMENT_READ_SCOPE_FAILED');
}
assert.match(result.stdout, /ROLLBACK/);
const passes = [...result.stderr.matchAll(/PASS (.+)/g)].map(match => match[1]);
assert.equal(passes.length, 11);
const pairs = [...result.stderr.matchAll(/PAIR (applications|learners) (\d+) old_ms ([\d.]+) new_ms ([\d.]+)/g)]
  .map(([, kind, pair, oldMs, newMs]) => ({ kind, pair: Number(pair), oldMs: Number(oldMs), newMs: Number(newMs) }));
assert.equal(pairs.length, 16);
const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const measurements = ['applications', 'learners'].map(kind => {
  const warm = pairs.filter(pair => pair.kind === kind && pair.pair > 1);
  return { kind, warmPairs: warm.length,
    oldMedianMs: median(warm.map(pair => pair.oldMs)),
    newMedianMs: median(warm.map(pair => pair.newMs)) };
});
console.log(JSON.stringify({ passes, pairs, measurements, rollback: true }, null, 2));
