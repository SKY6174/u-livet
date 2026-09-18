# 검토용 Vercel Preview

2026-09-19 · 사용자 승인: 검토용 Preview 먼저 배포, 최근 개발 코드 Git push.

별도 인증 서버 인수 전의 화면·공개 과정 조회용 배포다. 최신 LMS·수납·강사·증명·배지·연차 평가 코드를 포함하지만 로그인 후 업무 기능은 잠겨 있다. 홈페이지에 이 범위를 안내한다. 공개된 과정이 없으면 빈 목록을 표시한다.

## 배포 대상

- Git: `SKY6174/uc-life`의 `preview` 브랜치. main에 merge/push하지 않는다.
- Vercel: SKY/uc-life (`prj_h5sjV2a5VUNpxFMEa1dPYwoFMAz0`), Preview target, Node 24.
- Supabase: 기존 Preview `bfqwntulxabfrimcypvx`. 운영 데이터 복사 없음. 19개 migration 유지.
- 원격 배포 결과 URL·SHA는 작업 완료 보고에서 확인한다. 운영 사이트는 https://uc-life.vercel.app.

## 모드와 경계

`PREVIEW_REVIEW_ONLY=true`는 서버 전용이다. Vercel preview 표식, 다른 DB ref/site, 공개키만 가진 환경을 검사한 뒤 빌드한다. 이 모드는 production 빌드와 전체 운영 인수 기록을 통과할 수 없다. 일반 배포의 비밀번호·CAPTCHA·MFA 조건은 유지한다.

middleware는 GET/HEAD 외 요청을 403 `PREVIEW_READ_ONLY`로 거부한다. 서버 client는 요청 cookie를 무시하고 공개 역할로만 조회한다. 로그인 identity를 제공하지 않으며 회원가입·로그인·비밀번호 복구 제출은 비활성화한다. 복구 token 교환 컴포넌트도 렌더링하지 않는다. `X-Robots-Tag: noindex, nofollow`를 반환한다.

Vercel의 기존 인증 보호를 유지한다. 링크를 열 때 해당 프로젝트에 접근 가능한 Vercel 계정 로그인이 필요할 수 있다. 보호 설정을 끄거나 service role 키를 Preview에 복사하지 않는다.

## 환경 설정

Preview만 `PREVIEW_REVIEW_ONLY`, `SUPABASE_DEPLOYMENT_KIND=cloud`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `AUTH_SITE_ORIGIN`, `CERTIFICATE_VERIFY_ORIGIN`, `RELEASE_PRODUCTION_SITE_ORIGIN`, `RELEASE_PRODUCTION_SUPABASE_REF`를 등록한다. 서버 비밀, DB 비밀번호, 인증 실행 설정은 넣지 않는다.

Vercel API가 존재하지 않는 Git 브랜치의 설정을 거부하므로 최초 push 전에는 비어 있던 Preview 범위에 등록하고, 브랜치 생성 직후 `gitBranch=preview`로 좁힌다. Production 값은 변경하지 않는다. 실제 alias와 홈페이지·증명 origin의 일치를 확인한다.

Supabase GitHub 연결은 `new_branch_per_pr=true`, `supabase_changes_only=true`로 확인했다. 이 배포에서는 PR을 만들지 않고 기존 별도 Preview DB를 지정한다. push 후 브랜치 목록과 migration 이력을 다시 확인한다. 로컬 `supabase/config.toml`을 원격에 push하지 않고 인증 관련 마지막 3개 migration도 적용하지 않는다.

## 검증과 후속

`npm run test:review-preview`, `npm run test:release`, `npm run test:self-hosted`, `npm run lint`와 env 파일이 없는 별도 checkout의 Node 24 `npm ci`/`build:vercel`을 사용한다. 원격에서 homepage·health·인증 화면·쓰기 403·보호 업무 접근·운영 배포 보존을 확인한다.

전체 회원 기능을 열려면 승인된 인증 서버와 전체 migration, 실제 SMTP/Turnstile, MFA 및 역할별 업무 인수가 필요하다. 단순히 검토 플래그를 지우는 것으로 전환을 완료하지 않는다.

Vercel CLI 59.23.2의 `link` 실행은 로컬 `.env.local`의 OIDC 토큰을 자동 갱신했다. 해당 파일은 읽거나 Git/빌드에 포함하지 않았다. 이후 검사는 환경변수를 메모리로 전달한 깨끗한 디렉터리에서 실행했다.
