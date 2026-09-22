# 인증 반복 요청·봇 방어 설계

`anchor-auth-abuse` / 2026-09-19 / Plan 참조 / 구현 기준

## 흐름

서버 액션 → 기본 형식 검사 → 서버 전용 HMAC 식별자 → 서비스 전용 제한 RPC → native Supabase Auth. CAPTCHA가 설정되면 로그인·가입·메일 요청의 토큰을 Auth에 전달하여 native 검증한다. 비밀번호 복구 완료는 일회용 이메일 증명 + 기존 MFA를 유지하고 별도 요청 제한을 적용한다.

## 제한 정책 (초기 제안값, 운영 트래픽에 따라 코드·설계 함께 조정)

| 작업 | 동일 식별자 | 네트워크 |
|---|---|---|
| 로그인 | 이메일+네트워크 8회/5분, 이메일 전체 30회/15분 | 60회/5분 |
| 가입 | 이메일 3회/1시간 | 10회/1시간 |
| 복구 메일 | 이메일 3회/15분 및 1회/60초 | 10회/15분 |
| 복구 완료 | 복구 토큰 5회/15분 | 30회/15분 |

성공 여부와 무관하게 허용한 시도를 계산한다. 영구 계정 잠금은 없다. 고정된 첫 요청 기준 창을 사용하고 거절된 요청은 기간을 연장하지 않는다. 다중 범위를 정렬하여 DB advisory transaction lock으로 동시성 보호하며 전부 허용일 때만 증가한다. 응답은 `{allowed,retry_after}`. 한 범위라도 거절되면 최장 대기 시간을 반환한다.

## DB와 권한

- `life_private.auth_request_buckets`: scope/key_digest 복합 PK, count, expires_at. RLS, API 역할 직접 권한 없음.
- private SECURITY DEFINER 함수는 고정 search_path, 작업 allowlist, 64자리 hex HMAC 검사, service_role JWT만 허용. public wrapper는 SECURITY INVOKER, service_role만 실행 허용. 인증 전 기능이므로 auth.uid가 없는 서비스 요청을 명시적으로 허용하며 사용자 권한 검사와 혼동하지 않는다.
- 원문 이메일/IP/비밀번호/복구 증명/CAPTCHA 토큰을 저장·로그하지 않는다.
- 만료 행은 호출 시 최대 100개 정리. 별도 서비스 전용 정리 RPC를 제공하고 운영 시 매일 실행·실패 감시 필요. 만료 후 최대 24시간 보유 목표는 스케줄 운영에 달려 있으며 자동 설정 완료라고 표시하지 않는다.

## 서버 설정과 신뢰 경계

- `AUTH_RATE_LIMIT_SECRET`: 전용 32자 이상 무작위 HMAC 키. `.env.local` 보존, 로컬 실행기는 전용 0600 임시 파일에 키를 보관하여 재시작 후 같은 식별자 유지. 키는 브라우저로 전달하지 않는다.
- `AUTH_TRUSTED_IP_HEADER`: 프록시가 기존 값을 제거하고 단일 IP로 덮어쓴다는 전제하에만 설정. `x-forwarded-for`, `forwarded`, 임의 클라이언트 IP는 자동 신뢰하지 않는다. 기본은 공유 unknown-network 버킷. IPv6는 /64로 정규화하여 주소 회전에 대응한다.
- 네트워크 경로를 헤더로 증명할 수 없으므로 운영자의 프록시 설정 확인이 필수. 잘못된/다중 주소는 공유 버킷으로 처리한다.
- HMAC 식별자에는 작업·범위를 포함하여 교차 용도 연관을 줄인다.
- DB/RPC 장애·키 누락은 Auth 호출 전 fail closed. 브라우저에는 연결 안내만 제공한다.
- 로컬 예외는 배포 환경변수의 고정 사이트 origin과 Supabase 주소 둘 다 loopback일 때만 허용. 요청 Host만으로 로컬 예외를 결정하지 않는다.

