import { readFile, stat } from 'node:fs/promises';
import { parseEnv, parseArgs } from 'node:util';
import { inspectEnvironment, inspectRecord, readinessResult, releaseSnapshot } from './lib/release-readiness.mjs';
import { inspectSelfHostedBinding } from './lib/self-hosted-preflight.mjs';

const HELP = `배포 준비 검사 (Node 22+, 네트워크 호출 없음)
  node -- scripts/check-release-readiness.mjs --target preview|production [--env-file PATH] [--record PATH] [--format text|json]
  --config-only  환경 설정만 검사. CONFIG_VALID는 배포 승인이 아닙니다.
  --snapshot     현재 소스/migration 지문만 출력 (단독 사용)
  --env-file     이 파일의 값만 검사; 상속 환경과 합치지 않습니다.
  --self-hosted-config PATH  자체 운영 전체 검사에 필요한 비밀 없는 runtime 설정 증거
  기본: process.env만 검사. .env.local 자동 로드/수정 없음.
  기록 기본값: ops/release.example.json (모든 항목 pending)
  종료값: 성공 0, BLOCKED/입력 오류 1`;

async function readBounded(path) {
  if (!(await stat(path)).isFile() || (await stat(path)).size > 131072) throw new Error('INPUT_FILE');
  const content = await readFile(path, 'utf8');
  if (Buffer.byteLength(content) > 131072) throw new Error('INPUT_SIZE');
  return content;
}

let json = false;
try {
  const { values } = parseArgs({ options: {
    target: { type: 'string' }, 'env-file': { type: 'string' }, record: { type: 'string' },
    format: { type: 'string' }, 'config-only': { type: 'boolean' }, snapshot: { type: 'boolean' }, help: { type: 'boolean' },
    'self-hosted-config': { type: 'string' },
  } });
  json = values.format === 'json';
  if (values.format && !['text', 'json'].includes(values.format)) throw new Error('FORMAT');
  if (values.help) {
    process.stdout.write(`${HELP}\n`);
  } else if (values.snapshot) {
    if (Object.keys(values).length !== 1) throw new Error('SNAPSHOT_FLAGS');
    process.stdout.write(`${JSON.stringify(await releaseSnapshot(process.cwd()), null, 2)}\n`);
  } else {
    const env = values['env-file'] ? parseEnv(await readBounded(values['env-file'])) : process.env;
    const target = values.target ?? env.VERCEL_ENV;
    const checks = inspectEnvironment(env, target);
    if (values['self-hosted-config'] && (env.SUPABASE_DEPLOYMENT_KIND !== 'self-hosted' || values['config-only'])) throw new Error('CONFIG_FLAGS');
    if (!values['config-only']) {
      const selfHosted = env.SUPABASE_DEPLOYMENT_KIND === 'self-hosted';
      if (selfHosted) {
        if (!values['self-hosted-config']) throw new Error('CONFIG_REQUIRED');
        checks.push(...inspectSelfHostedBinding(JSON.parse(await readBounded(values['self-hosted-config'])), env, target));
      }
      const record = JSON.parse(await readBounded(values.record ?? (selfHosted ? 'ops/self-hosted/release.example.json' : 'ops/release.example.json')));
      checks.push(...inspectRecord(record, env, target, await releaseSnapshot(process.cwd())));
    }
    const result = readinessResult(checks, !!values['config-only']);
    process.stdout.write(json ? `${JSON.stringify(result, null, 2)}\n` :
      `${result.status} (${result.blocked}개 미충족)\n${result.notice}\n${checks.map(c => `[${c.status}] ${c.id}: ${c.message}`).join('\n')}\n`);
    process.exitCode = result.blocked ? 1 : 0;
  }
} catch {
  // Never print input paths, values, parse error details, or arbitrary user-supplied fields.
  const result = { status: 'BLOCKED', error: '입력 인자·파일 형식·필수 소스 또는 symlink를 확인하세요. --help 참조.' };
  process.stdout.write(json ? `${JSON.stringify(result)}\n` : `${result.status}: ${result.error}\n`);
  process.exitCode = 1;
}
