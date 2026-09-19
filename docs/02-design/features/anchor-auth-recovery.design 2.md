# 인증 정책·복구 상세설계

2026-09-19 · `anchor-auth-recovery`

## 인증 엔진의 동일 정책

Supabase Auth 공식 `GOTRUE_PASSWORD_REQUIRED_CHARACTERS`는 콜론으로 나눈 집합을 모두 요구한다. 영문 대소문자를 하나의 집합, 숫자와 ASCII 문장부호를 각각의 집합으로 설정한다. 최소12자는 기존 설정과 동일하다. 문자 `:`는 공식 escape 규칙으로 처리한다.

CLI 프리셋은 그대로12자+영문·숫자를 유지하고 `scripts/configure-auth-local.mjs`로 전용 로컬 Auth 컨테이너의 환경설정을 추가 적용한다. Docker UNIX socket·프로젝트 라벨·API55321·고정 컨테이너 이름을 확인한다. 기존 Config/HostConfig/네트워크 alias를 보존하고 원 컨테이너를 백업 이름으로 정지·보관한 상태에서 새 컨테이너를 시작한다. 정상 health 확인 후 백업을 제거하고 실패하면 원래 컨테이너를 되돌린다. 환경변수·키는 메모리에만 두고 출력/파일 저장하지 않는다. 이미 같은 설정이면 아무것도 교체하지 않는다. 로컬 start/reset 이후 재적용하며 dev 실행도 이 도구를 먼저 확인한다.

이는 자체 암호 검증 구현이 아니라 기존 Auth 엔진 설정이다. 운영 Supabase hosted의 관리 API enum/프리셋과 같다고 가정하지 않는다. 실제 운영 배치는 사용자 지정 환경설정이 가능한 Auth 배치 또는 공급자가 지원하는 동등한 통제의 별도 확인이 필요하다. 원격 변경은 하지 않는다.

## 복구 화면과 메일

`/auth/forgot-password`: 이메일 입력·재설정 메일 요청. 이메일 형식은 검사하지만 존재 여부를 구별하지 않는 동일한 완료 문구. 공급자의 시간/횟수 제한 유지, 중복 클릭은 pending으로 방지한다. 발송 실패 시에도 계정 존재 여부를 드러내지 않고 잠시 후 재요청 안내. 요청 완료는 배송 보장이라고 표시하지 않는다.

한국어 recovery 메일의 링크는 고정 SiteURL의 `/auth/reset-password#token_hash={{ .TokenHash }}`. fragment는 HTTP 요청/서버 URL 로그에 전달되지 않는다. GET은 토큰을 검증하거나 소비하지 않는다. Client component가 토큰을 메모리로 읽고 주소에서 제거한다. 리로드로 토큰을 잃으면 새 메일 요청을 안내한다. 다른 기기에서 열 수 있으며 PKCE verifier cookie에 의존하지 않는다. 메일의 request origin은 사용자 Host 헤더에서 만들지 않고 `AUTH_SITE_ORIGIN`을 사용한다.

`/auth/reset-password`: 이메일 토큰이 있을 때만 새 비밀번호 입력창. 기존 PasswordField의 보기·조건 체크와 큰 버튼을 재사용한다. 새 비밀번호 제출은 Server Action에서 입력·토큰 형식 검사 후 **type=recovery 고정**으로 verifyOtp한다. 전달된 user_id/email/next는 받지 않는다. 토큰 소유자로 반환된 계정에만 updateUser(password)를 수행한다. 일반 로그인 쿠키만으로 이 동작을 실행할 수 없다. 잘못되거나 사용/만료된 토큰은 같은 안내를 반환한다.

검증/변경은 별도의 비영속 서버 Auth client를 사용하여 복구 세션을 브라우저에 저장하지 않는다. 성공 후 해당 계정의 global signOut, 현재 브라우저의 기존 세션은 local signOut하고 완료 화면→로그인을 제공한다. 오류 시 내부 복구 세션은 정리한다. Auth 비밀번호 변경이 성공한 후 부가 로그아웃이 실패해도 비밀번호 변경을 실패로 오인하게 하지 않는다. DB 권한은 변경 시점 이전 세션을 즉시 거부한다.

