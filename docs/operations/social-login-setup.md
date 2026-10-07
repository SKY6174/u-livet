# 이용자별 로그인과 소셜 제공자 연결

## 현재 제공 범위

로그인 화면에서 사업단 / 강사(교내) / 강사(교외) / 수강생을 선택한다. 버튼 선택으로 권한이 부여되지는 않는다. 로그인 후 서버에 등록된 역할·직책·강사 구분을 확인한다.

- 사업단: 등록 이메일과 U-LIFE 비밀번호. 단장·센터장·연구원은 관리자가 저장한 직책을 표시한다. 기존 MFA와 업무 권한은 유지한다.
- 교내 강사: 인증된 `@uc.ac.kr` 이메일과 U-LIFE 전용 비밀번호. 학교 포털 비밀번호와 별개이며, 초대 메일에서 처음 설정하고 ‘비밀번호 찾기’에서 재설정한다. 이메일 입력만으로 강사 자격이 생기지 않는다.
- 교외 강사: 카카오·네이버·Google 또는 기존 이메일 로그인. 승인된 강사 역할이 있어야 강사 업무를 이용한다. 신규 가입자는 기본 회원으로 등록하고 강사 이력을 제출한다.
- 수강생: 카카오·네이버·Google 또는 이메일 가입·로그인. 휴대폰 번호 입력은 필수지만 현재 본인확인 서비스는 연결하지 않으며 미인증으로 저장한다.
- Google: 운영에서 제공 중이며 `openid email`만 요청한다. 적용 기록은 `google-login-rollout.md`에 있다.
- 네이버: 운영에서 `AUTH_NAVER_ENABLED=true`와 Supabase `custom:naver`를 사용한다. 검수 전에는 네이버 개발자센터의 애플리케이션 등록자·관리자·테스터 계정으로 인증 과정을 확인한다. 실제 확인 범위는 `naver-login-rollout.md`에 기록한다.

기존 이메일 계정과 소셜 계정의 이메일이 다르면 별도 계정이 생길 수 있다. 담당자가 이력·본인 여부를 확인하기 전 임의로 합치거나 역할을 복사하지 않는다.

## 사업단 직책·강사 구분 관리

시스템 관리자 로그인 후 ‘나의 공간 → 사업단 직책·강사 구분 관리’(`/admin/accounts`)에서 이미 등록된 업무 계정의 구분을 저장한다. 최근 MFA가 필요하며 기관별 SYSTEM_ADMIN 범위 내에서만 수정한다. 이 화면은 역할 자체를 부여하지 않는다.

기존 송경영 계정(`kysong@uc.ac.kr`)은 단장으로 등록한다. 현용환 센터장, 이연향·이현섭 연구원은 해당 계정과 역할이 등록된 뒤 직책을 지정한다. 이름만으로 계정을 연결하지 않는다. 교내로 변경하려면 해당 계정의 학교 이메일 인증이 완료되어야 한다.

## 환경별 연결 주소

| 환경 | 홈페이지 | Supabase 기본 OAuth callback |
| --- | --- | --- |
| 운영 | https://u-livet.org | https://uoebygejgglgiivzgyks.supabase.co/auth/v1/callback |
| 스테이징 | https://staging.u-livet.org | https://bfqwntulxabfrimcypvx.supabase.co/auth/v1/callback |

외부 제공자의 Redirect URI는 Supabase 대시보드에 표시된 **해당 제공자의 callback URL을 그대로 복사**한다. 앱의 `/auth/callback`은 Supabase 인증 이후 돌아오는 주소이므로 구분한다. Supabase Redirect URLs에는 해당 홈페이지의 `/auth/callback` 복귀 주소를 허용한다.

## 구글 연결 순서

1. Google Cloud에서 프로젝트와 OAuth 동의 화면을 만들고 서비스명·지원 이메일·승인 도메인·개인정보처리방침 URL을 등록한다.
2. 웹 애플리케이션 OAuth 클라이언트를 만든다. 홈페이지 origin과 위 Supabase callback을 정확히 등록한다. 스테이징과 운영은 구분하여 관리한다.
3. 각 Supabase 프로젝트의 Authentication → Sign In / Providers → Google에 Client ID와 Secret을 저장한다. 앱의 Google 요청은 `queryParams.scope=openid email`, `include_granted_scopes=false`로 제한한다. `options.scopes`는 기본 profile 범위에 추가되므로 축소 목적으로 쓰지 않는다. 실제 인가 URL과 로그인 후 데이터로 확인한다.
4. 대상 사용자·게시 상태·조직 제한을 확인한다. Google 공식 안내에 따르면 기본 이름·이메일·프로필 범위만 사용하는 로그인은 Testing의 테스트 사용자 목록 및 7일 만료 제한 예외에 해당한다. 다른 범위를 추가하면 예외가 적용되지 않는다. 브랜딩 검증은 별도로 확인한다. https://support.google.com/cloud/answer/15549945
5. 아래 공통 개방 절차를 완료한 뒤 Vercel 해당 환경에 `AUTH_GOOGLE_ENABLED=true`를 설정하고 재배포한다.

