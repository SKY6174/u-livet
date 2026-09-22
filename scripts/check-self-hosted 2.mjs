import { readFile, stat } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { authComposeOverride, inspectSelfHostedConfig } from './lib/self-hosted-preflight.mjs';

const HELP = `자체 운영 Auth 설정 검사 (Node 22+, 네트워크/서버 변경 없음)
  node -- scripts/check-self-hosted.mjs --config-file PATH [--format text|json]
  --compose-template  비밀 없는 Compose override 출력 (단독 사용)
  입력: 비밀 없는 runtime 설정 JSON, 최대 128 KiB. 환경 파일 자동 로드 없음.
  성공: CONFIG_MATCH_RUNTIME_PENDING 및 configDigest. 실행 중 서버 인수 아님.
  실패: CONFIG_BLOCKED, 종료 1. 입력/경로/원문 오류는 출력하지 않습니다.`;
let json = false;
try {
  const { values } = parseArgs({ options: {
    'config-file': { type: 'string' }, format: { type: 'string' },
    'compose-template': { type: 'boolean' }, help: { type: 'boolean' },
  } });
  json = values.format === 'json';
  if (values.format && !['text', 'json'].includes(values.format)) throw new Error('FORMAT');
  if (values.help) process.stdout.write(`${HELP}\n`);
  else if (values['compose-template']) {
    if (Object.keys(values).length !== 1) throw new Error('FLAGS');
    process.stdout.write(`${JSON.stringify(authComposeOverride(), null, 2)}\n`);
  } else {
    if (!values['config-file']) throw new Error('INPUT');
    const info = await stat(values['config-file']);
    if (!info.isFile() || info.size > 131072) throw new Error('SIZE');
    const content = await readFile(values['config-file'], 'utf8');
    if (Buffer.byteLength(content) > 131072) throw new Error('SIZE');
    const result = inspectSelfHostedConfig(JSON.parse(content));
    process.stdout.write(json ? `${JSON.stringify(result, null, 2)}\n` :
      `${result.status} (${result.blocked}개 미충족)\n${result.notice}\n${result.configDigest ? `configDigest: ${result.configDigest}\n` : ''}${result.checks.map(c => `[${c.status}] ${c.id}: ${c.message}`).join('\n')}\n`);
    process.exitCode = result.blocked ? 1 : 0;
  }
} catch {
  const result = { status: 'CONFIG_BLOCKED', error: '인자·설정 파일의 형식/크기를 확인하세요. --help 참조.' };
  process.stdout.write(json ? `${JSON.stringify(result)}\n` : `${result.status}: ${result.error}\n`);
  process.exitCode = 1;
}
