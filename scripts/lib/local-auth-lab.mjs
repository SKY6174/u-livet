import { randomBytes, createHmac } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import http from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { AUTH_POLICY } from './self-hosted-preflight.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const LABEL = 'uc-life.auth-candidate-run';
const IMAGES = {
  db: 'postgres:17-alpine', auth: 'public.ecr.aws/supabase/gotrue:v2.196.0',
  rest: 'public.ecr.aws/supabase/postgrest:v16.1', mail: 'public.ecr.aws/supabase/mailpit:v1.30.2',
  proxy: 'ghcr.io/supabase/kong:2.8.1',
};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const requireValue = (condition, code) => { if (!condition) throw new Error(code); };

export async function createLocalAuthLab() {
  const runId = randomBytes(10).toString('hex');
  const name = `uc-life-auth-lab-${runId}`;
  const cliEnv = { PATH: process.env.PATH, HOME: process.env.HOME };
  const exec = (args, input) => spawnSync('docker', args, {
    cwd: ROOT, env: cliEnv, input, encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024,
  });
  const context = exec(['context', 'show']);
  requireValue(context.status === 0, 'DOCKER_CONTEXT');
  const endpoint = exec(['context', 'inspect', context.stdout.trim(), '--format', '{{.Endpoints.docker.Host}}']);
  requireValue(endpoint.status === 0 && endpoint.stdout.trim().startsWith('unix:///'), 'LOCAL_DOCKER_REQUIRED');
  const socketPath = endpoint.stdout.trim().slice(7);
  const containers = [];
  let networkId;
  let ingressId;
  let proxyUrl;
  let cleanupPromise;
  const report = { checkedAt: new Date().toISOString(), authVersion: 'v2.196.0', images: {}, migrations: [], isolated: false, cleaned: false };
  function api(method, path, body) {
    return new Promise((resolve, reject) => {
      const data = body === undefined ? undefined : JSON.stringify(body);
      const req = http.request({ socketPath, path, method, headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {} }, res => {
        const chunks = []; let size = 0;
        res.on('data', chunk => { size += chunk.length; if (size > 8 * 1024 * 1024) req.destroy(); else chunks.push(chunk); });
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`DOCKER_API_${res.statusCode}`));
          try { const text = Buffer.concat(chunks).toString(); resolve(text ? JSON.parse(text) : null); }
          catch { reject(new Error('DOCKER_RESPONSE')); }
        });
      });
      req.on('error', () => reject(new Error('DOCKER_IO')));
      req.setTimeout(15000, () => req.destroy());
      req.end(data);
    });
  }
  const before = await api('GET', '/containers/json?all=1');
  for (const [role, image] of Object.entries(IMAGES)) {
    const info = await api('GET', `/images/${encodeURIComponent(image)}/json`);
    report.images[role] = { tag: image, imageId: info.Id };
  }
  async function cleanup() {
    if (cleanupPromise) return cleanupPromise;
    cleanupPromise = (async () => {
      let failed = false;
      for (const id of [...containers].reverse()) {
        try {
          const info = await api('GET', `/containers/${id}/json`);
          requireValue(info.Config.Labels?.[LABEL] === runId, 'CLEANUP_OWNER');
          await api('DELETE', `/containers/${id}?force=1&v=1`);
        } catch { failed = true; }
      }
      for (const id of [networkId, ingressId].filter(Boolean)) {
        try {
          const info = await api('GET', `/networks/${id}`);
          requireValue(info.Labels?.[LABEL] === runId, 'CLEANUP_NETWORK_OWNER');
          await api('DELETE', `/networks/${id}`);
        } catch { failed = true; }
      }
      const after = await api('GET', '/containers/json?all=1');
      report.existingContainersPreserved = before.every(old => after.some(current => current.Id === old.Id && current.State === old.State));
      report.cleaned = !failed && containers.every(id => !after.some(c => c.Id === id));
      requireValue(report.cleaned && report.existingContainersPreserved, 'CLEANUP_VERIFY');
    })();
    return cleanupPromise;
  }
  const interrupted = () => { void cleanup().then(() => process.exit(130), () => process.exit(1)); };
  process.once('SIGINT', interrupted); process.once('SIGTERM', interrupted);
  async function create(role, env, port) {
    const isProxy = role === 'proxy';
    const network = isProxy ? `${name}-ingress` : name;
    const publishedPort = isProxy ? 8000 : null;
    const info = await api('POST', `/containers/create?name=${name}-${role}`, {
      Image: report.images[role].imageId, Labels: { [LABEL]: runId },
      Env: Object.entries(env).map(([key, value]) => `${key}=${value}`),
      ...(isProxy ? { Entrypoint: ['/bin/sh', '-c', 'mkdir -p /tmp/lab/logs; printf \'%s\' "$LAB_NGINX_CONF" > /tmp/lab.conf; exec /usr/local/openresty/nginx/sbin/nginx -p /tmp/lab/ -c /tmp/lab.conf -g \'daemon off;\''], Cmd: [] } : {}),
      ...(publishedPort ? { ExposedPorts: { [`${publishedPort}/tcp`]: {} } } : {}),
      HostConfig: {
        NetworkMode: network, Memory: role === 'db' ? 1024 ** 3 : 256 * 1024 ** 2,
        RestartPolicy: { Name: 'no' },
        ...(role === 'db' ? { Tmpfs: { '/var/lib/postgresql/data': 'rw,nosuid,size=512m' } } : {}),
        ...(publishedPort ? { PortBindings: { [`${publishedPort}/tcp`]: [{ HostIp: '127.0.0.1', HostPort: '' }] } } : {}),
      },
      NetworkingConfig: { EndpointsConfig: { [network]: { Aliases: [role] } } },
    });
    containers.push(info.Id);
    // Bind on the ingress network first: Docker Desktop can otherwise omit the host binding.
    await api('POST', `/containers/${info.Id}/start`);
    if (isProxy) await api('POST', `/networks/${networkId}/connect`, { Container: info.Id, EndpointConfig: { Aliases: ['proxy'] } });
    const inspected = await api('GET', `/containers/${info.Id}/json`);
    requireValue(inspected.Config.Labels[LABEL] === runId && inspected.Image === report.images[role].imageId, 'CONTAINER_IDENTITY');
    requireValue(Object.keys(inspected.NetworkSettings.Networks).length === (isProxy ? 2 : 1), 'NETWORK_ISOLATION');
    if (publishedPort) {
      const bound = inspected.NetworkSettings.Ports[`${publishedPort}/tcp`];
      requireValue(bound?.length === 1 && bound[0].HostIp === '127.0.0.1' && /^\d+$/.test(bound[0].HostPort), 'LOOPBACK_ONLY');
      return { id: info.Id, url: `http://127.0.0.1:${bound[0].HostPort}` };
    }
    requireValue(Object.values(inspected.NetworkSettings.Ports ?? {}).every(value => value === null), 'BACKEND_PORT_PUBLISHED');
    return { id: info.Id, ...(port ? { url: `${proxyUrl}/${role}` } : {}) };
  }
  async function ready(check, code) {
    for (let attempt = 0; attempt < 45; attempt++) {
      try { if (await check()) return; } catch { /* bounded startup retry */ }
      await delay(500);
    }
    throw new Error(code);
  }
  const fetchLocal = (url, options = {}) => {
    requireValue(new URL(url).hostname === '127.0.0.1' && new URL(url).protocol === 'http:', 'LOCAL_HTTP_REQUIRED');
    return fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(5000) });
  };
  try {
    networkId = (await api('POST', '/networks/create', { Name: name, Internal: true, Labels: { [LABEL]: runId } })).Id;
    requireValue((await api('GET', `/networks/${networkId}`)).Internal === true, 'INTERNAL_NETWORK_REQUIRED');
    ingressId = (await api('POST', '/networks/create', { Name: `${name}-ingress`, Labels: { [LABEL]: runId } })).Id;
    const routes = Object.entries({ auth: 9999, rest: 3000, mail: 8025 }).map(([role, port]) =>
      `location /${role}/ { set $upstream http://${role}:${port}; rewrite ^/${role}/(.*)$ /$1 break; proxy_pass $upstream; }`).join('\n');
    proxyUrl = (await create('proxy', { LAB_NGINX_CONF: `pid /tmp/nginx.pid; error_log /dev/stderr error;
      events {} http { access_log off; resolver 127.0.0.11 valid=1s; proxy_read_timeout 5s;
      server { listen 8000; location = /health { return 200 'ok'; } ${routes} location / { return 404; } } }` }, 8000)).url;
    await ready(async () => (await fetchLocal(`${proxyUrl}/health`)).ok, 'PROXY_START');
    const dbPassword = randomBytes(32).toString('hex');
    const authPassword = randomBytes(32).toString('hex');
    const restPassword = randomBytes(32).toString('hex');
    const jwtSecret = randomBytes(48).toString('hex');
    const db = await create('db', { POSTGRES_PASSWORD: dbPassword, POSTGRES_DB: 'candidate' });
    await ready(() => exec(['--host', `unix://${socketPath}`, 'exec', db.id, 'pg_isready', '-U', 'postgres', '-d', 'candidate']).status === 0, 'DATABASE_START');
    function sql(text) {
      // Only the container created by this invocation; never a caller-supplied ID or database.
      const out = exec(['--host', `unix://${socketPath}`, 'exec', '-i', db.id, 'psql', '-X', '-qAt', '-U', 'postgres', '-d', 'candidate',
        '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=sqlstate', '-f', '-'], text);
      if (out.status !== 0) throw new Error(`LAB_SQL_${out.stderr?.match(/ERROR:\s+([0-9A-Z]{5})/)?.[1] ?? 'FAILED'}`);
      return out.stdout.trim();
    }
    sql(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
      create role authenticator login noinherit password '${restPassword}'; grant anon,authenticated,service_role to authenticator;
      create role supabase_auth_admin login createrole password '${authPassword}';
      create schema auth authorization supabase_auth_admin;
      alter role supabase_auth_admin set search_path = auth;
      grant all on database candidate to supabase_auth_admin; grant usage on schema public to anon,authenticated,service_role;
      create schema extensions; create extension pgcrypto with schema extensions;`);
    const mail = await create('mail', { MP_DATABASE: '/tmp/mailpit.db' }, 8025);
    await ready(async () => (await fetchLocal(`${mail.url}/api/v1/messages`)).ok, 'MAIL_START');
    const authEnv = { ...AUTH_POLICY,
      GOTRUE_API_HOST: '0.0.0.0', GOTRUE_API_PORT: '9999', API_EXTERNAL_URL: 'http://auth:9999',
      GOTRUE_DB_DRIVER: 'postgres', GOTRUE_DB_DATABASE_URL: `postgres://supabase_auth_admin:${authPassword}@db:5432/candidate?sslmode=disable`,
      GOTRUE_SITE_URL: 'http://127.0.0.1:3100', GOTRUE_URI_ALLOW_LIST: 'http://127.0.0.1:3100/auth/reset-password',
      GOTRUE_JWT_SECRET: jwtSecret, GOTRUE_JWT_EXP: '3600', GOTRUE_JWT_AUD: 'authenticated',
      GOTRUE_JWT_ADMIN_ROLES: 'service_role', GOTRUE_JWT_DEFAULT_GROUP_NAME: 'authenticated', GOTRUE_JWT_ISSUER: 'http://auth:9999',
      GOTRUE_DISABLE_SIGNUP: 'false', GOTRUE_SMTP_HOST: 'mail', GOTRUE_SMTP_PORT: '1025',
      GOTRUE_SMTP_ADMIN_EMAIL: 'no-reply@example.invalid', GOTRUE_SMTP_SENDER_NAME: 'LOCAL AUTH LAB',
      GOTRUE_RATE_LIMIT_EMAIL_SENT: '1000',
      // Local-only exception: no internet egress, no production CAPTCHA/SMTP claim.
      GOTRUE_SECURITY_CAPTCHA_ENABLED: 'false', GOTRUE_SECURITY_CAPTCHA_SECRET: '',
    };
    const auth = await create('auth', authEnv, 9999);
    await ready(async () => (await fetchLocal(`${auth.url}/health`)).ok, 'AUTH_START');
    const actual = await api('GET', `/containers/${auth.id}/json`);
    const actualEnv = Object.fromEntries(actual.Config.Env.map(entry => { const p = entry.indexOf('='); return [entry.slice(0, p), entry.slice(p + 1)]; }));
    for (const [key, value] of Object.entries(authEnv)) requireValue(actualEnv[key] === value, 'AUTH_ENV_CHANGED');
    sql(`create or replace function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claims',true)::jsonb->>'sub','')::uuid $$;
      create or replace function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$;
      create or replace function auth.role() returns text language sql stable as $$select auth.jwt()->>'role'$$;
      grant usage on schema auth to anon,authenticated,service_role;
      grant execute on function auth.uid(),auth.jwt(),auth.role() to anon,authenticated,service_role;`);
    const folder = new URL('../../supabase/migrations/', import.meta.url);
    for (const file of (await readdir(folder)).filter(f => /^\d+_.*\.sql$/.test(f)).sort()) {
      try { sql(`begin;\n${await readFile(new URL(file, folder), 'utf8')}\ncommit;`); }
      catch (error) { throw new Error(`MIGRATION_${file.split('_')[0]}_${error.message}`); }
      report.migrations.push(file);
    }
    const rest = await create('rest', { PGRST_DB_URI: `postgres://authenticator:${restPassword}@db:5432/candidate`,
      PGRST_DB_SCHEMAS: 'public', PGRST_DB_ANON_ROLE: 'anon', PGRST_JWT_SECRET: jwtSecret, PGRST_SERVER_PORT: '3000' }, 3000);
    await ready(async () => (await fetchLocal(`${rest.url}/life_organizations?select=id`)).ok, 'REST_START');
    const jwt = role => {
      const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const body = Buffer.from(JSON.stringify({ role, iss: 'supabase', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
      return `${head}.${body}.${createHmac('sha256', jwtSecret).update(`${head}.${body}`).digest('base64url')}`;
    };
    report.isolated = true;
    return { authUrl: auth.url, restUrl: rest.url, mailUrl: mail.url, adminKey: jwt('service_role'), sql, fetchLocal, report,
      close: async () => { await cleanup(); process.removeListener('SIGINT', interrupted); process.removeListener('SIGTERM', interrupted); } };
  } catch (error) {
    await cleanup(); process.removeListener('SIGINT', interrupted); process.removeListener('SIGTERM', interrupted); throw error;
  }
}
