# 별도 인증 서버 배포 설정과 사전 검사

2026-09-19 · `anchor-self-hosted-preflight`

Vercel 앱과 자체 운영 Supabase를 구분하는 검사기와 Auth 정책 override를 준비했다. **운영 서버 설치·DB 이관·실제 인증 인수는 아직 수행하지 않았다.** 검사는 입력된 설정과 기록을 비교하며 서버 접속·가입·메일 발송을 하지 않는다.

사용자 제공 홈페이지 주소는 **https://uc-life.vercel.app**이다. 운영 Vercel 환경의 `AUTH_SITE_ORIGIN`, `CERTIFICATE_VERIFY_ORIGIN`, 양쪽 환경의 `RELEASE_PRODUCTION_SITE_ORIGIN`에 사용할 기준이며 아직 원격 환경 변수에 등록하지 않았다. Preview는 별도 주소가 필요하다. `NEXT_PUBLIC_SUPABASE_URL`에는 별도 인증·업무 API 서버 주소가 들어가므로 홈페이지 주소로 채우지 않는다.

## 준비한 파일

| 파일 | 용도 |
|---|---|
| [app.env.example](../../ops/self-hosted/app.env.example) | Vercel 앱의 자체 운영 환경 변수 양식 |
| [compose.auth-policy.json](../../ops/self-hosted/compose.auth-policy.json) | 공식 Supabase Compose에 마지막으로 합치는 Auth 정책 override |
| [runtime.example.json](../../ops/self-hosted/runtime.example.json) | 비밀 없는 Auth 설정 기록 양식 |
| [release.example.json](../../ops/self-hosted/release.example.json) | 버전 2, 16개 인수 항목이 pending인 기록 양식 |
| [check-self-hosted.mjs](../../scripts/check-self-hosted.mjs) | 정책·주소·이미지 검사와 설정 지문 산출 |
| [check-release-readiness.mjs](../../scripts/check-release-readiness.mjs) | 환경·설정 증거·인수 기록·소스 지문 대조 |

Cloud는 `SUPABASE_DEPLOYMENT_KIND=cloud`를 사용한다. 미설정도 기존 Cloud로 처리하지만 빈 문자열이나 오타는 거부한다. Cloud 인수 기록은 버전 1을 유지한다. 자체 운영은 `self-hosted`를 명시하고 Cloud용 `RELEASE_PRODUCTION_SUPABASE_REF`는 등록하지 않는다.

## Vercel 앱 환경

| 값 | 확인 기준 |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | 백엔드 공개 HTTPS origin. 끝 `/`나 `/auth/v1` 없음 |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | 해당 스택의 공개 클라이언트 키 |
| SUPABASE_SERVICE_ROLE_KEY | 해당 스택 서버 전용 키. 공개 변수에 넣지 않음 |
| SELF_HOSTED_STACK_ID | 환경별 고정 ID. 예: anchor-stage, anchor-production. 실제 ID는 별도 확정 |
| SELF_HOSTED_AUTH_IMAGE | 검토한 `supabase/gotrue:vX.Y.Z@sha256:<digest>` |
| SELF_HOSTED_CONFIG_DIGEST | 전용 검사기가 산출한 비밀 없는 설정의 SHA-256 |
| RELEASE_PRODUCTION_BACKEND_ORIGIN / RELEASE_PRODUCTION_STACK_ID | 두 앱 환경에 동일하게 등록하는 운영 백엔드/스택 기준 |
| RELEASE_PRODUCTION_SITE_ORIGIN | 두 앱 환경에 동일하게 등록하는 운영 사이트 기준 |

공통 사이트·증명 origin, HMAC 비밀, Turnstile site key, 신뢰 프록시 기준은 기존과 같다. Preview의 사이트/백엔드/스택 ID는 모두 운영 기준과 달라야 한다. 문자열이 달라도 DNS 별칭이나 프록시가 같은 DB를 가리킬 수 있으므로 실제 분리는 운영자가 확인한다.

