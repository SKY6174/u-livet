# 카카오 로그인 및 공개 수강생 가입 설계

2026-09-19 · 최신 사용자 결정: 휴대폰 번호 입력 필수, 검증 서비스 미연결, 미인증 저장.

## 화면과 서버

- 로그인·회원가입 화면에 카카오 로그인 버튼. Next Server Action의 동일 출처 검증과 기존 DB 요청 제한을 사용한다. 브라우저에 서비스 키를 보내지 않는다.
- Supabase SSR PKCE를 사용한다. 고정 AUTH_SITE_ORIGIN의 `/auth/callback`에서 code를 교환한다. 외부 next·인증 경로 순환을 차단하고 제공자 오류 원문·토큰을 노출하지 않는다.
- 신규 카카오 로그인은 `/auth/complete-signup`에서 이름·휴대폰 번호·개정 문안 필수 동의를 받는다. DB 검증 이후에만 수강생 identity가 생긴다. 전화번호 010 및 기존 01x 국내 이동통신 번호를 +82 형식으로 정규화한다.
- 이메일 가입에도 같은 번호 입력·동의가 필요하다. 기존 초대 계정의 비밀번호 설정·MFA는 유지한다.
- 로그인한 업무 역할 계정은 이메일·비밀번호 방식으로 안내한다. 수강생은 카카오로 로그인 후 자신의 원래 화면으로 이동한다.

## DB 신뢰 경계

- `life_private.signup_settings`: 고정 조직과 현재 가입 문안, 공개 개방 여부. 브라우저 직접 권한 없음. DB와 앱 개방 플래그 모두 필요.
- `life_private.learner_contacts`: Auth 사용자 FK, 정규화된 phone, phone_verified_at(null), 가입 출처, 정책 ID, 생성 시각. RLS 활성·브라우저 직접 읽기/쓰기 금지. 휴대폰 번호는 유일성이나 동일인 식별 근거가 아니다.
- 신규 카카오 Auth insert는 서버 관리 app_metadata.provider를 검사해 대기 계정만 생성한다. 앱 프로필/권한은 만들지 않는다. 이메일 가입은 승인 문안과 이름·번호·동의를 트리거에서도 검증한다. 기존 초대 흐름은 현재 동의 규칙 유지.
- `life_registration_status`와 `life_complete_registration`은 자기 세션만 대상으로 한다. auth.uid + auth.sessions의 생존·만료·비밀번호 변경 시점·사용자 정지 확인. JWT와 DB AMR의 OAuth 증거 및 auth.identities의 Kakao 연결이 필요하다. user_metadata로 권한을 판정하지 않는다.
- 완료 RPC는 사용자 행 잠금으로 재시도 멱등성을 보장한다. 역할은 부여하지 않는다. 입력한 번호는 검증 완료로 승격할 수 없다. 승인된 설정 문안과 동의를 검증하고 person/link/contact/consent를 원자적으로 기록한다.
- 기존 `person_id`와 `auth_status`에 OAuth 수강생 경로를 추가한다. 현재 유효한 업무 역할(강사 포함)이 하나라도 있으면 OAuth 세션은 거부한다. 비밀번호 경로의 credential policy·세션 폐기·MFA를 그대로 적용한다. OAuth 수강생도 설정한 TOTP가 있으면 MFA가 필요하다.

## 개방과 개인정보

- 기존 ACCOUNT-2026-09-19-v1 동의 기록은 변경하지 않는다. 휴대폰 필수 입력·미인증 처리, 카카오 회원 식별자/동의된 이메일, 가입 미완료 계정의 삭제 창구를 포함한 v2를 별도 등록한다.
- 사용자 승인 후 설정의 policy_id를 v2로 지정한다. UI와 DB가 같은 문안을 선택하며 구버전으로 새 가입을 우회할 수 없다.
- 제공자 연결·DB 마이그레이션·회귀 검사 후 Vercel 플래그 및 Supabase 신규 가입을 개방한다. 본인확인 서비스는 연결하지 않는다.

## 검증

- SQL 트랜잭션 fixture: 가입 전 identity 없음, 번호/동의/구문안 거절, 정상 완료 및 재시도, 전화번호 미인증 유지, 역할 조작 불가, 업무 OAuth 차단, 비밀번호·MFA·정지·세션 만료·폐기 회귀, 익명/다른 계정 직접 접근 차단.
- 서버 단위: PKCE 오류/제공자 취소, 고정 callback origin, next 검증, 닫힌 가입, 이름/번호/동의 검사, 정보 저장 실패시 접근 차단.
- lint/build, 실제 브라우저 모바일·데스크톱, 배포된 버튼과 Kakao authorize redirect 확인. 실제 카카오 계정 동의/전체 로그인은 사용자 본인 수행이 필요하면 미검증 범위를 명시한다.
