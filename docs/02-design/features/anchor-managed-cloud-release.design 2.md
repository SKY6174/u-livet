# Supabase Cloud 전환·동일 버전 배포 설계

2026-09-19 · [계획](../../01-plan/features/anchor-managed-cloud-release.plan.md)

## 인증·권한

Supabase Cloud native Auth를 사용한다. 비밀번호 최소 12자, 영문 소문자·대문자·숫자·공급자 지원 특수문자 각각 필수로 UI/서버/API를 맞춘다. 이메일 ID와 비밀번호 표시 전환은 유지한다.

아직 Cloud에 적용하지 않은 자체 서버용 recovery/MFA migration 2개는 `ops/retired-self-hosted/migrations`로 보관한다. 새 CLI 생성 migration으로 같은 앱 RPC 인터페이스를 제공한다. Auth users의 지원되는 트리거만 사용하여 비밀번호 변경 시 기존 세션의 업무 접근을 무효화한다. DB 감사 이벤트 저장과 auth.mfa_factors 트리거는 사용하지 않는다. 이 변경은 두 Cloud DB의 계정 수 0, 미적용 이력 확인 후 수행한다. 기존 로컬 자체 서버 인수 기록은 과거 구현의 증거로만 남긴다.

관리자 업무는 native TOTP AAL2와 유효한 factor/session 확인을 요구하고 쓰기는 최근 15분 인증을 검사한다. factor 등록·해제는 Supabase native API 권한 모델을 따른다. 홈페이지에서는 최근 인증과 관리자 마지막 factor 보호를 추가하지만 직접 Auth API까지 같은 사용자 정의 factor 변경 제한을 강제한다고 주장하지 않는다. factor가 없거나 세션이 폐기되면 DB 업무 접근은 거부한다.

서비스 키는 기존 HMAC 요청 제한 RPC 호출에만 서버에서 사용한다. 사용자의 업무 저장은 사용자 세션/RLS로 수행한다. 관리형 native rate limits + 홈페이지 계정/IP/HMAC 제한을 기본 남용 방지로 사용하며 CAPTCHA 키가 준비되면 추가 가능하다. 키 없는 CAPTCHA를 켰다고 표시하지 않는다. `AUTH_ABUSE_MODE=native-rate-limits`는 Cloud에서만 명시적으로 허용한다.

## 후속 메일 설정

사용자 선택에 따라 `AUTH_EMAIL_ENABLED=false`를 두 환경에 적용한다. 회원가입·복구 메일 요청은 UI와 server action 양쪽에서 차단하고 사유를 안내한다. 기존 계정의 로그인은 허용한다. Native 공개 가입도 비활성화한다. 승인 개인정보 문안·환불·강사 기준은 임의 승인하지 않는다. 테스트는 Preview에서 메일 없이 생성한 합성 계정으로 진행한다.

## 배포

`AUTH_PROFILE=managed-cloud-v1`의 명시적 배포 검사를 추가한다. Cloud URL/키, 서버 비밀의 공개 유출 방지, native-rate-limits 또는 실제 CAPTCHA, 메일 enabled/disabled 명시, Production 기준 ref·origin과 Preview 격리, self-hosted/test 변수 없음, Vercel 대상 일치를 검사한다. 이전 검토용 모드는 false로 전환한다. 전체 기관 운영 인수는 메일/정책이 미완료임을 문서화하며 별도 서버 미설정을 배포 차단 사유로 쓰지 않는다.

Preview DB에 먼저 적용·시험하고 production에는 기존 001~008 이후의 검증된 migration을 순서대로 적용한다. legacy 자료는 삭제하지 않는다. branch별 DB 및 origin을 유지한 채 동일 Git SHA를 preview/main에 push하여 별도 빌드한다. 정적 화면에 build SHA를 노출하는 `/api/version`으로 provenance를 확인한다.

## 검증

비밀번호 누락 문자별 거부/정상 허용, 메일 기능 차단, 환경 분리, RLS 및 privileged key 누출 방지. 실제 Preview에서 합성 학습자/관리자 로그인·TOTP·업무 RPC·비밀번호 변경 후 구세션 거부를 확인한다. 부여된 테스트 데이터만 정리한다. lint/build, 원격 advisors, 두 배포 Ready/SHA/health/최신 hero·폼을 검사한다. 마지막 Git 코드는 동일하되 운영·Preview DB는 분리한다.
