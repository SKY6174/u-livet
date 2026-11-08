# 검토용 Vercel Preview

2026-11-09 · 운영은 `main`의 Git 연동 배포로 갱신한다. Preview 자동 배포 설정은 작업 시점에 확인하고, 검토 URL이 필요하면 기존 배포를 먼저 조회한다. 수동 배포가 필요한 경우 아래 절차를 따른다.

읽기 전용 검토 모드는 화면과 공개 과정 조회용이다. 로그인 후 업무 기능은 잠기며 홈페이지에 검토 범위를 안내한다. 공개된 과정이 없으면 빈 목록을 표시한다.

## 배포 대상

- Git: `SKY6174/u-livet`의 `preview` 브랜치.
- Vercel: `ucsky6174/u-livet` (`prj_h5sjV2a5VUNpxFMEa1dPYwoFMAz0`), Preview 환경, Node 24.
- [스테이징 주소](https://staging.u-livet.org)는 `preview` 브랜치에 연결되어 있다. 실제 응답과 배포 보호 상태는 사용할 때 확인한다.
- Supabase: 운영과 분리된 Preview DB를 사용한다. 이전 기록의 고정 ref를 그대로 재사용하지 말고, 현재 접근 가능한 프로젝트 ref·URL·공개키의 대상과 migration 상태를 확인한다.

## 중복 배포를 피하는 절차

1. 검토할 변경이 원격 `preview`에 반영됐는지 확인하고 SHA를 기록한다. Vercel Deployments에서 같은 프로젝트·SHA·브랜치·Preview 환경의 배포를 조회한다. 빌드 중이면 기다리고, 필요한 환경으로 이미 READY라면 기존 URL을 사용한다.
2. 새 배포가 필요한 경우 `preview`에 적용되는 Supabase URL과 공개키의 대상, 브랜치별 환경변수 범위, 운영 DB와의 분리를 확인한다. 읽기 전용 모드의 환경 조건도 아래 항목과 대조한다.
3. Vercel 프로젝트의 **Deployments → Create Deployment**에서 Git 참조 `preview` 또는 확인한 SHA를 선택한다. 같은 SHA가 여러 브랜치에 있으면 `preview` 브랜치 설정을 선택해야 해당 환경변수가 적용된다. [Git 참조 배포 공식 안내](https://vercel.com/docs/git#creating-a-deployment-from-a-git-reference)
4. 완료 후 보호된 배포 URL의 `/api/version`에서 `environment=preview`와 요청 SHA를 확인한다. 읽기 전용 모드라면 `reviewOnly=true`도 확인한다. 스테이징 주소를 사용할 때도 같은 SHA인지 대조한다.
5. 사용한 URL·SHA·배포 ID·확인한 DB ref를 작업 기록에 남긴다. 키·비밀번호·세션 값은 기록하지 않는다.

Supabase 연동은 PR이 열릴 때 Preview 환경변수를 동기화하며, 그 전에 시작된 배포를 보완하기 위해 해당 PR의 최근 배포를 다시 배포할 수 있다. 동일 SHA의 배포가 여럿이면 출처와 환경변수 동기화 시각을 비교한 뒤 필요한 배포를 재사용한다. 실제 비용은 Vercel 사용량 기록에서 확인한다. [Supabase Preview 연동 공식 안내](https://supabase.com/docs/guides/integrations/vercel-preview-branches)

## 모드와 경계

`PREVIEW_REVIEW_ONLY=true`는 서버 전용이다. Vercel Preview 표식, 다른 DB ref/site, 공개키만 가진 환경을 검사한 뒤 빌드한다. 이 모드는 Production 빌드와 전체 운영 인수 기록을 통과할 수 없다. 일반 배포의 기존 인증 정책은 유지한다.

middleware는 GET/HEAD 외 요청을 403 `PREVIEW_READ_ONLY`로 거부한다. 서버 client는 요청 cookie를 무시하고 공개 역할로만 조회한다. 로그인 identity를 제공하지 않으며 회원가입·로그인·비밀번호 복구 제출은 비활성화한다. 복구 token 교환 컴포넌트도 렌더링하지 않는다. `X-Robots-Tag: noindex, nofollow`를 반환한다.

Vercel의 배포 보호를 유지한다. 해당 프로젝트에 접근 가능한 Vercel 계정 로그인이 필요할 수 있다. 공개 접근이 필요하다는 이유로 보호를 해제하거나 운영 service role 키를 Preview에 복사하지 않는다.

## 환경 설정

읽기 전용 모드에서는 `PREVIEW_REVIEW_ONLY=true`, `SUPABASE_DEPLOYMENT_KIND=cloud`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `AUTH_SITE_ORIGIN`, `CERTIFICATE_VERIFY_ORIGIN`, `RELEASE_PRODUCTION_SITE_ORIGIN`, `RELEASE_PRODUCTION_SUPABASE_REF`를 사용한다. 현재 앱은 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 변수에서 Preview의 공개키를 읽는다. 실제 alias와 인증·증명 origin이 일치해야 한다.

Supabase 연동이 주입할 수 있는 `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `POSTGRES_URL`, `DATABASE_URL` 등 서버 비밀이나 DB 자격증명은 이 앱의 읽기 전용 검토 모드 빌드 검사에서 거부한다. 공개 키만 사용하도록 분리된 검토 환경을 준비하고 브랜치 범위를 확인한다. 전체 Preview 서비스용 서버 변수를 운영 범위에서 삭제하거나 운영 값을 변경하는 방식으로 해결하지 않는다.

Vercel이 자동 주입하는 공개 framework 메타데이터와 Observability client 설정은 검토용 빌드의 명시적 허용 목록에 포함한다. 임의의 Vercel 접두사 변수나 서버 비밀은 허용하지 않는다.

## 검증과 후속

`npm run test:review-preview`와 `npm run test:release`로 설정 경계를 확인한다. 앱 코드나 빌드 설정을 변경할 때는 `npm run lint`와 env 파일이 없는 별도 checkout의 Node 24 `npm ci`/`build:vercel`도 확인한다. 실제 Preview 배포 후에는 버전·홈페이지·인증 안내·쓰기 403·보호 업무 접근 제한을 확인한다.

전체 회원 기능을 열 때는 별도 기능 검증과 역할별 업무 인수를 수행한다. 검토 플래그만 제거한 상태를 운영 인수 완료로 간주하지 않는다.
