# 관리자 MFA·최근 인증 설계

2026-09-19 · `anchor-admin-mfa`

## 인증과 권한 경계

기존 `life_auth_status`는 계정의 활성 상태와 비밀번호 재설정 필요 여부를 유지하며 MFA 상태를 추가한다. 현재 사용자의 활성 역할 중 INSTRUCTOR 이외 역할이 있으면 `staff_required=true`. 일반 계정도 verified TOTP factor를 등록했다면 `mfa_required=true`다. 역할이나 MFA 여부를 user_metadata에서 읽지 않는다.

`life_private.mfa_verified()`는 signed JWT의 aal2, 현재 auth.sessions의 aal2, 동일 사용자·session_id, session.factor_id에 연결된 verified TOTP factor를 모두 요구한다. `person_id()`는 기존 비밀번호 정책·활성계정·실제세션 조건에 더해 MFA 필요 시 이 검사를 요구한다. 따라서 모든 기존 RLS/RPC의 본인/역할 조회가 같은 통제를 사용한다. 첫 등록·복구·로그아웃을 위한 최소 Auth 화면은 person_id 없이 실제 getUser+auth_status로 접근한다.

`life_private.mfa_recent()`는 verified 검사를 통과하고 DB AMR의 실제 totp 인증 updated_at과 JWT amr(method=totp)의 timestamp가 모두 최근15분인지 확인한다. 갱신 토큰의 iat는 사용하지 않는다. 오래된 JWT가 다른 탭의 새 인증만으로 다시 살아나지 않도록 JWT도 자체 최근 인증을 포함해야 한다.

현재 public의 모든 일반 `life_` 테이블에 BEFORE STATEMENT INSERT/UPDATE/DELETE guard를 부착한다. 현재 Auth 사용자가 활성 사업단 역할이면 최근 MFA를 요구한다. RLS 또는 각 RPC의 기존 담당기관/위임/자기승인 금지는 그대로 적용한다. 이 범위는 수납·환불·증명·배지·문자·성과·이력/개발 심사·수료 등 관리자 저장과 감사 이벤트를 남기는 내려받기를 포함한다. 일반 학습자/강사의 업무 규칙은 유지한다. service_role/DB 소유자의 서버 작업은 신뢰된 별도 경계이며 일반 사용자에게 키를 노출하지 않는다. 후속 life_ 테이블도 동일 guard 부착 검사를 migration 검증에 포함해야 한다.

## 화면·서버 동작

`/auth/security?next=...`는 이메일·현재 상태·다음 행동을 표시한다. 등록된 인증 앱이 없으면 **인증 앱 연결하기** 버튼을 눌러 native enroll(TOTP)한다. QR·수동키는 서버에 별도 저장하지 않고 브라우저 메모리에만 표시한다. 안내는1. 인증 앱 열기2. QR 스캔/키 입력3.6자리 코드 입력. 같은 휴대전화 사용자는 수동키 보기/복사로 등록할 수 있다. QR/키는 공유하지 않도록 짧게 안내한다.

기등록 사용자는 factor 선택과6자리 입력으로 challengeAndVerify한다. 서버 쿠키를 native SSR client로 갱신하고 DB 상태를 재확인한다. 가입·인증 성공 전에는 완료 상태를 표시하지 않는다. 코드·키는 URL/로그/analytics/로컬스토리지에 넣지 않는다. 검증 오류는 큰 글씨로 다시 입력 안내하며 pending 중 중복 제출을 방지한다.

추가 factor 등록과 verified factor 삭제는 포털에서 최근 MFA 필요. 관리자는 마지막 verified factor 삭제를 제공하지 않고 교체 앱을 먼저 등록하게 한다. Auth native API 자체의 factor 관리 AAL2 요구도 유지한다. 앱을 삭제하거나 세션이 downgrade되면 기존 JWT의 데이터 접근도 현재 DB 상태로 막는다. 앱 추가/확인/삭제 감사는 native Auth audit log를 사용하며 비밀키·코드를 업무 로그에 복제하지 않는다.

추가 보강: native Auth의 AAL2만으로는 오래된 세션에서 새 factor를 등록할 수 있으므로 auth.mfa_factors INSERT/DELETE에도 DB guard를 둔다. 인증된 계정이 `life_prepare_mfa_change`에서1분 유효·일회용·사용자/세션/작업/factor에 묶인 허가를 받고, enrollment의 friendly_name에 opaque 허가 식별자를 전달한다. 기존 MFA 계정은 최근 인증 없이는 허가를 받을 수 없다. 첫 등록은 활성 계정·현 비밀번호 정책·실제 세션을 요구한다. native INSERT/DELETE는 허가를 소비하고 세션과 실제 최근 인증을 재확인한다. 검증된 관리자 마지막 factor 해제는 DB에서도 거부한다. 미완료 연결 취소는 허가가 필요 없다. 초기 등록 이력은 비공개로 보관하며 인증된 일반 사용자가 마지막 앱을 적법하게 해제한 때만 지운다.

분실 복구의 예외는 DB 소유자 세션에서 승인된 대상의 `life.mfa_recovery_user` transaction 설정을 사용하는 신뢰된 수동 작업뿐이다. native Auth 연결이나 앱 RPC로 이 설정을 부여하지 않는다. 승인 근거·실행자·시각 기록, 세션 회수, factor·초기 등록 이력 정리 및 재등록을 한 절차로 관리한다. Auth 사용자 삭제의 정상 cascade는 유지한다.

로그인 후 MFA가 필요하면 identity 조회 실패로 로그아웃시키지 않고 security 화면으로 안내한다. 보호 페이지의 requireIdentity도 같은 안내로 연결한다. 복귀 주소는 기존 safeReturnTo를 적용하고 인증 경로로의 반복 이동은 mypage로 정규화한다. 일반 학습자도 나의 공간에서 선택적으로 연결한다.

