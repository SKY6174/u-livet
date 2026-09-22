import { readFile, stat } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { inspectHostedAuth, readLiveAuthConfig, validSiteOrigin } from './lib/hosted-auth-preflight.mjs';

try {
  const { values } = parseArgs({ options: {
    'config-file': { type: 'string' }, 'site-origin': { type: 'string' }, live: { type: 'boolean' },
    'preview-ref': { type: 'string' }, 'production-ref': { type: 'string' }, help: { type: 'boolean' },
  } });
  if (values.help) {
    console.log(`Supabase Auth 사전 설정 비교 (출력 JSON, Node 22+)
오프라인: npm run check:hosted-auth -- --config-file PATH --site-origin HTTPS_ORIGIN
명시적 조회: npm run check:hosted-auth -- --live --preview-ref REF --production-ref REF --site-origin HTTPS_ORIGIN
live는 SUPABASE_ACCESS_TOKEN을 현재 프로세스 환경에서만 읽습니다. env 파일 자동 로드 없음.
live 호출은 고정 Management API GET 한 번입니다. 설정/DB/계정 변경·메일 발송 없음.
종료 0은 설정 비교 통과이며 실제 호환성 검증은 대기 상태입니다. 종료 1은 미충족/입력 오류입니다.`);
  } else {
    if (!!values.live === !!values['config-file'] || !validSiteOrigin(values['site-origin'])) throw new Error('INPUT');
    let config;
    if (values.live) {
      config = await readLiveAuthConfig({ previewRef: values['preview-ref'], productionRef: values['production-ref'],
        siteOrigin: values['site-origin'], token: process.env.SUPABASE_ACCESS_TOKEN });
    } else {
      if (values['preview-ref'] || values['production-ref']) throw new Error('INPUT');
      const info = await stat(values['config-file']);
      if (!info.isFile() || info.size > 1024 * 1024) throw new Error('SIZE');
      const bytes = await readFile(values['config-file']);
      if (bytes.byteLength > 1024 * 1024) throw new Error('SIZE');
      config = JSON.parse(bytes.toString('utf8'));
    }
    const result = inspectHostedAuth(config, values['site-origin']);
    console.log(JSON.stringify({ mode: values.live ? 'LIVE_GET' : 'OFFLINE', ...result }, null, 2));
    process.exitCode = result.blocked ? 1 : 0;
  }
} catch {
  console.log(JSON.stringify({ status: 'CONFIG_BLOCKED', error: '입력·파일·대상·토큰 권한 또는 공급자 연결을 확인하세요. 원문은 출력하지 않습니다. --help 참조.' }));
  process.exitCode = 1;
}
