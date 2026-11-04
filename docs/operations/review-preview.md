# 검토용 Vercel Preview

Vercel은 `main`에서 Production을 자동 배포한다. Preview 브랜치 자동 추적은 꺼져 있으므로 검토 URL이 필요할 때 `preview` 브랜치에서 수동 배포한다.

읽기 전용 검토 모드는 화면과 공개 과정 조회용이다. 로그인 후 업무 기능은 잠기며 홈페이지에 검토 범위를 안내한다. 공개된 과정이 없으면 빈 목록을 표시한다.

## 배포 대상

- Git은 `SKY6174/u-livet`의 `preview` 브랜치를 사용한다.
- Vercel 프로젝트는 `ucsky6174/u-livet`이고 대상 환경은 Preview다. [스테이징 주소](https://staging.u-livet.org)는 배포 보호가 적용된 `preview` 브랜치 도메인이다.
- 별도 Supabase Preview 프로젝트 ref는 `bfqwntulxabfrimcypvx`다. 테스트에는 검토용 데이터만 사용한다.

## 수동 Preview 절차

1. 검토할 변경이 원격 `preview`에 반영됐는지 확인하고 SHA를 기록한다. Vercel Deployments에서 같은 SHA, 브랜치, Preview 환경의 배포를 확인한다. 진행 중이면 기다리고, 필요한 환경으로 이미 배포됐다면 기존 URL을 사용한다.
2. 새 배포가 필요한 경우 `preview`에 적용되는 Supabase URL과 키의 대상, 그리고 브랜치 범위를 확인한다. 별도 Preview DB인지 확인한 뒤 Vercel의 **Deployments → Create Deployment**에서 Git 참조로 `preview`를 선택한다. SHA를 입력하는 경우에도 브랜치 설정은 `preview`를 선택한다. [Git 참조로 배포하는 방법](https://vercel.com/docs/git#creating-a-deployment-from-a-git-reference)
3. 완료 후 보호된 Preview의 `/api/version`에서 `environment=preview`와 요청한 SHA를 확인한다. 스테이징 주소에서 검토하는 경우에도 같은 SHA인지 확인한다. 검증에 사용한 URL과 SHA를 작업 기록에 남긴다.

같은 SHA에 두 배포가 있으면 배포 출처와 환경변수 동기화 시각을 비교한다. Supabase 연동이 PR의 Preview 변수를 동기화한 뒤 재배포할 수 있다. 실제 비용은 Vercel 사용량 기록에서 확인한다. [Supabase Preview 연동](https://supabase.com/docs/guides/integrations/vercel-preview-branches)

## 모드와 경계

`PREVIEW_REVIEW_ONLY=true`는 서버 전용이다. Vercel preview 표식, 다른 DB ref/site, 공개키만 가진 환경을 검사한 뒤 빌드한다. 이 모드는 production 빌드와 전체 운영 인수 기록을 통과할 수 없다. 일반 배포의 비밀번호·CAPTCHA·MFA 조건은 유지한다.

middleware는 GET/HEAD 외 요청을 403 `PREVIEW_READ_ONLY`로 거부한다. 서버 client는 요청 cookie를 무시하고 공개 역할로만 조회한다. 로그인 identity를 제공하지 않으며 회원가입·로그인·비밀번호 복구 제출은 비활성화한다. 복구 token 교환 컴포넌트도 렌더링하지 않는다. `X-Robots-Tag: noindex, nofollow`를 반환한다.

Vercel의 기존 인증 보호를 유지한다. 링크를 열 때 해당 프로젝트에 접근 가능한 Vercel 계정 로그인이 필요할 수 있다. 보호 설정을 끄거나 service role 키를 Preview에 복사하지 않는다.

## 환경 설정

읽기 전용 검토 모드에서는 `PREVIEW_REVIEW_ONLY=true`, `SUPABASE_DEPLOYMENT_KIND=cloud`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `AUTH_SITE_ORIGIN`, `CERTIFICATE_VERIFY_ORIGIN`, `RELEASE_PRODUCTION_SITE_ORIGIN`, `RELEASE_PRODUCTION_SUPABASE_REF`를 사용한다. 브랜치 설정의 실제 alias와 인증·증명 origin이 일치해야 한다.

`preview` 브랜치에 Supabase 연동이 주입한 `SUPABASE_SECRET_KEY`나 `POSTGRES_URL` 같은 변수가 있으면 읽기 전용 검토 모드의 빌드 검사를 통과할 수 없다. 이 모드가 필요할 때는 서버 비밀과 DB 비밀번호가 주입되지 않는 검토 환경을 먼저 확인한다.

Vercel이 자동 주입하는 공개 framework 메타데이터와 Observability client 설정은 검토용 빌드의 명시적 허용 목록에 포함한다. 임의의 Vercel 접두사 변수나 서버 비밀은 허용하지 않는다.

## 검증과 후속

`npm run test:review-preview`, `npm run test:release`, `npm run test:self-hosted`, `npm run lint`와 env 파일이 없는 별도 checkout의 Node 24 `npm ci`/`build:vercel`을 사용한다. 원격에서 homepage·health·인증 화면·쓰기 403·보호 업무 접근·운영 배포 보존을 확인한다.

전체 회원 기능을 열려면 승인된 인증 서버와 전체 migration, 실제 SMTP/Turnstile, MFA 및 역할별 업무 인수가 필요하다. 단순히 검토 플래그를 지우는 것으로 전환을 완료하지 않는다.

Vercel CLI 59.23.2의 `link` 실행은 로컬 `.env.local`의 OIDC 토큰을 자동 갱신했다. 해당 파일은 읽거나 Git/빌드에 포함하지 않았다. 이후 검사는 환경변수를 메모리로 전달한 깨끗한 디렉터리에서 실행했다.