공식 안내: https://supabase.com/docs/guides/auth/social-login/auth-google

## 네이버 연결과 검수 과정

1. 네이버 개발자센터에서 서비스 URL `https://u-livet.org`, 개인정보처리방침 `https://u-livet.org/privacy`를 등록한다. 운영 인가 요청에서 확인한 callback은 `https://uoebygejgglgiivzgyks.supabase.co/auth/v1/callback`이다.
2. 제공 정보는 회원 식별자와 이메일로 제한한다. 이름과 휴대폰은 U-LIFE 가입 화면에서 입력받는다. 네이버 앱의 불필요한 이름·별명·프로필사진·성별·생일·연령·출생연도·휴대폰 제공 항목은 해제한다.
3. Supabase의 식별자는 `naver`, 앱이 요청하는 값은 `custom:naver`이다. 기존 Client ID와 Secret을 유지한다.
4. 인가 URL은 `https://nid.naver.com/oauth2.0/authorize`, 토큰 URL은 `https://nid.naver.com/oauth2.0/token`, 사용자 정보 URL은 **`https://u-livet.org/api/auth/naver/userinfo`**로 설정한다. scope는 빈 목록이다. OAuth2 제공자이므로 OIDC discovery나 JWKS는 사용하지 않는다.
5. 사용자 정보 변환 경로가 네이버의 `https://openapi.naver.com/v1/nid/me`를 Bearer 토큰으로 확인한 후 평탄한 `sub`, `email`, `email_verified`만 반환한다. Supabase attribute mapping은 `sub`와 `email`만 같은 이름으로 연결한다. `email_verified`는 보호 필드로 별도 매핑하지 않고 응답의 false 값을 그대로 읽는다. `response.id` 같은 중첩 경로를 직접 매핑하지 않는다.
6. 네이버는 이메일 확인 상태를 제공하지 않아 `email_verified=false`로 처리한다. 네이버 제공자만 `email_optional=true`로 설정해 회원 식별자로 가입 대기 OAuth 세션을 발급한다. 신규 회원은 U-LIFE 가입 화면에서 원하는 이메일을 입력하고 메일의 인증번호로 확인한다. 확인 후 이름·휴대폰·명시적 개인정보 동의를 완료해야 회원 기능을 이용한다. Supabase 전역 자동 확인과 미확인 이메일 로그인 설정은 변경하지 않는다.
7. `AUTH_NAVER_ENABLED=true`를 운영에 설정하고 재배포한다. 스테이징은 별도 설정·검증 후 활성화한다.

검수용 캡처 순서:

1. `https://u-livet.org/auth/login?audience=learner`의 활성화된 네이버 로그인 버튼.
2. 버튼을 눌러 열린 네이버 로그인 화면에서 등록자·관리자 또는 테스터 계정으로 인증.
3. 네이버 정보 제공 동의 화면과 동의한 항목.
4. 신규 회원은 U-LIFE에서 사용할 이메일을 직접 입력하고 인증 메일의 숫자 코드를 가입 화면에 입력한다. 인증번호와 링크는 제출 이미지에서 가린다.
5. 최초 회원이라면 U-LIFE 이름·휴대폰 입력과 개인정보 동의 화면. 동의는 이용자가 직접 한다.
6. 가입 완료 후 나의 공간 또는 QR로 시작한 경우 해당 입실 확인 화면. 기존 회원은 가입 화면을 건너뛴다.

네이버 인증 성공이 강사 권한·수강 확정·출석 확정을 의미하지 않는다. 검수 자료에는 실제 수행한 과정만 제출한다.

공식 안내: https://supabase.com/docs/guides/auth/custom-oauth-providers · https://developers.naver.com/docs/login/api/api.md · https://developers.naver.com/docs/login/profile/profile.md

## 공통 개방 절차

운영 ACCOUNT-2026-09-22-v6 문안은 카카오·네이버·Google의 실제 처리 항목·제공자·보유기간을 반영한다. 후속 변경도 새 문안 버전으로 적용한다. 기존 수강생에게 새 제공자 동의를 일괄 부여하지 않는다.

스테이징에서 신규 가입, 기존 이메일 계정 연결, 기존 강사 이력 보존, 사업단·교내 소셜 접근 차단, 로그인 취소, 로그아웃을 검증한다. 운영 설정은 검증 후 별도로 반영한다. 제공자 Secret을 브라우저용 환경변수, Git, 채팅, 로그에 넣지 않는다. 화면 플래그만 변경하거나 공급자 설정만 켜서 개방하지 않는다.
