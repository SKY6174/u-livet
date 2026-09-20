# 이용자별 로그인과 소셜 제공자 연결

## 현재 제공 범위

로그인 화면에서 사업단 / 강사(교내) / 강사(교외) / 수강생을 선택한다. 버튼 선택으로 권한이 부여되지는 않는다. 로그인 후 서버에 등록된 역할·직책·강사 구분을 확인한다.

- 사업단: 등록 이메일과 U-LIFE 비밀번호. 단장·센터장·연구원은 관리자가 저장한 직책을 표시한다. 기존 MFA와 업무 권한은 유지한다.
- 교내 강사: 인증된 `@uc.ac.kr` 이메일과 U-LIFE 전용 비밀번호. 학교 포털 비밀번호와 별개이며, 초대 메일에서 처음 설정하고 ‘비밀번호 찾기’에서 재설정한다. 이메일 입력만으로 강사 자격이 생기지 않는다.
- 교외 강사: 카카오 또는 기존 이메일 로그인. 승인된 강사 역할이 있어야 강사 업무를 이용한다. 신규 가입자는 기본 회원으로 등록하고 강사 이력을 제출한다.
- 수강생: 카카오 또는 이메일 가입·로그인. 휴대폰 번호 입력은 필수지만 현재 본인확인 서비스는 연결하지 않으며 미인증으로 저장한다.
- 네이버·구글: 버튼과 서버 연결 경로를 준비했으며 현재 **준비 중**으로 비활성화한다. 실제 개발자 앱과 인증 설정 없이 켜지 않는다.

기존 이메일 계정과 소셜 계정의 이메일이 다르면 별도 계정이 생길 수 있다. 담당자가 이력·본인 여부를 확인하기 전 임의로 합치거나 역할을 복사하지 않는다.

## 사업단 직책·강사 구분 관리

시스템 관리자 로그인 후 ‘나의 공간 → 사업단 직책·강사 구분 관리’(`/admin/accounts`)에서 이미 등록된 업무 계정의 구분을 저장한다. 최근 MFA가 필요하며 기관별 SYSTEM_ADMIN 범위 내에서만 수정한다. 이 화면은 역할 자체를 부여하지 않는다.

기존 송경영 계정(`kysong@uc.ac.kr`)은 단장으로 등록한다. 현용환 센터장, 이연향·이현섭 연구원은 해당 계정과 역할이 등록된 뒤 직책을 지정한다. 이름만으로 계정을 연결하지 않는다. 교내로 변경하려면 해당 계정의 학교 이메일 인증이 완료되어야 한다.

## 환경별 연결 주소

| 환경 | 홈페이지 | Supabase 기본 OAuth callback |
| --- | --- | --- |
| 운영 | https://uc-life.org | https://uoebygejgglgiivzgyks.supabase.co/auth/v1/callback |
| 스테이징 | https://staging.uc-life.org | https://bfqwntulxabfrimcypvx.supabase.co/auth/v1/callback |

외부 제공자의 Redirect URI는 Supabase 대시보드에 표시된 **해당 제공자의 callback URL을 그대로 복사**한다. 앱의 `/auth/callback`은 Supabase 인증 이후 돌아오는 주소이므로 구분한다. Supabase Redirect URLs에는 해당 홈페이지의 `/auth/callback` 복귀 주소를 허용한다.

## 구글 연결 순서

1. Google Cloud에서 프로젝트와 OAuth 동의 화면을 만들고 서비스명·지원 이메일·승인 도메인·개인정보처리방침 URL을 등록한다.
2. 웹 애플리케이션 OAuth 클라이언트를 만든다. 홈페이지 origin과 위 Supabase callback을 정확히 등록한다. 스테이징과 운영은 구분하여 관리한다.
3. 각 Supabase 프로젝트의 Authentication → Sign In / Providers → Google에 Client ID와 Secret을 저장한다. 필요한 범위는 계정 식별 및 동의된 이메일로 한정한다.
4. 테스트 사용자와 게시 상태를 확인한다. Google 테스트 모드에서는 등록된 테스트 사용자만 이용할 수 있다.
5. 아래 공통 개방 절차를 완료한 뒤 Vercel 해당 환경에 `AUTH_GOOGLE_ENABLED=true`를 설정하고 재배포한다.

공식 안내: https://supabase.com/docs/guides/auth/social-login/auth-google

## 네이버 연결 준비

1. 네이버 개발자 센터에서 ‘네이버 로그인’ 애플리케이션을 등록하고 서비스 URL·callback·이용 목적·개인정보처리방침을 준비한다. 검수와 이용 가능 범위를 확인한다.
2. Supabase Custom OAuth Provider 사용 가능 여부를 확인하고 식별자를 `naver`로 준비한다. 앱 코드가 요청하는 제공자는 `custom:naver`이다.
3. 공식 네이버 OAuth endpoint: 인가 `https://nid.naver.com/oauth2.0/authorize`, 토큰 `https://nid.naver.com/oauth2.0/token`, 사용자 정보 `https://openapi.naver.com/v1/nid/me`.
4. **네이버 사용자 정보는 `response.id`, `response.email`처럼 중첩된다.** Supabase 사용자 정보 매핑이 이를 처리하는지 실제 설정과 응답으로 확인해야 한다. 직접 호환되지 않으면 검증된 변환 어댑터를 추가해야 하므로 endpoint 입력만으로 연동 완료라고 판단하지 않는다. 현재 어댑터는 구현하지 않았다.
5. Supabase가 보여주는 custom provider 전용 callback을 네이버에 정확히 등록한다. Client Secret은 Supabase 또는 서버 비밀 저장소에만 저장한다.
6. 식별자·이메일·PKCE·callback·동의 거절·계정 연결까지 스테이징에서 검증한 뒤 공통 개방 절차와 `AUTH_NAVER_ENABLED=true` 설정·재배포를 진행한다.

공식 안내: https://supabase.com/docs/guides/auth/custom-oauth-providers · https://developers.naver.com/docs/login/api/api.md

## 공통 개방 절차

현재 승인된 ACCOUNT-2026-09-19-v2 문안의 제공자 설명은 카카오 기준이다. 구글·네이버를 열기 전에 실제 처리 항목·제공자·보유기간을 반영한 새 문안을 승인하고 DB에 적용한다. 기존 수강생에게 새 제공자 동의를 일괄 부여하지 않는다.

스테이징에서 신규 가입, 기존 이메일 계정 연결, 기존 강사 이력 보존, 사업단·교내 소셜 접근 차단, 로그인 취소, 로그아웃을 검증한다. 운영 설정은 검증 후 별도로 반영한다. 제공자 Secret을 브라우저용 환경변수, Git, 채팅, 로그에 넣지 않는다. 화면 플래그만 변경하거나 공급자 설정만 켜서 개방하지 않는다.
