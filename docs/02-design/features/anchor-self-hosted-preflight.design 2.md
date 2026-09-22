# anchor-self-hosted-preflight 설계

2026-09-19 · [계획](../../01-plan/features/anchor-self-hosted-preflight.plan.md)

## 배포 환경 계약

`SUPABASE_DEPLOYMENT_KIND`는 `cloud` 또는 `self-hosted`. 미설정은 기존 Cloud 호환을 유지하고 알 수 없는 값은 거부한다. self-hosted에서는 Cloud 기본 URL과 `RELEASE_PRODUCTION_SUPABASE_REF`를 거부한다. Cloud에서는 self-hosted 식별 변수의 비어 있지 않은 값을 거부한다.

자체 운영의 추가 서버 변수: `SELF_HOSTED_STACK_ID`, `SELF_HOSTED_AUTH_IMAGE`, `SELF_HOSTED_CONFIG_DIGEST`, `RELEASE_PRODUCTION_BACKEND_ORIGIN`, `RELEASE_PRODUCTION_STACK_ID`. 스택 ID는 3~63자의 소문자·숫자·하이픈. 이미지는 공식 `supabase/gotrue:vX.Y.Z@sha256:<64 hex>`로 고정한다. SDK URL은 공개 HTTPS origin이어야 하며 `/auth/v1` 경로를 포함하지 않는다.

Production은 사이트/서버/스택 모두 기준값과 같아야 한다. Preview는 세 가지 모두 달라야 한다. 키는 기존 opaque publishable/secret 또는 역할이 올바른 legacy JWT를 허용한다. 자체 운영 legacy JWT는 issuer `supabase`, Cloud ref 없음 조건을 적용한다. 키 형식 검사는 서명·유효성·환경 귀속 검증이 아니며 실제 API 인수 증거가 별도 필요하다.

## 설정·인수 증거

`scripts/lib/self-hosted-preflight.mjs`는 비밀 없는 설정 JSON의 필드 allowlist, target/스택/주소/고정 이미지, Auth 설정을 검사한다. 원본 GoTrue 환경 이름과 문자열 값을 사용한다. 설정은 길이 12·정확한 문자 집합·DB 감사 저장·이메일 인증·복구 900초·재발송 60초·native Turnstile·TOTP·익명 가입 차단을 포함한다. URI 허용 목록은 현재 복구 경로 하나로 제한하며 소셜 로그인 확장 시 별도 검토한다. SMTP 비밀과 CAPTCHA 비밀은 이 기록에 넣지 않는다.

정규화한 비밀 없는 설정 전체의 SHA-256을 출력한다. 입력 키 순서는 무관하고 값 변경 시 지문이 달라진다. 미확인 키/비밀이 포함되면 거부하고 입력·경로·파싱 오류·원문을 출력하지 않는다. 정상 설정 결과도 `CONFIG_MATCH_RUNTIME_PENDING`이며 실행 중 서버를 확인했다는 뜻이 아니다.

기존 release 기록 schemaVersion 1은 Cloud만 허용한다. self-hosted는 schemaVersion 2, `deploymentKind`, `backendOrigin`, `stackId`, `authImage`, `configDigest`를 요구하며 앱 환경과 모두 대조한다. 기존 15개 인수 항목에 `self-hosted-operations`를 추가한다. 전체 검사에는 `--self-hosted-config`를 필수로 요구하고 기록·환경·설정 파일을 연결한다. config-only/Vercel 빌드 검사는 형식 검사 범위를 유지한다.

## 배포 파일

`ops/self-hosted/compose.auth-policy.json`은 검토된 공식 self-hosted Compose의 auth 서비스에 마지막으로 합치는 override다. 전체 스택·TLS·포트·백업 구성은 대체하지 않는다. 비밀번호 문자 집합의 달러는 Compose `$$`로 escape한다. 이미지·HTTPS origin·CAPTCHA secret·SMTP는 필수 변수, 가입은 기본 닫힘이며 명시적으로 열 때 기관 정책 인수가 필요하다. 고정 정책 값과 원본 스택의 DB/JWT 설정을 구분한다.

app.env.example, runtime.example.json, release.example.json은 빈 값/pending 양식이며 기본 실패가 정상이다. 실제 환경 파일·runtime/release 증거는 별도 비공개 경로를 쓰며 Git에서 제외한다. 소스 지문에는 고정된 ops/self-hosted 템플릿만 포함하고 실제 환경/증거 파일은 포함하지 않는다.

## 검증

기존 Cloud 회귀 유지, 양 환경 정상 사례, 모드 혼용·운영 자원 재사용·잘못된 URL/키/이미지/지문/기록 거부, 실제 Compose config의 문자 보존, 설정 누락·원문/비밀 출력 방지, 명시 파일만 읽기, 128 KiB 입력 제한, 전체 CLI와 Vercel 빌드의 차단을 합성 자료로 시험한다. 실제 DB/컨테이너를 변경하지 않는다.

공식 자료 확인: self-hosted/v0.8.1 배포판은 Auth v2.196.0과 Envoy gateway를 사용한다. 로컬의 v2.195.0 성공을 새 버전 승인으로 간주하지 않는다. API_EXTERNAL_URL에는 /auth/v1이 필요하다. 최신 기본 Compose를 자동 설치하거나 실행하지 않고 운영 담당자가 버전과 digest를 검증해 고정한다.