## 구정책 계정과 세션

비공개 `life_private.credential_state(user_id PK/FK auth.users, policy_version, changed_at, pending_txid)`를 둔다. 비밀번호/해시를 복제 저장하지 않는다. 신규 password 계정은 INSERT에서 현재 정책을 기록한다. 기존 hash 변경은 먼저 policy_version=0으로 접근을 회수하고, 같은 DB transaction의 Auth 감사 이벤트(user_updated_password 또는 관리자 user_modified)가 확인된 때만1로 승인한다. 단순 재해시/암호화 키 교체가 기존 약한 비밀번호를 새 정책 준수로 오인하게 하지 않는다. 다른 transaction의 metadata 변경 이벤트로 승인할 수 없다. 기존 계정은 소급 채우지 않는다. 이 기록은 Auth 엔진에 동일 정책이 활성화되어 있다는 운영 전제에 의존하므로 설정 검사·API 거부 테스트와 Auth 감사 이벤트 형식 검증이 배포/업그레이드 전 필수다. service_role/DB 소유자는 신뢰된 관리 경계이며 앱 사용자에게 노출하지 않는다.

`life_private.person_id()`는 기존 활성 person/auth 연결에 더해 현재 정책 상태, 실제 auth.sessions의 session_id/user_id, 세션 생성 시각>=비밀번호 변경 시각, not_after/삭제/차단 상태를 확인한다. 따라서 직접 REST/RPC와 기존 남은 JWT도 이전 세션으로 자료에 접근할 수 없다. 신규 로그인은 새 세션으로 허용한다. 익명 공개 자료는 기존 공개 정책을 유지한다.

`life_auth_status()`는 현재 Auth session 소유자에게 active/needs_reset만 반환한다. 복구 과정은 legacy 계정도 active를 확인할 수 있으며, 로그인은 needs_reset이면 재설정 화면을 안내한다. metadata role/정책 버전을 신뢰하지 않는다. 메일 요청 자체가 실제 학습 기록이나 계정 상태를 변경하지 않는다.

## 로컬·운영 절차

Supabase email template 등록, redirect 허용 URL은 로컬3100만, 복구 유효기간15분, 비밀번호 변경 시 최근 인증 요구 설정 활성화. 로컬 메일함55324를 사용한다. 운영에는 동일한 template/SiteURL/SMTP/만료와 native password 정책을 먼저 적용하고 credential migration을 적용한다. 기존 실제 계정은 본인이 복구메일을 요청하여 새 기준으로 변경한다. 자동 대량 발송/임의 비밀번호 일괄 변경은 하지 않는다.

로컬 회귀용으로만 `@example.invalid` 계정을 알려진 가상 비밀번호로 갱신하는 옵션을 제공하며55321 전용 확인을 통과해야 한다. 학습/강의/증명 데이터는 삭제하지 않는다.

## 검증

공식 Auth API의 약한 비밀번호 가입·변경 거부와 lowercase/uppercase/콜론·역슬래시 허용. 메일 요청 동일 응답·로컬 배송·다른 브라우저 링크·GET 미소비·유효/잘못된/사용/만료 토큰·일반 쿠키 우회 거부. 복구 완료 후 기존 비밀번호 로그인 실패·새 비밀번호 로그인 성공, 이전JWT/RPC/refresh 거부와 person/학습 기록 유지. 구정책/로그아웃 session 차단, RLS·실행권한, 전체 회귀·migration 재생·lint/build·브라우저/모바일.

공식 근거: [Auth 환경설정](https://github.com/supabase/auth/blob/master/README.md), [비밀번호 복구](https://supabase.com/docs/guides/auth/passwords), [이메일 템플릿](https://supabase.com/docs/guides/auth/auth-email-templates), [세션](https://supabase.com/docs/guides/auth/sessions).
