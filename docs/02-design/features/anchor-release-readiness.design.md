# Vercel + Supabase 운영 준비 설계

2026-09-19 · `anchor-release-readiness` · Plan 기준

## 구성

- `scripts/lib/release-readiness.mjs`: 환경변수와 담당자 점검 기록의 순수 검사. 입력 값/키/외부 에러 원문을 출력하지 않는다.
- `scripts/check-release-readiness.mjs`: process.env 기본, 지정된 `--env-file`만 명시적으로 읽는다. `.env.local` 자동 탐색·수정, 외부 네트워크, 공급자 설정 변경 없음. `--snapshot`은 소스/migration 지문만 반환한다.
- `scripts/verify-release-readiness.mjs`: 합성 설정과 임시 폴더 기반 회귀 검사. 실제 비밀/원격 서비스 없음.
- `.env.example`: Vercel 환경별 필수·서버 전용·공개 항목. 값은 비워 두며 기존 파일을 덮어쓰도록 지시하지 않는다.
- `ops/release.example.json`: 버전1, target, siteOrigin, supabaseProjectRef, sourceDigest, migrationDigest, 운영 체크별 status/owner/checkedAt/evidence. 기본 모두 pending.
- `docs/operations/vercel-supabase-release.md`: 담당자/증거/점검 순서와 실제 미준비 항목.
- `vercel.json`: framework nextjs, buildCommand npm run build:vercel. 실제 배포는 하지 않는다.

## 환경 검사

target은 `preview|production` 또는 VERCEL_ENV에서 결정한다. 명시 target과 VERCEL_ENV가 다르면 거부한다. 각 URL은 HTTPS의 경로·인증정보·query·fragment 없는 공개 origin이어야 한다. localhost·IP·예약 예시 도메인은 거부한다. Supabase는 `<project-ref>.supabase.co` 기본 도메인으로 검사한다(사용자 지정 도메인 채택 시 설계를 갱신).

`RELEASE_PRODUCTION_SUPABASE_REF`와 `RELEASE_PRODUCTION_SITE_ORIGIN`은 공개하지 않는 배포 검사용 기준값이다. Production의 DB/site는 기준과 같아야 하고 Preview는 각각 달라야 한다. 이 기준 자체의 진위는 운영자 증거 항목이다.

현재 필수값: NEXT_PUBLIC_SUPABASE_URL/ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, AUTH_SITE_ORIGIN, CERTIFICATE_VERIFY_ORIGIN, AUTH_RATE_LIMIT_SECRET, AUTH_CAPTCHA_ENABLED, AUTH_TURNSTILE_SITE_KEY, AUTH_TRUSTED_IP_HEADER. 증명 검증 origin은 해당 환경 사이트와 일치시킨다. 로컬 CAPTCHA 시험 변수가 있으면 거부한다. legacy TRUST_PROXY_IP=true는 거부한다.

공개 변수 allowlist는 URL/anon key 둘뿐이다. 새 공개 변수가 필요한 경우 코드/설계 검토 후 추가한다. publishable/secret key와 legacy JWT의 anon/service_role 모양을 구분한다. JWT payload는 서명 검증이 아니며 키 유효성 판정으로 표시하지 않는다. legacy JWT project ref는 URL과 일치해야 한다. 키 동일값/공개 비밀 복제·placeholder·짧은 HMAC·공개 CAPTCHA 시험 키를 거부한다. HMAC은 임의성 보장 검사가 아니라 길이/형식·기본값 검사이다.

Vercel 직접 유입 기준 AUTH_TRUSTED_IP_HEADER=x-vercel-forwarded-for. 실제 프록시 overwrite·별도 upstream proxy·우회 경로 검증은 담당자 확인 항목이다.

## 판정

`--config-only`: CONFIG_VALID 또는 BLOCKED, 종료값 0/1. **CONFIG_VALID는 운영 가능 판정이 아니다.** Vercel 빌드에서는 이 검사만 연결하며 외부 API를 호출하거나 설정을 자동 변경하지 않는다.

기본 전체 검사: 환경 + record를 검사. 각 필수 항목은 confirmed, owner/evidence의 비어 있지 않은 기록, 유효한 과거 날짜(최대30일)가 필요하다. confirmed는 담당자의 확인 선언이며 도구가 외부 사실을 검증한 결과가 아니다. 입력 문자열을 보고서에 재출력하지 않는다.

record target/site/ref는 현재 환경과 일치해야 한다. sourceDigest 및 migrationDigest는 로컬 소스 지문과 일치해야 한다. 소스 지문은 src/scripts/assets/public 및 migration/templates + 앱 build 설정/lockfile을 포함한다. 환경파일 실제 값·검토 기록·운영 증거는 지문 대상에서 제외한다. symlink 파일/디렉터리는 읽지 않고 거부한다. 누락/잘못된 기록은 BLOCKED, 모두 충족 시 READY_FOR_MANUAL_RELEASE_REVIEW. 사람이 실제 자료·설정·게시 승인 여부를 확인해야 하며 도구가 승인하지 않는다.

## 운영 확인 항목

도메인·환경 분리, native 비밀번호 정책, hosted auth schema 호환성, SMTP/복구, CAPTCHA native 경계, MFA/권한/분실 복구, DB migration/RLS, 개인정보/보유기간/동의, 환불·강사 심사 미확정 기능 제한, 프록시/WAF/공개 API 한도, 일일 기록 정리, 백업·실제 복원, 브라우저·PDF·런타임 회귀, 모니터링·비용, 이전 build+DB 호환성과 배포/복구 승인.

Preview build의 공개 환경변수는 Production으로 승격해도 바뀌지 않는다. Production 후보는 Production 환경으로 별도 빌드해야 한다. DB 복원은 Vercel rollback과 별개이며 이전 build와 현재 DB의 호환성을 검증한다.

## 검증

환경 오류별 거부, 키 비노출, 정상 합성 설정, Preview/Production 분리, native 확인 pending 거부, 기록 신선도/지문 불일치, CLI exit code/JSON/help/오류 경계/자동 env 로드 금지, build gate 실패 시 next build 미호출. 앱 화면 변경은 없으므로 기존 120개 인증 시나리오 전체를 재실행하지 않는다. 실제 Vercel build·원격 키 유효성·native 설정은 별도 staging 증거가 필요하다.