키는 opaque 형식 또는 자체 운영 legacy JWT의 issuer `supabase`·역할·Cloud ref 부재를 검사한다. 이는 **키 서명·만료·환경 귀속 검증이 아니다**. 가짜 문자열도 형식 검사를 통과할 수 있으므로 최소권한 API 시험이 필요하다. 환경변수 변경 후 대상 환경으로 새로 빌드한다. [Vercel 환경 범위](https://vercel.com/docs/environment-variables)

## Auth 서버 구성

기본 스택은 검토한 공식 self-hosted 배포판을 사용한다. 이번에 확인한 `self-hosted/v0.8.1`의 Auth는 `v2.196.0`이다. 기존 로컬 회귀 버전은 `v2.195.0`이며 후속 [격리 시험](auth-candidate-lab.md)에서 v2.196.0의 native 비밀번호·복구·MFA 28개 검사가 통과했다. 공식 전체 스택과 운영 환경 인수는 남아 있다. digest는 실제 레지스트리와 실행 플랫폼에서 확인해 넣는다. [공식 Docker 배포](https://supabase.com/docs/guides/self-hosting/docker)

이 override는 auth 서비스만 덮어쓴다. 전체 DB/JWT/키·Gateway·TLS·포트·볼륨·백업 구성은 대체하지 않는다. Auth DB와 업무 DB가 같은 인스턴스인지 확인하고 다른 서비스도 검토한 이미지로 고정한다.

| Auth 스택 주입 변수 | 의미 |
|---|---|
| ANCHOR_AUTH_IMAGE | 검토한 Auth 이미지와 digest |
| ANCHOR_BACKEND_ORIGIN / ANCHOR_APP_ORIGIN | 환경별 백엔드/홈페이지 HTTPS origin |
| ANCHOR_CAPTCHA_SECRET | 해당 도메인의 실제 native Turnstile secret |
| ANCHOR_SMTP_HOST / ANCHOR_SMTP_PORT | 승인 SMTP 호스트·465 또는 587 포트 |
| ANCHOR_SMTP_USER / ANCHOR_SMTP_PASS | 비밀 관리 경로에서 주입하는 SMTP 자격 증명 |
| ANCHOR_SMTP_ADMIN_EMAIL | 승인 발신 이메일 |
| ANCHOR_RECOVERY_TEMPLATE_URL | 검토한 한국어 복구 HTML의 HTTPS 파일 주소 |
| ANCHOR_DISABLE_SIGNUP | 기본 true. 정책·인증 인수 후 false로 가입 개방 |

기관 비밀 저장소 또는 저장소 밖의 접근 제한된 배포 환경 파일을 사용한다. 앱의 기존 `.env.local`을 복사하거나 덮어쓰지 않는다. 기본 스택의 `SUPABASE_PUBLIC_URL`, `API_EXTERNAL_URL`, `SITE_URL`도 각각 같은 백엔드 origin, 백엔드 origin + `/auth/v1`, 앱 origin으로 맞춘다. SDK URL에는 `/auth/v1`을 붙이지 않는다. [Auth URL 변경](https://supabase.com/changelog/47093-self-hosted-supabase-api-external-url-to-include-auth-v1)

최신 기본 Gateway는 Envoy다. 승인된 TLS reverse proxy를 구성하고 외부에는 HTTPS만 공개한다. DB·Studio·Auth 내부 포트는 사설 접근으로 제한한다. Studio 기본 HTTP Basic 인증만으로 개인 계정 추적이 제공되지 않으므로 VPN/개인 계정 접근 제어와 기록을 별도 구성한다. [Gateway 변경](https://supabase.com/changelog/48048-self-hosted-supabase-envoy-becomes-the-default-api-gateway-b)

복구 템플릿은 저장소의 `supabase/templates/recovery.html`을 검토한 뒤 HTTPS로 제공하고, GoTrue의 접근·최종 링크·다른 기기 복구를 확인한다. 파일은 아직 공개 호스팅하지 않았다. SMTP 포트 번호만으로 TLS가 검증되지는 않으며 제공자 설정과 실제 연결을 확인한다.

비밀번호는 12자, 영문 대소문자 한 집합, 숫자, ASCII 특수문자 정책이다. Compose에는 `$`를 `$$`로 기록했다. `docker compose config` 출력도 `$`를 다시 escape할 수 있으므로 실행 중 컨테이너 값으로 오인하지 않는다. 전체 설정 출력에는 비밀이 섞일 수 있으므로 로그에 게시하지 않고 최종 컨테이너의 허용 필드만 대조한다. [Docker 보간 규칙](https://docs.docker.com/reference/compose-file/interpolation/)

## 검사 순서

1. 배치·도메인·담당자·예산을 확정한다. 기본 Compose와 Auth override를 검토하고 별도 시험 스택용 비밀을 준비한다.
2. runtime 양식을 `ops/self-hosted/runtime.local.json` 또는 보호된 외부 경로로 복사하고 실제로 적용할 비밀 없는 값만 채운다. 허용 필드 밖의 DB URL, SMTP 암호, CAPTCHA secret, JWT 키 등은 거부한다.
3. 다음 검사로 정책과 지문을 확인한다. 원문을 출력하지 않고 판정과 지문만 반환한다.

```sh
npm run check:self-hosted -- --config-file ops/self-hosted/runtime.local.json --format json
```

4. 반환된 `configDigest`와 스택·이미지·도메인을 Vercel 대상 환경과 버전 2 기록에 반영한다. 이것만으로 실제 원격 적용이 확인되는 것은 아니다.
5. 별도 시험 스택을 설치한 뒤 실행 중 설정/이미지를 대조한다. SMTP/CAPTCHA 비밀, native 비밀번호 허용·거부, DB 감사/복구/MFA, 전체 migration·역할별 업무·백업 복원을 검증한다. 기존 로컬 검사기의 대상 보호를 제거하지 않는다.
6. 실제 확인한 항목만 담당자·UTC 시각·증거 참조로 기록한다. 설정 변경 시 지문과 영향 시험을 갱신한다. 가입 개방 true→false 전환도 지문이 바뀐다.

```sh
npm run check:release -- --snapshot
npm run check:release -- --target preview --env-file ops/self-hosted/app.local.env --config-only
npm run check:release -- --target preview --env-file ops/self-hosted/app.local.env --record ops/self-hosted/release.local.json --self-hosted-config ops/self-hosted/runtime.local.json --format json
```

`--env-file`은 명시 파일만 사용하며 상속 환경과 합치지 않는다. 실제 파일은 접근권한을 제한하고 Git에서 제외한다. app.local.env는 앱의 변수이며 Auth 스택 비밀을 넣는 파일이 아니다.

| 결과 | 의미 |
|---|---|
| CONFIG_BLOCKED / BLOCKED | 누락·정책 차이·혼용·기록 불일치. 종료 1 |
| CONFIG_MATCH_RUNTIME_PENDING | 제공한 Auth 설정의 구조/정책만 일치. 서버 인수 대기 |
| CONFIG_VALID | 앱 환경 형식만 일치. 서버/증거 확인 아님 |
| READY_FOR_MANUAL_RELEASE_REVIEW | 설정/환경/기록/소스 연결 일치. 담당자의 실제 증거 검토·게시 결정 필요 |

전체 검사는 자체 운영 runtime 파일을 필수로 받는다. Vercel `build:vercel`은 **앱 환경 형식만** 검사하며 runtime 파일이나 외부 서버 인수를 자동 수행하지 않는다. config-only와 runtime 파일을 함께 주면 검사를 거부한다.

## 검증 범위

Cloud 배포 검사 111건, hosted Auth 검사 70건, 자체 운영 검사 111건을 통과했다. 새 시험은 합성 입력·임시 폴더·Compose 파싱만 사용했다. 혼용/운영 기준 재사용 차단, 정책 누락, 지문 변경, 비밀 비출력, 전체 CLI 연결과 빌드 진입 차단을 확인했다.

Compose 시험은 생성 파일과 파서 출력 표현을 검증한다. 실행 중 Auth 설정이나 최신 native 동작을 검증한 것은 아니다. runtime JSON도 제공된 기록이며 원격 사실의 증명은 아니다. 운영 정책·메일/CAPTCHA·복구·MFA·DB·담당자 인수 전에는 서비스를 개방하지 않는다.
