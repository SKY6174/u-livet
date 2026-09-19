# 카카오 로그인 및 공개 회원가입 운영

2026-09-19 사용자 결정: 휴대폰 번호 필수 입력, 인증 연결 보류, 미인증 저장. ACCOUNT-2026-09-19-v2 문안은 대화에서 운영·스테이징 적용 승인됨. 본인 가입 동의는 화면에서 각 이용자가 수행한다.

## 현재 흐름

로그인/회원가입 → 카카오 인증 → /auth/callback PKCE 교환 → /auth/complete-signup → 이름·휴대폰·개인정보 동의 → 수강생 계정. 이미 완료한 계정은 요청했던 화면으로 돌아간다. 이메일 가입 역시 전화번호 입력과 동의가 필요하다. 수강생 가입은 업무 역할을 부여하지 않는다.

강사·운영자·관리자는 이메일/비밀번호 로그인 사용. Supabase가 확인된 이메일을 기준으로 카카오 identity를 연결하더라도 해당 OAuth 세션으로 업무 권한을 사용하지 못한다. 기존 비밀번호 변경 시 세션 폐기, TOTP 설정 및 최근 추가 인증 요구를 유지한다.

전화번호는 life_private.learner_contacts에 +82 형식으로 저장한다. phone_verified_at은 null만 허용한다. 인증 완료·중복인 판정·계정 복구 근거로 사용하지 않는다. 향후 SMS/PASS 연결은 별도 요구사항과 문안 변경이 필요하다. 신규 소셜 제공자(네이버·Google)는 이번 구현에 포함되지 않는다.

## 설정 및 개방 순서

1. `20260919053031_anchor_kakao_signup.sql` 적용. 초기 설정은 닫힌 상태다.
2. 고정 앵커 조직에 승인 문안 등록. 기존 승인 문안/동의 기록은 수정하지 않는다. `life_private.signup_settings.policy_id`를 승인된 v2로 지정하고 enabled=true 설정. UI는 `life_signup_policy`로 지정된 문안을 가져온다.
3. Supabase Kakao provider 설정 및 Redirect URL 허용: 운영 `https://uc-life.org/auth/callback**`, 스테이징 `https://staging.uc-life.org/auth/callback**`. 기존 reset/invitation URL은 유지한다.
4. Vercel AUTH_SIGNUP_ENABLED=true, AUTH_EMAIL_ENABLED=true. 각 환경 AUTH_SITE_ORIGIN은 자신의 메인 도메인. 운영/스테이징 DB와 키는 각각 분리한다.
5. 같은 기능 변경을 main/preview에 반영하고 배포를 확인한다. Supabase disable_signup=false로 신규 가입을 개방한다. external_phone_enabled는 false로 유지한다.

카카오 개발자 앱의 Redirect URI는 각 Supabase의 `/auth/v1/callback`이다. 홈페이지의 `/auth/callback`과 구별한다. 비밀키/사용자 토큰을 문서·로그·Git에 저장하지 않는다.

## 검증

- `node scripts/verify-kakao-signup.mjs`: 입력/return URL/OAuth 액션/상태별 이동/권한 입력 제거.
- `node scripts/verify-signup-gate.mjs`: 가입 플래그/메일/정확한 현재 문안/동의 검사.
- `scripts/verify-kakao-signup.sql`: 합성 계정 기반 34 DB 경계 검사. 반드시 BEGIN/ROLLBACK 안에서 실행한다. 실제 이용자 정보나 동의 기록을 만들지 않는다. 깨끗한 적용 직후 또는 테스트 트랜잭션 안에서 설정 enabled=false를 먼저 설정한 환경에 사용한다.
- 로컬 이전 self-hosted fixture는 managed-cloud-auth/session-status SQL을 같은 트랜잭션에서 먼저 적용해야 운영 구조와 일치한다.
- `node scripts/verify-mfa-navigation.mjs`, `node scripts/verify-managed-cloud.mjs`, lint/build.
- 데스크톱/390px 화면, 카카오 인증 시작, 콜백 오류/취소, 실제 사용자 로그인 완료 확인.

Supabase 보안 점검은 경고/오류 없이 private table의 의도적인 기본 거부(RLS 정책 없음) 정보 항목만 관찰됐다. 이 테이블들은 브라우저 직접 권한을 취소하고 좁은 자기 계정 RPC로만 처리한다.

## 가입 일시 중단

Supabase disable_signup=true, DB signup_settings.enabled=false, Vercel AUTH_SIGNUP_ENABLED=false 및 재배포로 신규 가입을 중단할 수 있다. 이미 가입한 사용자의 로그인까지 임의로 정지하지 않는다. 기존 사용자와 동의 증빙이 있으므로 다운 마이그레이션이나 테이블 삭제를 롤백 수단으로 사용하지 않는다.
