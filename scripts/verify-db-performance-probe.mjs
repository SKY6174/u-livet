import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { isExpectedLoginRedirect } from './lib/db-performance.mjs';

const site = 'https://uc-life.example/';
assert.equal(isExpectedLoginRedirect('/', site, 307, '/auth/login'), true);
assert.equal(isExpectedLoginRedirect('/', site, 308, site + 'auth/login?next=%2F'), true);
for (const [label, status, location] of [
  ['/', 307, 'https://other.example/auth/login'], ['/', 307, '//other.example/auth/login'],
  ['/', 307, '/auth/login/other'], ['/', 307, '/protection'], ['/', 307, null],
  ['/', 200, '/auth/login'], ['/api/health', 307, '/auth/login'], ['/courses', 307, '/auth/login'],
]) assert.equal(isExpectedLoginRedirect(label, site, status, location), false);

let scenario = 'normal';
const server = createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(307, { Location: scenario === 'external' ? 'https://other.example/auth/login' : '/auth/login' });
    return res.end();
  }
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/api/health') {
    if (scenario === 'unhealthy') return res.end('{"status":"unavailable"}');
    if (scenario === 'malformed') return res.end('not json');
    return res.end('{"status":"healthy"}');
  }
  res.end('{}');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  for (scenario of ['normal', 'external', 'unhealthy', 'malformed']) {
    const result = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['scripts/check-db-performance.mjs', `http://127.0.0.1:${server.address().port}`], {
        env: { ...process.env, DB_PERF_SAMPLES: '3', NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_ANON_KEY: '', DB_PERF_COOKIE: '' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let output = ''; child.stdout.on('data', data => { output += data; });
      child.on('error', reject); child.on('close', code => resolve({ code, output }));
    });
    assert.equal(result.code, scenario === 'normal' ? 0 : 1, scenario);
    const home = result.output.trim().split('\n').map(line => JSON.parse(line)).find(x => x.target === '/');
    assert.equal(home.warm_successes, scenario === 'external' ? 0 : 2);
    console.log(`PASS ${scenario} probe exit status and successful-sample count`);
  }
} finally { await new Promise(resolve => server.close(resolve)); }
console.log('10 redirect checks and 4 full probe checks passed.');
