# Supabase Cloud + Vercel 현재 운영 가이드

2026-09-19 · `anchor-managed-cloud-release`

사용자가 Supabase Cloud 사용과 공급자에 맞춘 비밀번호 정책 변경, ChatGPT/Codex 개발 소스의 Preview·Production 동시 배포를 요청했다. 메일 발송 서비스는 아직 없으며 후속 설정하기로 했다. 별도 인증 서버는 필요하지 않다.

## 환경과 소스

| 환경 | 사이트 | Supabase |
|---|---|---|
| Production / main | https://uc-life.org | `uoebygejgglgiivzgyks` |
| Preview / preview | https://uc-life-git-preview-ucsky6174.vercel.app | `bfqwntulxabfrimcypvx` |

같은 Git commit을 두 브랜치에 적용하되 환경별로 다시 빌드한다. Preview 산출물을 그대로 운영으로 promote하지 않는다. `/api/version`의 revision이 같은지, environment만 다른지 확인한다. Preview 접근 보호는 유지한다. 기존 운영 배포 `1a4bf13`은 이전 Antigravity 개발 화면이며 이번 교체 대상이다.

사용자가 지정한 메인 주소는 `uc-life.org`이며 `www.uc-life.org`와 `uc-life.vercel.app`에서 경로를 유지하여 이동한다. 인증·증명서 링크 기준과 홈 canonical도 메인 주소를 사용한다. 지정 발신 주소는 `noreply@uc-life.org`이며 실제 SMTP 연결 상태는 별도로 확인한다.

## 현재 인증 정책

- 이메일 ID, 12자 이상, 영문 대문자·소문자·숫자·특수문자 각각 필수. 표시 전환과 5개 조건 안내를 제공한다.
- Supabase native Auth가 직접 API에도 같은 조건을 적용한다. 유출 비밀번호 검사를 활성화한다.
- 관리자 업무는 native TOTP AAL2를 요구하고 민감한 쓰기는 최근 15분 인증을 검사한다. SYSTEM_ADMIN만으로 다른 업무 역할을 자동 부여하지 않는다.
- 비밀번호 변경 전 세션은 업무 및 MFA 관리 접근을 거부한다. native Auth가 비밀번호 해시를 다시 만들 때도 보수적으로 재로그인을 요구할 수 있다.
- 지원되는 auth.users 트리거만 설치한다. auth 내부 세션·MFA 조회 호환성은 Supabase 업데이트 후 다시 검증한다. MFA 해제는 native Auth 정책을 따르며 홈페이지의 마지막 factor 보호와 별도 최근 인증 규칙이 native API 전체에 추가 강제된다고 주장하지 않는다.
- Supabase native 요청 제한과 홈페이지 계정/IP HMAC 요청 제한을 사용한다. CAPTCHA는 키 준비 전 비활성이다. 서버 서비스 키는 인증 요청 제한 RPC에만 사용하며 업무 저장은 사용자 세션/RLS를 사용한다.

## Vercel 설정

두 환경에 `AUTH_PROFILE=managed-cloud-v1`, `SUPABASE_DEPLOYMENT_KIND=cloud`, `PREVIEW_REVIEW_ONLY=false`, `AUTH_EMAIL_ENABLED=false`, `AUTH_ABUSE_MODE=native-rate-limits`, `AUTH_CAPTCHA_ENABLED=false`, `AUTH_TRUSTED_IP_HEADER=x-vercel-forwarded-for`를 명시한다.

환경별 DB URL/공개 키, 서버 서비스 키, 서로 다른 무작위 `AUTH_RATE_LIMIT_SECRET`, `AUTH_SITE_ORIGIN`/`CERTIFICATE_VERIFY_ORIGIN`을 사용한다. `RELEASE_PRODUCTION_SITE_ORIGIN`과 `RELEASE_PRODUCTION_SUPABASE_REF`는 양쪽에 동일한 운영 기준을 둔다. `VERCEL*`은 공급자 시스템 변수를 사용한다. 비밀값은 Git·화면·로그에 남기지 않는다.

## 후속 운영 준비

회원가입 및 비밀번호 복구 요청은 화면·server action에서 중단하고 사유를 안내한다. Native 공개 가입도 끈다. 기존 계정 로그인은 가능하지만 초기 운영 관리자 계정과 업무 역할은 실제 담당자 확인 후 별도 구성해야 한다. 이 배포에서 실제 계정을 임의로 생성하거나 승인된 기관 개인정보 문안을 만들지 않는다.

SMTP 발신 도메인 인증과 메일 템플릿·재발송 한도·15분 복구 링크를 실제 수신함으로 검증한 뒤 native signup과 `AUTH_EMAIL_ENABLED`를 함께 활성화한다. 승인된 개인정보 처리방침·동의 문안도 먼저 등록한다. 환불·감면·강사 심사 기준은 승인 등록 전 제한을 유지한다. 카카오·네이버·PASS는 별도 연동 항목이다.

## 검증과 복구

`test:managed-cloud`, `test:release`, `test:review-preview`, `test:hosted-auth`, lint 및 Vercel 빌드 검사를 수행한다. `node scripts/verify-managed-cloud-live.mjs`는 고정 Preview에만 합성 계정을 만들어 native 로그인·비밀번호·TOTP·역할·RLS·저장을 검증한 뒤 생성 자료를 정리한다. 실사용 이메일을 발송하지 않는다.

운영 변경 전 public schema/data 백업은 Git 제외 `ops/evidence/managed-cloud-backup/`에 제한 권한으로 보관한다. 복원 리허설 완료를 의미하지 않는다. 장애 시 Vercel 이전 배포로 전환 가능하나 DB migration을 자동으로 되돌리지 않으며 현재 스키마와 이전 코드 호환성을 먼저 확인한다. 자체 서버 전용 migration 두 개는 Cloud에 적용하지 않고 `ops/retired-self-hosted/`에 과거 기록으로 보관했다.
