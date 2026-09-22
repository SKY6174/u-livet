// Read-only latency probe. Never prints keys, cookies, or response bodies.
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { isExpectedLoginRedirect } from './lib/db-performance.mjs';

const env = {
  ...(existsSync('.env.local') ? parseEnv(readFileSync('.env.local', 'utf8')) : {}),
  ...process.env,
};
function origin(value) {
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((!local && url.protocol !== 'https:') || !['http:', 'https:'].includes(url.protocol)
    || url.username || url.password || url.search || url.hash || url.pathname !== '/')
    throw new Error('Expected an HTTPS origin (HTTP allowed only for localhost).');
  return url.origin;
}
const percentile = (sorted, p) => sorted[Math.ceil(sorted.length * p) - 1];
const median = sorted => (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2;

try {
  const site = origin(process.argv[2] ?? env.AUTH_SITE_ORIGIN);
  const count = Number(env.DB_PERF_SAMPLES ?? 9);
  if (process.argv.length > 3 || !Number.isInteger(count) || count < 3 || count > 30)
    throw new Error('Usage: node scripts/check-db-performance.mjs https://site.example; DB_PERF_SAMPLES must be 3–30.');
  const targets = [];
  if (env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    targets.push({
      label: 'db_catalog',
      url: `${origin(env.NEXT_PUBLIC_SUPABASE_URL)}/rest/v1/life_catalog?select=*&order=created_at.desc`,
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
    });
  }
  for (const path of ['/api/health', '/', '/courses', '/auth/login'])
    targets.push({ label: path, url: site + path, headers: env.DB_PERF_COOKIE ? { Cookie: env.DB_PERF_COOKIE } : {} });
  console.log(JSON.stringify({ checked_at: new Date().toISOString(), site, requests_per_target: count,
    db: env.NEXT_PUBLIC_SUPABASE_URL ? origin(env.NEXT_PUBLIC_SUPABASE_URL) : null }));
  for (const target of targets) {
    const samples = [];
    for (let i = 0; i < count; i++) {
      const start = performance.now();
      try {
        const response = await fetch(target.url, {
          method: 'GET', headers: target.headers, redirect: 'manual', signal: AbortSignal.timeout(20000),
        });
        const ttfb = performance.now() - start;
        const body = await response.arrayBuffer();
        const healthy = target.label !== '/api/health' ||
          (response.ok && JSON.parse(new TextDecoder().decode(body)).status === 'healthy');
        const loginRedirect = isExpectedLoginRedirect(target.label, target.url,
          response.status, response.headers.get('location'));
        const success = healthy && (response.ok || loginRedirect);
        samples.push({ status: response.status, ttfb_ms: Math.round(ttfb),
          total_ms: Math.round(performance.now() - start), bytes: body.byteLength,
          region: response.headers.get('x-vercel-id')?.split('::').slice(0, -1).join('::') ?? null,
          healthy, success, login_redirect: loginRedirect });
        if (!success) process.exitCode = 1;
      } catch {
        samples.push({ error: 'REQUEST_FAILED', total_ms: Math.round(performance.now() - start) });
        process.exitCode = 1;
      }
    }
    const warm = samples.slice(1).filter(s => s.success);
    const totals = warm.map(s => s.total_ms).sort((a, b) => a - b);
    const ttfbs = warm.map(s => s.ttfb_ms).sort((a, b) => a - b);
    console.log(JSON.stringify({ target: target.label, first: samples[0], warm_successes: warm.length,
      warm_median_ms: totals.length ? median(totals) : null,
      warm_p95_ms: totals.length ? percentile(totals, 0.95) : null,
      warm_ttfb_median_ms: ttfbs.length ? median(ttfbs) : null, samples }));
  }
} catch {
  console.error('PERFORMANCE_CHECK_FAILED: supply a valid site origin and DB_PERF_SAMPLES (3–30).');
  process.exitCode = 1;
}
