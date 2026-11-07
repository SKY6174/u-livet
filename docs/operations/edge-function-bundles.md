# Edge Function 배포 번들

2026-11-02 · Supabase의 서버 측 배포는 5MB 제한이 있으므로 Git에 검증한 단일 ESM bundle을 포함한다. `supabase/config.toml`의 entrypoint는 `index.bundle.mjs`를 가리킨다. canonical TypeScript를 수정한 뒤 생성물을 다시 만들며, 생성 파일을 직접 편집하지 않는다.

## 재생성

```sh
npm ci --prefix tools/edge-functions
npm run edge-assets:build
npm run edge-functions:build
npm run edge-assets:check
node scripts/verify-edge-consent-pdf.mjs
```

글꼴과 template가 바뀌지 않았다면 `edge-assets:build`는 생략할 수 있다. 두 TTF의 원본은 `public/fonts`, 범죄경력 동의서 template는 함수 assets 폴더에 있다. native Brotli로 압축해 자산 module에 포함하고 실행 시 원본 바이트를 복원한다. glyph subset이나 외부 자산 URL을 사용하지 않는다.

전용 build 도구는 정확한 버전과 lockfile로 설치한다. npm 의존성을 tree-shaking/minify하며 외부 import는 `node:` builtin만 허용한다. Edge 내장 native decoder를 사용하므로 브라우저용 Brotli JS decoder와 WOFF2 재구성의 메모리 비용을 피한다.

`bundle-manifest.json`은 canonical source, build 도구 lock과 출력의 SHA-256을 기록한다. 앱의 prebuild는 오래된 생성물, 원본과 다른 복원 바이트 및 4,800,000바이트 이상인 source bundle을 차단한다. 실제 eszip 검사도 가능하다.

```sh
node scripts/verify-edge-consent-assets.mjs --eszip /absolute/path/function.eszip
```

PDF 회귀 스크립트는 로컬 Docker의 고정 Edge Runtime에서 합성 입력만 사용한다. 256MB·2초 CPU 제한과 frozen prototype을 적용하고 세 종류의 원본/압축 PDF 및 미인증 요청 차단을 확인한다. 실제 DB·메일·AI 호출은 하지 않는다. 출력은 Git에서 제외된 `tmp/edge-consent-pdf`에 남는다.

일반 Preview 함수 배포는 `npm exec -- supabase functions deploy --remote=<preview-ref> --use-api --yes`로 확인한다. 운영은 검증한 PR을 병합한 뒤 자동 함수 배포 상태와 실제 응답을 확인한다. `--no-verify-jwt`, schema reset 또는 검증 우회로 크기 오류를 해결하지 않는다.
