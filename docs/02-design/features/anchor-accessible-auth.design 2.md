# 성인학습자 친화적 인증 상세설계

2026-09-19 · `anchor-accessible-auth`

## 확정된 기준

- 사용자 선택: **12자 이상, 영문 A–Z 또는 a–z 한 글자 이상, 숫자0–9, 특수문자 한 글자 이상**. 대문자·소문자를 각각 요구하지 않는다.
- 신규 이메일 계정 공통 적용. 강사·관리자는 이메일을 ID로 사용하고 역할 승인 흐름은 유지한다.
- 비밀번호 최대128자, 공백은 특수문자로 세지 않는다. ASCII 문장부호를 특수문자로 안내한다. 비밀번호는 trim/소문자변환하지 않는다. Unicode 코드포인트로 최소 길이를 세고 서버 최대 길이도 검증한다.

## 화면과 구성요소

`src/lib/auth/password-policy.ts`에 정책 상수와 순수 조건 함수를 둔다. 가입 서버와 `PasswordField`가 공유한다. 로그인은 기존 비밀번호 입력이므로 조건 체크 목록을 보여주지 않고 보기/숨기기와 입력 안내를 제공한다.

`PasswordField`는 작은 client component다. input과 toggle은 별도 label 연결,44px 이상 버튼, 눈 아이콘+글자, aria-pressed/controls, 기본 숨김. 조건4개를 회색 원/초록 체크와 충족·미충족 상태로 표시한다. aria-live는 조건 충족 개수에만 연결하여 비밀번호 자체를 읽지 않는다. 자동완성·붙여넣기를 허용하고 blur로 필드 그룹을 벗어나면 숨김. input은 uncontrolled로 기존 FormData/폼 reset과 호환하며 DOM reset 이벤트에서 상태도 초기화한다. 제출 시 숨긴다.

이메일 자동 대문자화·철자 교정을 끄고 가입한 이메일이 아이디임을 안내한다. 가입은 미충족 조건을 서버에서도 검사하고 구체적이지만 비밀번호를 포함하지 않는 오류를 반환한다. 정책 확인·동의가 유효해야 실제 가입한다. 로그인은 이메일/길이 기본 검증과 공급자 약한 비밀번호 응답을 확인해 현재 기준에 맞지 않는 성공 세션도 앱에서 signOut한다. 계정 존재 여부를 오류에 노출하지 않는다.

## Auth 설정과 적용 한계

`supabase/config.toml`: minimum_password_length=12, password_requirements="letters_digits". 정확한 문자 조합은 포털 가입/로그인 서버에서 검사한다. 인증 서비스의 기본 프리셋에서 특수문자를 요구하면 대·소문자를 모두 강제하므로 사용자 선택과 충돌한다. 프리셋 외 Docker 환경 수정이나 임의 인증 시스템 전환은 하지 않는다.

**직접 Auth API에서는12자+영문+숫자만 강제되며 특수문자가 빠진 비밀번호 생성/변경을 막지 못한다.** 운영 배포 전 인증 게이트웨이/맞춤 Auth 정책 지원을 검토하고 우회 가입·비밀번호 변경까지 같은 기준을 검증해야 한다. 현재 구현을 인증 서비스 전 구간의 문자 조합 강제 완료라고 보고하지 않는다. Supabase 정책은 기존 비밀번호에 소급 강제되지 않으므로 기존 강사/관리자 재설정·세션 회수 또한 운영 전 조건이다. 이메일 인증·복구·MFA 도입은 기존 운영 준비 항목이다.

## 간편 로그인과 본인확인 도입안

| 수단 | 목적/연동 | 사전 준비 |
|---|---|---|
| 카카오 로그인 | 학습자용 OAuth 로그인, Supabase Kakao provider·PKCE/서버 callback | 카카오 앱·도메인/redirect URI·client secret, 필수 이메일 제공 동의, 가입 동의 단계 |
| 네이버 로그인 | 학습자용 OAuth 로그인, 별도 provider/broker 호환성 검증 | 네이버 앱·서비스 심사·callback·state, 서버 token 교환, 공급자 subject 연결 |
| PASS 본인확인 | 필요한 시점의 실명/휴대전화 소유 확인, 계정 복구 지원 | 본인확인 중계사 계약·도메인 등록·키, 서버 결과 검증, 목적·항목·보유기간 확정 |

소셜 로그인과 실명 본인확인은 별도 사건으로 저장한다. OAuth 성공을 PASS 확인으로 간주하지 않는다. 일반 수강 조회마다 본인확인을 반복 요구하지 않고 이수증 실명 확인·계정 복구 등 사업단이 정한 필요한 단계에 배치한다. PASS앱이 없는 사용자의 SMS 대안은 계약 서비스 지원 여부를 확인한다. 성명/전화번호만으로 계정을 자동 병합하지 않는다. 기존 로그인+재인증+본인 동의를 거쳐 동일 person에 provider subject를 연결하며 학습 이력을 유지한다. 강사·관리자 업무는 검증된 이메일 계정과 별도 강화 인증을 요구하도록 후속 설계한다.

제안 DB: 기존 person/auth 연결 유지, `external_identities(provider, subject, person_id, linked_at, revoked_at)` 유일키(provider,subject), `identity_verification_events(person_id, provider, purpose, transaction_id, verified_at, expires_at, result_code, policy_version)`와 연결/해제 감사기록. 브라우저의 성공 문구 대신 서버 서명·거래ID·nonce·만료·재사용 여부를 검증한다. 원문 응답·주민등록번호·CI/DI는 기본 수집하지 않고 필요한 항목을 별도 확정한다. 이번에는 테이블/버튼/실제 외부 전송을 만들지 않는다.

## 검증

조건별 실패/12자 경계/소문자만·대문자만 허용/공백과 한글이 특수문자를 대체하지 못함/자동완성/붙여넣기/폼 초기화. 로컬 Auth 실제 가입·변경은 짧은 값·숫자 또는 영문 누락 거부, 소문자+숫자+특수문자 성공 및 프리셋 한계도 확인한다. 브라우저 가입 성공·조건 반영·보기 토글·키보드·390px/320px, 기존 인증 검증과 lint/build. 전체 DB 스키마 변경은 없다.

## 확인한 공식 근거

- [Supabase 비밀번호 보안](https://supabase.com/docs/guides/auth/password-security): 강도 설정과 기존 계정의 비밀번호 유지 동작.
- [CLI 구현의 정책 프리셋](https://github.com/supabase/cli/blob/v2.115.0/apps/cli/src/legacy/commands/start/services/gotrue.service.ts): 지원 조합 확인.
- [Supabase 카카오 연동](https://supabase.com/docs/guides/auth/social-login/auth-kakao), [네이버 로그인 명세](https://developers.naver.com/docs/login/api/api.md).
- [PASS 등을 제공하는 Mobile-OK 개발 안내](https://mobile-ok.com/guide/mok_intro/): 기관 신청·통신사 심사·키 필요. 특정 업체 채택 결정은 아니다.
