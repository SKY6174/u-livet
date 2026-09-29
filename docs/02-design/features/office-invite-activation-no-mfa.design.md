# 사업단 등록 계정 활성화 및 MFA 중단 설계

## 기존 경계
- 관리자 수동 등록은 `life_private.manual_members`에 이메일을 저장한다. 이메일 확인 후 `manual_member_claims`와 `life_auth_links`가 연결된다.
- `life_login_context`가 사업단 역할을 서버에서 판단한다. 폼의 audience 값은 권한 근거가 아니다.
- 공개 가입은 `AUTH_SIGNUP_ENABLED`로 차단할 수 있다. 사업단 활성화는 이 플래그와 분리하되 기존 승인된 ACCOUNT_PRIVACY 정책과 동의를 요구한다.

## 변경
1. 관리자 `createMember`는 DB의 멱등 요청 ID로 대학 이메일을 수동 등록한다. 서버가 5분 유효한 단회성 nonce를 `member_auth_permits`에 준비한 다음 service-role `admin.createUser`로 무작위 비밀번호와 nonce를 넣어 Auth 계정을 생성한다. DB 트리거는 nonce·등록 이메일·기관·구분을 검증하고 링크를 만든다. Auth 생성 실패 시 같은 요청 ID로 재시도하고, 이미 같은 person에 링크되었으면 성공으로 처리한다. 다른 계정과 이메일 충돌은 실패한다.
2. 프로비저닝 계정의 최초 무작위 비밀번호는 사용자가 알 수 없고 credential policy version 0으로 기록한다. 로그인 화면의 ‘신규 비밀번호 설정’은 기존 rate-limit·CAPTCHA가 있는 복구 메일 요청으로 연결한다. 메일 링크의 OTP를 검증하고 승인된 개인정보 정책에 본인이 동의한 뒤 새 비밀번호를 저장한다. 이때 version 1이 되며 기존 세션을 무효화한다. 미등록 이메일은 복구 요청으로 Auth 계정이 생성되지 않는다.
3. 사업단·교내 강사의 별도 사인업을 제거한다. 수강생·교외 강사의 공개 가입 옵션과 기존 초대 경로는 유지한다.
4. 신규 migration은 `mfa_required=false`와 유효 세션 기반 `mfa_verified`/`mfa_recent`를 제공한다. 기존 역할·활성계정·비밀번호·실제 세션 검사는 유지한다. 앱의 로그인·보호 페이지는 MFA 화면으로 보내지 않는다.
5. TOTP 신규 등록은 로컬 Auth에서 중단하고 MFA 화면·계정 보안 연결을 숨긴다. 이미 등록된 factor는 삭제하지 않는다.
6. 사업단 로그인 폼 바로 아래에 관리자 등록 → 신규 비밀번호 설정 및 이메일 확인 → 비밀번호 로그인 순서를 설명하고 시작 버튼을 제공한다.

## 검증
- 미등록·미확인·등록 완료 구성원 로그인 및 audience 오용 경계 확인.
- `life_identity`와 관리자 DB 작업의 유효 세션 조건 확인.
- MFA 문구·링크가 로그인 화면에서 사라지고 빌드/타입 검사가 통과하는지 확인.

## 배포 조건
- migration과 운영 Supabase Auth의 이메일 확인 설정을 함께 반영한다. 원격 미적용 시 코드를 배포해도 MFA가 DB에서 계속 요구될 수 있다.
- 새 계정의 메일 발송은 사용자가 ‘신규 비밀번호 설정’을 누를 때 시작된다.
