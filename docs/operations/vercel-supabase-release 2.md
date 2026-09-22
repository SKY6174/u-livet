# Vercel + Supabase 운영 인수 및 배포 가이드

> 과거 자체 서버 검토 단계의 기록입니다. 사용자가 Supabase Cloud 정책에 맞추기로 변경했습니다. 현재 비밀번호·배포 설정 및 메일 후속 처리 기준은 [관리형 Cloud 운영 가이드](managed-cloud-release.md)를 따릅니다. 아래의 자체 서버 필수 조건과 대소문자 선택 조건은 현재 배포에 적용하지 않습니다.

2026-09-19 · `anchor-release-readiness`

현재 단계는 **배포 사전 검사 도구, Supabase Preview 업무 DB 검증, 별도 인증 서버 운영 설계 완료 / 실제 운영 배포 미실시**다. 운영 도메인·전체 앱/인증 인수·담당자 인수 기록이 미완료이므로 운영 가능 판정은 `BLOCKED`다. 기존 `.env.local`을 읽거나 덮어쓰지 않았다. Preview는 최소 비밀번호 길이 12자만 충족하며 정확한 문자 조합은 미충족이다. 운영 설정은 유지했다.

후속 확인: ANCHOR/uc-life의 [Preview](supabase-preview.md) ref는 `bfqwntulxabfrimcypvx`다. main은 001~008 유지, Preview는 업무용 11개를 추가 적용해 총 19개다. Auth 복구·MFA·남용 방지 3개는 Cloud Preview에 적용하지 않았다. [재시도 절차](supabase-migration-retry.md), [인증 호환성 문서](supabase-auth-compatibility.md), [인증 구성 결정안](auth-deployment-decision.md)을 참조한다.

사용자가 선택한 [별도 인증 서버 운영 설계](self-hosted-auth-design.md)는 Vercel + 자체 운영 Auth/업무 DB를 기본안으로 제안한다. 후속으로 검사기에 self-hosted 분기와 스택/이미지/설정 지문 검사를 추가했다. 아래 Cloud용 절차 대신 [자체 운영 설정 및 검사 가이드](self-hosted-preflight.md)의 버전 2 기록·전용 양식을 사용한다. 실제 배치·도메인·예산·담당자 확정과 새 스택 인수는 후속 작업이다.

## 먼저 확정할 항목

| 항목 | 필요한 결정 또는 증거 |
|---|---|
| 기관 소유 도메인 | Production origin, 별도 고정 Preview origin, DNS/TLS 관리 담당자 |
| Supabase 배치 | Cloud 프로젝트 ref 또는 self-hosted 스택 식별자, 환경별 DB 위치·키·기관 접근권한·서버/백업 예산 |
| 인증 정책 호환성 | 아래 비밀번호 규칙·DB 감사·MFA의 선택한 배포 방식에서의 실행 증거 |
| 인증 서비스 | 기관 발신 SMTP, Turnstile 환경별 site/secret key, 허용 도메인 |
| 운영 책임 | 최초 관리자·MFA 분실 복구 승인자·개인정보 담당자·장애 대응 담당자 |
| 기관 문안과 기준 | 승인된 처리방침·동의·보유기간·수료/모집 기준. 환불·감면·강사 심사는 확정 전 제한 유지 |

프로젝트를 새로 만들거나 비용이 발생하는 서비스를 신청하는 작업은 이 문서가 수행하지 않는다. 카카오·네이버 로그인/PASS는 별도 도입 항목이며 현재 연결 완료로 표시하지 않는다.

## 1. 운영 Supabase에서 우선 확인할 인증 호환성