최근 인증 만료로 실패한 ActionForm은 입력을 유지한다. 공통 오류 문구와 새 창 **추가 인증하기** 링크를 제공한다. 새 창에서 인증을 마친 뒤 원래 화면에서 저장을 다시 눌러 사용자가 의도한 작업을 확인한다. 자동 저장/승인은 하지 않는다.

## 인증 화면 표시 조정 · 2026-09-21

- 이메일 아래의 관리자 필수·수강생/강사 선택 인증 안내 문단을 삭제한다.
- 분실·복구 도움말은 `details`/`summary`로 제공하고 처음에는 접어 둔다. 제목을 클릭하거나 키보드로 펼치면 기존 복구 설명과 문의 담당자 정보를 볼 수 있다.
- 6자리 코드 도움말은 입력란 위의 레이블 오른쪽에 배치하고 16px에서 14px로 줄인다. 좁은 화면에서는 레이블 아래로 줄을 바꾸되 입력란 위에 유지한다. 입력란의 `aria-describedby` 연결을 보존한다.
- 인증 정책, 검증·복귀 동작 및 담당자 권한은 변경하지 않는다.

### 인증 앱 선택과 6칸 코드 입력

- `확인할 인증 앱`과 `인증 앱의 6자리 코드`는 기존 16px에서 18px로 키우고 굵게 표시한다.
- 인증 앱 선택은 제목 오른쪽의 선택창으로 이동한다. 제공되는 이름·등록 시각을 표시하며 알 수 없는 휴대폰 앱 버전 번호는 생성하지 않는다. 추가 버튼은 같은 영역의 맨 오른쪽에 배치하고 최근 인증·pending 비활성화 조건을 유지한다. 작은 화면에서는 겹치지 않게 줄바꿈한다.
- 6칸은 화면 표시이며 실제 입력은 하나의 native text input을 유지한다. 숫자는 30px 굵은 고정폭 글자로 표시하고, 현재 입력·선택 위치를 강조한다. 각 칸 클릭, 방향키·Backspace·전체 선택, 코드 붙여넣기, `one-time-code` 자동완성을 지원한다.
- 웹 화면(640px 이상)에서는 6칸 묶음을 기존 전체 입력 폭의 60%로 줄여 가운데 정렬한다. 모바일에서는 전체 폭을 유지한다. 각 칸의 숫자는 가로·세로 가운데 표시한다.
- 숫자 외 문자를 제거하고 최대 6자리만 보관한다. 입력 중 자동 제출하지 않고 기존 확인 버튼으로 제출한다. 레이블·도움말 연결과 서버의 정확한 6자리 검증을 보존한다.

## 분실·복구

native Auth는 MFA 계정의 비밀번호 변경에도 AAL2를 요구한다. 기존 reset-password 폼에 인증 앱 사용자용6자리 입력을 추가한다. 비영속 recovery client가 이메일 증명→등록된 TOTP 확인→비밀번호 변경 순서로 처리한다. 여러 앱 중 하나의 코드가 맞으면 된다. 공급자 시도 제한은 유지하며429면 즉시 중단한다. 코드가 없거나 틀려 이메일 토큰이 소비됐다면 새 메일과 현재 코드를 요청한다. 인증 앱 미등록 계정은 코드 없이 기존 복구 흐름을 유지한다.

인증 앱을 사용할 수 없으면 사업단의 지정 지원 담당자에게 연락하도록 안내한다. 이메일 비밀번호 재설정은 MFA를 제거하지 않는다. 운영 담당자는 기관의 승인된 본인 확인·서로 다른 승인자 확인·사건 번호·실행자/시각을 기록하고, 신뢰된 관리 경로에서 모든 세션 회수 및 해당 factor 제거 후 재등록하도록 한다. 앱은 신원 확인을 대신하거나 긴급 우회 관리자 계정을 생성하지 않는다. 이 절차는 운영 승인 전 가이드이며 자동 처리 UI는 제공하지 않는다. 미리 다른 인증 앱/기기를 추가하여 한 기기 분실에 대비할 수 있다.

## 로컬 검증·운영

config.toml TOTP 활성화. 기존 configure-auth-local 도구에 공식 MFA TOTP env 설정을 추가하여 정확한 비밀번호 조건과 함께 재현한다. 다른 서비스·프로젝트·원격 Auth는 변경하지 않는다.

가상 회귀 계정은 공통 local helper로 native TOTP를 검증한 후 업무 검사를 실행한다. helper는55321 및 example.invalid를 확인하고 합성 계정 전용 factor와 임시0600 파일만 사용한다. 실제 사용자 비밀키는 읽지 않는다. 테스트용 TOTP 계산은 검증 스크립트에만 존재하며 제품 코드에서는 native Auth에 검증을 맡긴다.

검사: 관리자 AAL1/미등록 거부, 학습자 선택 유지, 등록/틀린코드/검증/소비된 challenge 재사용, 타 계정 factor 거부, metadata 위조·직접 RPC 우회 방지,15분 만료·refresh 연장 방지·재검증 복구, 삭제 factor와 비밀번호 복구 경계, 각 업무 회귀 및 guard 누락 조회, DB advisor·lint/build·브라우저/320px.

공식 근거: [TOTP 등록/확인](https://supabase.com/docs/guides/auth/auth-mfa/totp), [MFA와 AAL](https://supabase.com/docs/guides/auth/auth-mfa), [세션](https://supabase.com/docs/guides/auth/sessions). 구현 전 changelog와 현재 로컬 Auth 테이블/SDK를 확인했다.
