# Supabase hosted 인증 사전 검증 설계

2026-09-19 · `anchor-hosted-auth-preflight`

## 구성과 경계

- `scripts/lib/hosted-auth-preflight.mjs`: 순수 설정 비교 및 고정 Supabase Management API GET. 입력/응답/예외 원문 출력 없음.
- `scripts/check-hosted-auth.mjs`: `--config-file PATH` 오프라인 또는 `--live` 명시 조회. 양 모드는 함께 쓰지 못한다. 네트워크 기본 실행 없음, env 자동 로드 없음.
- live에는 `--preview-ref`, `--production-ref`, `--site-origin`을 명시한다. 20자 소문자/숫자 ref, 서로 다른 프로젝트, 공개 HTTPS origin을 검증한다. `SUPABASE_ACCESS_TOKEN`은 현재 프로세스 환경에서만 사용한다. 고정 api.supabase.com 대상, GET만, redirect 금지, 10초 timeout, 최대 1 MiB. 자동 재시도 없음.
- `ops/hosted-auth.example.json`: 검사할 공급자 설정 키만 null로 둔 빈 예시. 비밀값 저장 금지.
- `scripts/inspect-hosted-auth.sql`: pg_catalog만 조회하는 단일 SELECT. 의존 Auth 컬럼과 타입, postgres의 SELECT/TRIGGER 권한, 기대 트리거의 존재/활성/대상 함수 확인. 사용자·세션·감사 로그 데이터 행은 조회하지 않는다. migration 파일이 아닌 수동 진단 쿼리이며 DB 변경 없음.
- `scripts/verify-hosted-auth.mjs`: 합성 설정, fetch stub, 임시 파일로 조건·오류·출력 비노출 시험. 별도 로컬 DB에 SQL SELECT를 실행해 메타데이터 형식 검증.

## 비교 기준

현재 로컬 사용자 지정 문자열을 기준으로 native `password_min_length=12`, `password_required_characters`의 정확한 문자열 일치를 요구한다. 미지의 동등한 문자열을 자동 승인하지 않는다. 관리 API enum에 없다는 이유로 사용자 기준을 완화하거나 대소문자를 각각 강제하지 않는다.

site_url 고정 origin 일치, external_email_enabled=true, mailer_autoconfirm=false, mailer_otp_exp=900, smtp_max_frequency>=60, SMTP host 지정, native CAPTCHA=true/turnstile, TOTP enroll/verify=true를 검사한다. SMTP/CAPTCHA 비밀의 실제 유효성은 검사하지 않는다.

출력은 고정 ID·메시지·PASS/BLOCK뿐이다. 원래 config, 토큰, ref/origin, 파일 경로, 공급자 에러는 재출력하지 않는다. 항목 실패/입력 오류는 `CONFIG_BLOCKED` 및 종료1, 설정 비교만 통과하면 `CONFIG_MATCH_RUNTIME_PENDING` 및 종료0. 원격 호환성 또는 게시 승인으로 표시하지 않는다. DB 감사 기록 활성·동일 transaction 이벤트, auth.mfa_factors 트리거 허용, native 허용/거부·MFA 흐름은 항상 별도 미검증 항목으로 출력한다.

## 공식 문서에서 확인할 차이

관리 API 비밀번호 enum은 영문+숫자, 대문자+소문자+숫자, 대문자+소문자+숫자+특수문자 등이며 확정 조합이 없다. 감사 로그의 DB 저장은 선택 사항이다. 관리형 schema 제한 문서의 트리거 허용 목록에 auth.mfa_factors는 없다. 이는 공급자 지원 확인/Preview 실제 실행이 필요한 지점이며 모든 hosted 프로젝트의 현재 권한을 추정하지 않는다.

## 완료 판단

검사 도구·로컬 메타데이터 검증의 완료와 실제 hosted 인수 검증 대기를 별도로 보고한다. 기존 배포 점검표를 자동 confirmed로 바꾸지 않는다. 이번 소스 추가로 기존 release sourceDigest가 변경되는 것은 의도된 동작이다.