## 봇 확인

- `AUTH_TURNSTILE_SITE_KEY`는 서버에서 위젯 props로 전달하는 공개 키. `AUTH_CAPTCHA_ENABLED=true`는 native Auth에 같은 키 쌍의 비밀키를 설정했다는 배포 계약.
- 외부 환경에서는 키/활성화 플래그가 없으면 양식 안내 및 서버 거절. test site key는 로컬에서만 허용한다.
- 비밀키는 native Auth에만 저장하고 앱에 이중 siteverify를 하지 않는다(토큰 일회성). 앱은 토큰 길이/존재를 검사하고 native Auth가 진위를 검증한다.
- 기본 로컬 실행에는 외부 CAPTCHA가 없음을 보고서에 표시. 테스트 키는 진짜 봇 판별 증거가 아님.
- 로컬 전용 `AUTH_LOCAL_CAPTCHA_TEST=pass|fail`은 공식 공개 테스트 키로 native Auth까지 통합 검증한 뒤 기본 모드로 복원한다. 이 설정 스크립트는 `uc-life-core`, loopback 55321, 소유 Docker 네트워크를 검증한다.
- native 메일 `max_frequency=60s`도 적용하여 홈페이지를 거치지 않은 재발송 경로에 동일한 최소 간격을 둔다. native IP 버킷은 기존 설정을 유지한다.
- 한국어 위젯, compact 크기, 읽기 쉬운 상태·재시도 버튼. 만료/네트워크 실패/응답 이후 토큰 초기화. 우회 체크박스 없음.
- 배포 직전 direct Auth에 토큰 누락/잘못된 토큰을 보내 native 차단을 별도로 확인해야 한다. 서버 설정 플래그만으로 native 활성화가 검증되었다고 간주하지 않는다.

## UI와 개인정보

ActionState의 선택적 retryAfter로 대기 초 표시·버튼 잠금. 서버 제한이 본체이며 DOM 조작으로 해제해도 제한 유지. 실패 입력 보존, 불필요한 영구 잠금 표현 없음. 복구 메일은 존재/부재/메일 발송 제한과 무관하게 동일한 본문·60초 재시도 안내를 반환한다. 시스템 전체 설정/DB 장애는 계정과 무관한 서비스 연결 오류를 표시할 수 있다.

Turnstile 운영 활성화 전 위탁/국외 이전 해당 여부·공급자 처리 항목과 근거를 기관 담당자가 검토하고 개인정보처리방침을 확정한다. 현재 공개 정책을 임의로 승인·게시하지 않는다.

## 검증 기준

권한 부여/거부, 제한 경계, 동시 요청, 만료 후 복원, 차단 시 무연장, 작업 분리, 정리, HMAC·IP 정규화, fail closed, 실제 서버 액션 네 경로, 모바일·입력 보존, native 직접 경로 설정의 한계 명시. 기존 접근성·복구·MFA 검사 재실행. lint/build 및 설계 갭 분석.

## 근거

- https://supabase.com/docs/guides/auth/rate-limits
- https://supabase.com/docs/guides/auth/auth-captcha
- https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
- https://developers.cloudflare.com/turnstile/troubleshooting/testing/

2026-09-19 조회. Auth native 기본 제한은 홈페이지 추가 제한과 별개이며, SSR은 Auth에서 서버 주소로 합산될 수 있다. 현재 legacy 키를 사용하므로 최신 secret-key 전용 Sb-Forwarded-For 지원을 추정하여 적용하지 않는다.

## 로컬 실행

`node scripts/dev-local.mjs --build`로 local NEXT_PUBLIC 환경을 빌드에 주입하고 `node scripts/dev-local.mjs --production`으로 미리보기를 시작한다. Next.js의 공개 환경변수는 빌드 시 고정되므로 다른 환경에서 생성한 산출물을 런타임 변수만 바꿔 재사용하지 않는다.
