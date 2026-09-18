import { lstat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

try {
  if (process.env.VERCEL !== '1' || !['preview', 'production'].includes(process.env.VERCEL_ENV)) throw new Error('VERCEL_TARGET');
  for (const file of ['.env', '.env.local', '.env.production', '.env.production.local']) {
    try { await lstat(resolve(file)); } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    throw new Error('LOCAL_ENV_PRESENT');
  }
  const check = spawnSync(process.execPath, [fileURLToPath(new URL('./check-release-readiness.mjs', import.meta.url)), '--config-only'], { stdio: 'inherit' });
  if (check.error || check.status !== 0) throw new Error('CONFIG_BLOCKED');
  const build = spawnSync(process.execPath, [resolve('node_modules/next/dist/bin/next'), 'build'], { stdio: 'inherit' });
  process.exitCode = build.error ? 1 : build.status ?? 1;
} catch {
  console.error('BUILD_BLOCKED: Vercel 대상·환경 설정·로컬 환경파일 포함 여부를 확인하세요. 운영 가이드 참조.');
  process.exitCode = 1;
}
