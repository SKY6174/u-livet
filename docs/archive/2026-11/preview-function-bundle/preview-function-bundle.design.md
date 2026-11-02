# Supabase Preview 함수 번들 설계

2026-11-02 · [계획](preview-function-bundle.plan.md)

## 확인한 원인

- TTF 글꼴 두 개와 PDF template를 static_files로 포함해 서버 측 5MB 제한을 넘는다. 서버 측 API 경로는 static file 배포도 보장하지 않는다.
- 로컬 Edge Runtime 번들 재현에서는 esm.sh의 `pako@1.0.11` 응답과 기존 lockfile 해시가 달라 integrity 검사도 실패한다. 해시 검사를 끄지 않고 변경 가능한 CDN 의존성을 제거한다.

## 수정 구조

- 두 Edge Function의 Supabase client import를 정확한 버전의 npm specifier로 고정한다. 동의서 함수의 pdf-lib import도 기존 npm import와 일치시켜 중복 CDN 모듈을 제거한다.
- 함수별 deno.json과 lockfile에 npm 배포본의 integrity를 고정한다. CDN의 변경된 파일 해시를 그대로 승인하지 않는다.
- npm 경로를 그대로 Edge Runtime에서 묶으면 패키지의 배포 파일·source map까지 포함해 43MB가 된다. 정확한 버전과 lockfile을 가진 전용 build 도구로 각 함수를 tree-shaking/minify한 단일 ESM entrypoint로 만들고 Git에 포함한다. config.toml은 이 entrypoint를 지정하며 node builtin 이외의 외부 import를 허용하지 않는다.
- 생성 bundle의 source input·도구 lock·출력 SHA-256 manifest를 검증한다. 앱 빌드 전에 오래된 생성물이거나 4,800,000바이트 이상이면 차단한다. canonical TypeScript는 유지하고 생성 파일은 직접 수정하지 않는다.
- 서버용 두 TTF와 PDF template를 native Brotli로 무손실 압축한다. glyph를 subset하지 않으며 압축 해제 후 원본과 모든 바이트가 일치해야 한다. 웹 화면에서 사용하는 원본 TTF는 유지한다.
- 작은 PDF template와 압축 글꼴을 생성된 TypeScript 자산 모듈에 포함해 일반 소스 import로 전달한다. 서버 측 배포에서 누락될 수 있는 static_files와 Deno.readFile 의존성을 없앤다. 외부 asset URL, Storage bucket, 새 환경변수는 추가하지 않는다.
- 압축 해제는 Edge의 native node:zlib decoder를 사용한다. WOFF2와 브라우저 JS decoder 경로는 실제 256MB user worker 시험에서 메모리 제한에 걸렸다. 최종 경로는 원본 TTF를 복원해 기존 renderer에 전달한다. fontkit의 미사용 브라우저 decoder도 native adapter로 치환해 번들 크기를 줄인다.
- 자산 generator와 크기 검증을 추가한다. 생성 결과와 원본을 검증하고 실제 Edge Runtime eszip를 5MB 미만으로 측정한다. 제한을 넘으면 배포 전에 실패시킨다.
- PDF renderer, 인증·PIN 검증, RLS·DB schema 및 AI 호출 동작은 변경하지 않는다.

## 검증과 배포

1. 압축 해제된 모든 글꼴·template 바이트를 원본과 비교한다.
2. 같은 합성 입력으로 세 동의서의 원본/변경 PDF를 생성하고 페이지 수, 추출한 한글 텍스트, 서명과 배치를 비교한다.
3. 실제 hardened Edge Runtime에서 npm 의존성과 자산 모듈을 포함해 bundle하고 함수를 실행한다. 인증 없는 요청 차단도 확인한다.
4. PR을 push해 Supabase Preview 검사를 성공시킨다. Vercel review-only 환경에는 자동 주입된 서버 키가 남지 않도록 브랜치 범위만 정리한다.
5. 정확한 PR head를 병합하고 Supabase main/운영 함수와 Vercel 운영 배포를 확인한다. 운영 DB 변경이나 실제 사용자 문서 생성은 수행하지 않는다.

근거: [함수 크기 제한](https://supabase.com/kb/troubleshooting/edge-function-bundle-size-issues).
