# u-livet.org 잔여 주소 정리 — Design

2026-10-07 · [계획](../../01-plan/features/u-livet-domain-reference-cleanup.plan.md)

## 주소와 변경 순서

- 운영 기준 주소 `https://u-livet.org`는 유지한다. 정적 `public/robots.txt`의 사이트맵만 이 주소로 고친다. `src/app/sitemap.ts`의 환경변수·기본값은 이미 새 주소다.
- Preview의 기준 주소를 `https://staging.u-livet.org`로 옮긴다. 먼저 Vercel 프로젝트 `u-live`의 `preview` 브랜치 도메인으로 추가해 인증서와 배포 보호를 확인한다.
- Preview Vercel의 `AUTH_SITE_ORIGIN`, `CERTIFICATE_VERIFY_ORIGIN`을 새 주소로 설정한다. `RELEASE_PRODUCTION_SITE_ORIGIN`은 `https://u-livet.org`로 유지한다. Preview를 재배포한다.
- Preview Supabase 프로젝트의 Site URL과 callback/가입 완료/비밀번호 재설정 허용 복귀 URL, Google Cloud Staging 웹 클라이언트의 JavaScript origin과 브랜딩 주소를 새 스테이징 주소에 맞춘다. 제공자의 redirect URI는 Supabase callback 그대로 둔다.
- 새 Preview에서 로그인 시작과 보호 상태를 검증한 후 `staging.u-live.org` 및 `staging.uc-life.org`를 새 스테이징 주소로 직접 이동시킨다. 운영 옛 주소의 기존 direct redirect는 보존한다.

## 저장소와 검증

- `public/robots.txt`: `Sitemap: https://u-livet.org/sitemap.xml`.
- `docs/operations/social-login-setup.md`: 현재 스테이징 홈페이지를 새 주소로 갱신한다.
- 새 운영 기록에 실제 도메인·인증 설정 변경과 검증 결과를 남긴다. 역사 문서는 당시의 사실을 나타내므로 재작성하지 않는다.
- 로컬 `npm run build`, PR Preview 검사와 배포 후 robots·sitemap·옛 주소 redirect(경로/쿼리 포함)·새 스테이징 보호·OAuth `redirect_to`를 확인한다.

## 안전 경계

- Supabase의 기존 Redirect URLs와 Google OAuth의 기존 origin은 새 주소 동작이 확인될 때까지 보존한다. 인증 비밀·환경변수 전체 값은 출력하거나 Git에 추가하지 않는다.
- DNS 메일 레코드와 생산 DB에는 손대지 않는다. 구 도메인 소유권 및 메일 발신 설정도 유지한다.
