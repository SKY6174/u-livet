// Local-only interactive fixture: real React components, synthetic MFA responses.
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const webpack = require('next/dist/compiled/webpack/webpack');
webpack.init();
const dir = mkdtempSync(join(tmpdir(), 'uc-life-mfa-fixture-'));
const write = (name, text) => { const path = join(dir, name); writeFileSync(path, text); return path; };
function component(name) {
  return write(name + '.js', ts.transpileModule(readFileSync('src/components/auth/' + name + '.tsx', 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText);
}
const panel = component('mfa-panel');
const input = component('mfa-code-input');
const actions = write('actions.js', `
let attempts = 0;
export async function verifyMfa() {
  const code = arguments[1];
  document.getElementById('attempts').textContent = '검증 요청: ' + (++attempts);
  await new Promise(resolve => setTimeout(resolve, 250));
  return code === '012345' ? {ok:true,message:'합성 인증 성공'} : {message:'합성 코드 오류. 다시 입력해 주세요.'};
}
export async function enrollMfa() { return {enrollment:{id:'new-factor',qr:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',secret:'SYNTHETIC'},message:'합성 등록'}; }
export async function removeMfa() { return {ok:true,message:'합성 해제'}; }
`);
const navigation = write('navigation.js', `export function useRouter(){return {
replace(){window.location.assign('/verified');},refresh(){document.getElementById('navigation').textContent='관리 화면 갱신';}
};}`);
const passthrough = write('passthrough.js', 'export default "a"; export const MfaManagement = () => null;');
const entry = write('entry.js', `
import React from 'react'; import {createRoot} from 'react-dom/client'; import {MfaPanel} from ${JSON.stringify(panel)};
const mode = new URLSearchParams(window.location.search).get('mode');
createRoot(document.getElementById('app')).render(React.createElement(React.StrictMode,null,React.createElement(MfaPanel,{
status:{active:true,needs_reset:false,staff_required:true,mfa_required:true,mfa_verified:false,recent:false,fresh_minutes:120},
factors:mode==='enroll'?[]:[{id:'factor-one',name:'검증용 앱 1',verified:true},{id:'factor-two',name:'검증용 앱 2',verified:true}],
next:'/verified',returnToWork:mode!=='manage'
})));
`);
await new Promise((resolveBuild, reject) => webpack.webpack({
  mode: 'development', devtool: false, entry, output: { path: dir, filename: 'bundle.js' },
  resolve: { modules: [resolve('node_modules'), 'node_modules'], alias: {
    'next/image': passthrough, 'next/link': passthrough, 'next/navigation': navigation,
    '@/app/auth/mfa-actions': actions, '@/components/auth/mfa-code-input': input,
    '@/components/auth/mfa-management': passthrough,
  } },
}, (error, stats) => error || stats.hasErrors() ? reject(error ?? new Error(stats.toString('errors-only'))) : resolveBuild()));
const css = readdirSync('.next/static/css').filter(name => name.endsWith('.css')).map(name => readFileSync('.next/static/css/' + name, 'utf8')).join('\n');
const server = createServer((req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const path = new URL(req.url, 'http://127.0.0.1').pathname;
  if (path === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(readFileSync(join(dir, 'bundle.js'))); return; }
  if (path === '/fixture.css') { res.setHeader('Content-Type', 'text/css'); res.end(css); return; }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end('<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>MFA 자동 확인 검증</title><link rel="stylesheet" href="/fixture.css"></head><body><main class="mx-auto max-w-2xl p-5"><h1 class="text-2xl font-bold">' + (path === '/verified' ? '검증 성공: 작업 화면' : '합성 MFA 화면 — 성공 코드 012345') + '</h1>' + (path === '/verified' ? '' : '<p id="attempts">검증 요청: 0</p><p id="navigation"></p><div id="app"></div><script src="/bundle.js"></script>') + '</main></body></html>');
});
server.listen(0, '127.0.0.1', () => console.log('MFA fixture: http://127.0.0.1:' + server.address().port));
process.on('SIGINT', () => { server.close(); rmSync(dir, { recursive: true, force: true }); process.exit(); });