확정 비밀번호는 **12자 이상 + 영문·숫자·ASCII 특수문자 각각 포함**, 영문 대문자·소문자는 둘 중 하나만 있어도 된다. 현재 앱의 상한은 128 UTF-16 코드 단위다. 로컬 Auth에는 사용자 지정 문자 집합을 적용했다. 공식 hosted 문서의 가장 강한 프리셋은 대문자와 소문자를 각각 요구하므로, 이 프리셋을 확정 조건과 같다고 간주하면 안 된다. 공급자에게 동등한 native 강제 수단을 확인하고 운영과 동등한 Preview에서 직접 시험한다. 지원 불가가 확인되면 정책을 임의로 바꾸지 않고 인증 배치 설계를 다시 결정한다. [Supabase 비밀번호 보안](https://supabase.com/docs/guides/auth/password-security)

검토용 계정으로 다음을 각각 가입·복구 후 변경·직접 Auth API에서 확인한다. CAPTCHA를 끄지 말고 유효한 토큰을 사용해 비밀번호 규칙과 봇 검사를 구분한다.

- 12자 이상, 소문자만+숫자+특수문자 → 허용. 대문자만+숫자+특수문자 → 허용.
- 11자, 영문 없음, 숫자 없음, 특수문자 없음 → 거부.
- 직접 API 우회, 구정책 계정의 기존 세션, 복구 전 세션 → 업무 데이터 접근 거부.
- 비밀번호 보이기·조건 체크·쉬운 오류 안내와 서버 판정이 같은지 확인.

`anchor_auth_recovery` 및 `anchor_admin_mfa` migration은 `auth.users`, `auth.audit_log_entries`, `auth.sessions`, `auth.mfa_factors`, `auth.mfa_amr_claims`에 의존하며 일부 트리거를 만든다. hosted에서 필요한 권한, 이벤트 payload/transaction 순서, 업그레이드 후 호환성을 확인해야 한다. 로컬 성공은 hosted 지원 보장이 아니다. 호환성이 확인되지 않으면 `hosted-auth-compatibility`를 `confirmed`로 바꾸지 않는다.

## 2. 환경별 구성

Preview는 별도 DB·테스트 계정·메일 수신함을 사용한다. 실제 수강생 개인정보를 복제하지 않는다. 고정 Preview 도메인을 사용하고 불필요한 Preview 공개는 배포 보호 설정으로 제한한다. 운영 Origin/DB ref 기준값 자체의 진위는 담당자가 별도로 확인한다.

| 변수 | Vercel 등록 범위와 의미 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 환경별 공개 URL/키. 키 공개 여부와 무관하게 RLS·RPC 권한 확인 필수 |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용. 현재 인증 요청 제한 RPC에 필요. 제한된 관리자만 접근 |
| `AUTH_RATE_LIMIT_SECRET` | 서버 전용. 환경별 독립적인 암호학적 난수 32자 이상. 키 교체 시 제한 기록 연속성 영향 확인 |
| `AUTH_SITE_ORIGIN` / `CERTIFICATE_VERIFY_ORIGIN` | 같은 환경의 고정 HTTPS origin. 경로·끝 `/`·query 없음 |
| `AUTH_CAPTCHA_ENABLED` | `true` |
| `AUTH_TURNSTILE_SITE_KEY` | 실제 환경의 site key. 시험용 키 금지 |
| `AUTH_TRUSTED_IP_HEADER` | Vercel 직접 유입 구성에서는 `x-vercel-forwarded-for`. 실제 overwrite/우회 경계 검증 필요 |
| `RELEASE_PRODUCTION_SITE_ORIGIN` / `RELEASE_PRODUCTION_SUPABASE_REF` | 서버 전용 검사 기준. 양 환경에 동일한 운영 기준을 등록. Preview의 실제 값은 두 기준 모두와 달라야 함 |

`VERCEL`, `VERCEL_ENV`는 Vercel 시스템 변수다. `AUTH_LOCAL_CAPTCHA_TEST`는 제거하고, legacy `TRUST_PROXY_IP`는 미설정 또는 `false`로 둔다. 새 `NEXT_PUBLIC_` 변수는 설계 검토 전 거부한다. 서버 키를 공개 변수나 `next.config.js`의 `env`에 넣지 않는다. `.env.example`에는 실제 값을 쓰지 않는다. Vercel에서 Preview와 Production 범위를 각각 선택해 등록하고 Git·터미널 기록·스크린샷에 비밀값을 남기지 않는다. [Vercel 환경변수](https://vercel.com/docs/environment-variables)

키 검사는 `sb_publishable_`/`sb_secret_`의 형식 또는 legacy JWT의 role/ref만 검사한다. JWT 서명·만료·실제 API 접근과 새 형식 키의 프로젝트 귀속은 검증하지 않는다. 합성 문자열도 형식 검사를 통과할 수 있으므로, 담당자가 해당 환경에서 최소권한 API 시험을 별도로 수행한다.

Supabase Auth에는 환경별 Site URL, `/auth/reset-password` 등 실제 필요한 redirect URL만 등록한다. 광범위한 운영 wildcard는 사용하지 않는다. 승인 SMTP·메일 인증 활성화·15분 복구 유효기간·60초 재발송 간격·TOTP 활성화·native CAPTCHA 및 한도를 확인한다. `supabase/templates/recovery.html`은 fragment의 token hash를 사용한다. 운영 Site URL로 만든 메일에서 다른 기기 복구, 만료·재사용 거부, 토큰의 URL query/로그 비노출을 확인한다. **로컬 `config.toml`을 그대로 복사하지 않는다**: 로컬 이메일 인증은 꺼져 있다. [Supabase redirect 설정](https://supabase.com/docs/guides/auth/redirect-urls), [운영 체크리스트](https://supabase.com/docs/guides/deployment/going-into-prod)

## 3. 사전 검사 명령과 판정

Node 22 이상에서 프로젝트 루트로 실행한다. 기본 입력은 현재 프로세스 환경이며 `.env.local`을 자동으로 읽지 않는다. 비밀값은 명령줄 인자에 쓰지 않는다. 예시 파일로 실행하면 실패하는 것이 정상이다.

```sh
npm run test:release
npm run check:release -- --target production --env-file .env.example --config-only
npm run check:release -- --snapshot
```

실제 검사에서는 보호된 환경을 주입하거나 별도 파일을 `--env-file`로 명시한다. 파일 사용 시 상속 환경을 합치지 않는다. `node`로 직접 실행할 때는 Node 옵션과 충돌하지 않도록 `node -- scripts/check-release-readiness.mjs ...` 형식을 사용한다. 입력/기록 파일 한도는 각각 128 KiB다.

`ops/release.example.json`을 `ops/release.local.json`으로 복사하고 target/siteOrigin/supabaseProjectRef 및 `--snapshot`의 두 digest를 기록한다. 점검마다 담당자, 실제 확인한 UTC ISO 시각, 비밀이 없는 내부 증거 문서 참조를 채운다. 증거 원문은 접근권한이 제한된 문서함에 둔다. 파일·증거 폴더는 Git에서 제외한다. 모든 항목은 기본 `pending`이며 확인 없이 일괄 변경하지 않는다.

```sh
npm run check:release -- --target production --record ops/release.local.json --format json
```

| 결과 | 의미 |
|---|---|
| `BLOCKED` / 종료 1 | 설정 또는 확인 기록 미충족. 잘못된 입력 파일도 실패 |
| `CONFIG_VALID` / 종료 0 | `--config-only`의 오프라인 형식 통과. 운영 게시 승인 아님 |
| `READY_FOR_MANUAL_RELEASE_REVIEW` / 종료 0 | 전체 기록 완결성 통과. 담당자가 실제 증거·공급자 상태·게시 승인 확인 필요 |

점검 기록은 현재 대상과 일치하고 30일 이내여야 한다. 소스 또는 migration 변경 시 지문이 바뀌므로 변경 영향을 다시 검토해 기록을 갱신한다. 검사기는 확인 기록의 진위나 외부 문서 내용을 검증하지 않는다. Vercel 빌드는 **설정 검사만** 연결되어 있으므로 전체 인수 검사를 자동 강제하는 배포 승인 시스템은 아니다.

지문 범위는 `src/scripts/assets/public`, migration/templates, package/lockfile, Next/TypeScript/Vercel/Tailwind/PostCSS 설정, `.env.example` 및 `ops/self-hosted`의 고정된 4개 비밀 없는 템플릿이다. 실제 env 값·docs·나머지 ops 증거·Supabase 로컬 `config.toml`과 숨김 파일은 제외한다. 대상 내 symlink는 거부한다. 원격 Auth 설정, 의존 패키지 다운로드 결과, 전체 빌드 산출물의 동일성을 증명하는 지문은 아니다.

## 4. 15개 운영 점검 항목

아래 담당자는 역할 제안이며 아직 실명 담당자가 배정된 것은 아니다. 각 항목은 점검 기록의 ID와 연결된다.

| ID | 담당 역할 | `confirmed`로 바꾸기 전 필요한 증거 |
|---|---|---|
| environment-isolation | 인프라 | 도메인/DNS/TLS, Vercel 프로젝트 소유·접근권한, 양 환경 DB와 키 분리, 기준값 진위 |
| native-password-policy | 인증 개발/운영 | 위 비밀번호 허용·거부 행렬의 native API 결과 및 공급자 지원 근거 |
| hosted-auth-compatibility | DB/인증 | 관리형 Auth 권한·트리거·감사 이벤트·MFA 호환성 및 업그레이드 검증 방법 |
| smtp-recovery | 인증/업무 | 발신 도메인 인증·승인 SMTP·가입 이메일 인증·실제 수신·15분 만료·일회성·구세션 거부 |
| native-captcha | 보안/인증 | 실제 키·허용 도메인, native API 토큰 누락/실패 거부, 정상 이용·위젯 장애 복구 |
| mfa-access-recovery | 사업단/보안 | 최초 관리자 위임·MFA 등록, 권한별 접근, 분실 시 신원 확인/승인/이력, 공급자 콘솔 MFA |
| database-security | DB/개발 | 승인 migration 목록, legacy 접근 회수, 역할별 RLS/RPC·이관 검증, Advisor, 서비스 키 비노출 |
| privacy-consent | 개인정보/사업단 | 승인 처리방침/동의 버전, 항목·목적·보유기간·위탁/국외이전 검토, 선택 동의/철회, 조회/정정/파기 절차 |
| unconfirmed-policies | 사업단 | 환불·감면·강사 심사 기준이 미정일 때 처리 차단. 승인된 모집/수료/증명 발급 기준과 책임자 |
| proxy-rate-limits | 인프라/보안 | 헤더 위조·다른 진입 경로·native API 우회 시험, 공용망 학습자 사용성, 공개 검증 API/WAF 한도 |
| retention-jobs | DB/운영 | 일일 정리 작업 실행 이력·실패 알림·잔여 데이터 확인, 승인 보유기간과 별도 파기 작업 |
| backup-restore | DB/운영 | 복원 가능한 백업·암호화/접근권한, 별도 파일 복원, 실제 복원 연습 시간·RPO/RTO·담당자 |
| release-smoke | QA/사업단 | 대상 Node/의존성 점검, 실제 환경 브라우저 역할별 업무·모바일/큰 글씨/키보드·PDF 글꼴/QR·캐시/헤더 |
| monitoring-costs | 운영 | `/api/health`, 인증/발급 오류·제한·정리 실패·SMTP 한도·DB/전송량/과금 경보 수신 시험 |
| release-rollback | 게시 책임자/DB | 게시 승인, 이전 build+현재 DB 호환성, 환경변수/키 변경 영향, 정지·복구 기준 및 담당자 |

증명·배지 공개 검증의 현재 인스턴스 메모리 제한만으로 분산 서버 전체 한도를 보장하지 않는다. 직접 RPC도 별도로 평가한다. `x-vercel-forwarded-for`는 Vercel 앞단의 프록시 구성에 따라 실제 경계를 시험해야 하며 헤더 이름만 지정했다고 보안 검증이 끝나는 것은 아니다. [Vercel 요청 헤더](https://vercel.com/docs/headers/request-headers)

요청 제한 정리는 `life_prune_auth_requests` RPC를 service role 경로로 호출해야 한다. 한 번에 최대 10,000개, 만료 후 24시간 지난 기록만 지운다. 인증 작업이 없는 날에도 동작할 스케줄러와 실패 알림을 별도 마련하고, 잔여량에 맞춘 제한된 반복 실행을 검토한다. RPC 내부에서 JWT role도 검사하므로 단순 `pg_cron` SQL 호출만 등록하고 성공을 가정하지 않는다. 현재 스케줄러는 설치하지 않았다.

인증 제한 기록 정리와 수강·수납·증명·접속 이력 파기는 별개다. 기관 승인 보유기간에 따라 대상·법적 보존/분쟁 보류·백업 만료·철회 후 처리를 문서화하고 실제 작업을 검증한다. 임의의 법정 보유기간을 이 문서에서 확정하지 않는다. 현재 화면 문안이나 샘플 정책을 기관 승인 문안으로 간주하지 않는다.

## 5. Preview 검증 후 Production 후보 만들기

1. 기관 소유 Vercel 프로젝트와 **별도** Supabase Preview를 준비한다. 비용·권한·데이터 반입 범위를 확정하고 Node 지원 버전을 고정한다. 현재 도구 실행 조건은 Node 22 이상이며 이번 로컬 시험은 Node 26이다.
2. 깨끗한 배포용 checkout에서 lockfile 기준으로 설치하고 보안/라이선스·실행환경 검사를 남긴다. 로컬 fixture, 임시 PDF, 개인 자료, 실제 env 파일을 업로드하지 않는다. 기존 전체 작업 폴더를 그대로 업로드하지 않는다.
3. 적용 대상 DB의 현재 migration 이력·백업을 확인한다. 22개 파일을 무조건 재실행하지 않는다. 기존 DB에는 001~008만 적용되었던 과거 확인이 있으므로 현재 상태부터 재확인하고 009~010 및 이후 파일을 검토한다. legacy 자료 이관과 관리자 역할 위임을 별도로 수행한다.
4. Preview에서 migration/Auth/SMTP/CAPTCHA 및 정책을 적용하고 전체 역할별 업무를 확인한다. `scripts/verify-*.mjs`의 기존 업무 검사는 전용 로컬 DB 및 가상자료에 묶여 있으므로 보호 장치를 제거해 원격 운영 DB에서 실행하지 않는다. 원격 인수 검사는 승인된 시험 계정/자료로 따로 수행한다.
5. Vercel은 `vercel.json`의 `npm run build:vercel`을 사용한다. Vercel 표식·대상 환경·설정을 검사하고 `.env`, `.env.local`, `.env.production`, `.env.production.local`이 있으면 빌드를 거부한다. 검사 성공 후에만 `next build`를 실행한다. migration/정책/실제 증거 확인은 이 빌드가 수행하지 않는다.
6. Production 후보는 **Production 환경변수로 새 빌드**한다. Preview build를 그대로 운영 도메인으로 승격하면 Preview의 `NEXT_PUBLIC_` 값이 남을 수 있다. Production build와 게시 도메인 전환을 분리하고, 기관 승인 전에는 일반 접근을 차단한 후보에서 검사한다. 플랫폼/요금제에서 가능한 배포 보호·자동 도메인 배정 제어 방식을 먼저 확인한다. [Next.js 환경변수와 빌드 시 고정](https://nextjs.org/docs/app/guides/environment-variables)
7. 후보에서 `/api/health`, 가입/복구/MFA, 수강 신청→운영→수료→증명/PDF·배지 검증, 수납/환불 제한·강사 심사 제한, 권한 우회·개인정보/캐시 헤더를 확인한다. 실제 문자/메일/금융 처리는 승인된 시험 범위에서만 수행한다. 영상/QR 출결, 은행/PG, 실제 문자 공급자, 외부 배지 지갑 등 미연동 기능을 제공 완료로 표시하지 않는다.
8. 현재 소스 지문과 환경에 맞는 전체 점검 기록을 검사하고 책임자가 증거와 게시를 승인한 뒤 도메인을 전환한다. 자동 Git push가 즉시 운영 게시로 이어지지 않도록 승인 전 브랜치/배포 설정을 확인한다.

## 6. 장애·롤백·복원

오류율 증가·권한 이상·결제/증명 불일치 등 기관이 정한 중단 기준을 먼저 기록한다. 장애 시 게시 책임자가 신규 쓰기/처리를 제한하고 로그에 개인정보·토큰을 남기지 않은 채 원인을 분류한다. 이전 배포 식별자·당시 env/key·현재 DB schema 호환성을 확인한 후 복구한다.

Vercel 이전 배포 복귀는 DB migration을 되돌리지 않는다. 이전 build는 당시 환경변수를 사용하므로 폐기된 키나 이전 DB URL을 참조할 수 있다. 호환되지 않으면 검증된 수정 배포를 선택한다. DB 복원은 별도 승인·복구 작업이며 백업 이후 수강/수납/발급 자료의 손실·재처리·중복 발급 여부를 확인한다. [Vercel Instant Rollback](https://vercel.com/docs/instant-rollback)

Supabase DB 백업은 Storage API의 파일 본문을 포함하지 않는다. 강의자료·첨부 증빙 등 파일은 별도 백업/복원 경로와 접근권한이 필요하다. 공급자 요금제의 백업 보존·PITR 여부를 확인하고 분리된 환경에서 실제 복원 시험을 남긴다. [Supabase 백업 범위](https://supabase.com/docs/guides/platform/backups)

## 현재 완료와 남은 작업

완료: 오프라인 환경·점검 기록 검사, Vercel 설정 검사 후 빌드 실행, 합성 데이터 회귀 검사, 빈 점검표, 이 운영 가이드. 후속 Cloud Preview 업무 DB 적용·제한된 접근 검사 및 별도 인증 서버 설계도 완료했다.

미완료: 운영/시험 도메인·앱 연결, self-hosted 배치 확정·서버 구성·인증 인수, 승인 정책·담당자, SMTP/Turnstile/WAF/정리 스케줄/백업·모니터링 구성, 실제 대상 런타임·역할별 업무 인수 및 게시. Cloud Preview 업무 DB 준비가 운영 기능 활성화나 앱 배포를 뜻하지 않는다.
