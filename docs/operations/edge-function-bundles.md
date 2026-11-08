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

## 사이트 도메인 변경 후 확인

Vercel 주소·Auth SiteURL을 바꿀 때 `instructor-documents`의 운영 `INSTRUCTOR_DOCUMENT_ALLOWED_ORIGINS`도 확인한다. 기존 값을 보존하고 정확한 새 HTTPS origin을 추가한다. 2026-11-08 현재 운영 값은 `https://uc-life.org,https://www.uc-life.org,https://u-livet.org`다. Preview의 허용 주소는 별도로 유지한다.

```sh
npm run test:production-origins
npm run test:production-origins -- --live --production
```

첫 명령은 자격 증명 없이 CORS 검사기의 회귀 사례를 실행한다. 두 번째 명령은 운영 함수에 OPTIONS 요청만 보내 세 개의 정상 origin과 외부 origin 거부를 확인한다. CORS 확인 후에는 합성 강사 계정으로 서류함의 session/context 연결도 검사한다. 파일 저장·발급·메일·AI 분석은 실행하지 않는다. 환경 설정 변경은 함수 재배포 없이 반영되므로 적용 후 실제 응답을 확인한다: [Supabase 환경 설정 안내](https://supabase.com/docs/guides/functions/secrets).
