# U-LIFE · 앵커사업 평생직업교육

**Vercel + Supabase 배포 준비:** [운영 인수·배포 가이드](docs/operations/vercel-supabase-release.md), [담당자 점검표](ops/release.example.json). `npm run test:release`로 검사 도구를 검증하고 `npm run check:release -- --help`로 사용법을 확인한다. Vercel 빌드는 설정 검사 후 실행하며 실제 게시 승인·원격 인증 호환성 검증은 별도다. 실제 운영 배포는 아직 하지 않았다.

**Supabase 인증 호환성:** ANCHOR/uc-life를 확인했다. 현재 원격은 001~008 적용, 별도 Preview 없음 상태다. [호환성 조사·진단 도구 안내](docs/operations/supabase-auth-compatibility.md), `npm run test:hosted-auth`. 확정 비밀번호 조건과 hosted API 프리셋 차이·Auth 트리거 지원 범위를 해결한 뒤 실제 Preview 인수 검증이 필요하다.

Next.js 15.5.25 / React 19.3 / Supabase 기반. 현재는 **인증·무료/유료 과정 신청·텍스트 자료/과제 LMS·공식 출결·객관식 시험·수료 검토/승인·이수증/강사 경력증명·입금 대사/환불 관리·문자 예약·연차 평가/성과 보고·디지털배지·강사 이력 심사·과정 개발**을 로컬에서 구현·검증했다. 전체 플랫폼 설계와 운영 배포는 별도 진행 중이다.

- [전체 기획](docs/01-plan/features/anchor-lifelong-education-platform.plan.md)
- [전체 상세설계](docs/02-design/features/anchor-lifelong-education-platform.design.md)
- [첫 구현 단위 범위](docs/02-design/features/anchor-core-flow.design.md)
- [첫 구현·검증 보고](docs/04-report/features/anchor-core-flow.report.md)
- [출결·시험·수료 설계](docs/02-design/features/anchor-learning-evaluation.design.md)
- [출결·시험·수료 검증 보고](docs/04-report/features/anchor-learning-evaluation.report.md)
- [증명 발급 설계](docs/02-design/features/anchor-certificates.design.md)
- [증명 발급 검증 보고](docs/04-report/features/anchor-certificates.report.md)
- [수납·환불 상세설계](docs/02-design/features/anchor-finance.design.md)
- [수납·환불 검증 보고](docs/04-report/features/anchor-finance.report.md)

## 로컬 실행

Docker, Node.js 22 이상, Supabase CLI가 필요하다. `uc-life-core` 프로젝트는 기존 `uc-anchor`와 다른 포트(55321/55322)를 사용한다.

```sh
npm ci
supabase start -x realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
node scripts/configure-auth-local.mjs
npm run test:core
node scripts/verify-learning.mjs
node scripts/verify-certificates.mjs
node scripts/verify-finance.mjs
node scripts/verify-messaging.mjs
node scripts/verify-annual.mjs
node scripts/verify-badges.mjs
node scripts/verify-instructor-development.mjs
npm run dev:local
```

`http://127.0.0.1:3100`에서 확인한다. `dev:local`은 로컬 Supabase 설정을 자식 프로세스에만 전달하며 기존 `.env.local`을 덮어쓰지 않는다. 테스트는 전용 로컬 URL과 컨테이너 이름을 확인한 뒤 실행한다.

| 로컬 테스트 계정 | 용도 |
|---|---|
| `learner@example.invalid` | 수강생 |
| `instructor@example.invalid` | 배정된 강사 |
| `operator@example.invalid` | 과정담당 |
| `evaluation-learner@example.invalid` | 출결·시험 검증 수강생 |
| `reviewer@example.invalid` | 별도 수료 승인자·검증용 증명 발급 위임자 |
| `finance-learner@example.invalid` | 유료 과정 검증 수강생 |
| `cashier@example.invalid` | 검증용 수납 확인·환불 산출·지급 기록 |
| `finance-approver@example.invalid` | 검증용 별도 환불 승인자 |
| `message-learner@example.invalid` | 문자 예약·홍보 동의 검증 수강생 |
| `survey-learner-1@example.invalid` | 만족도 조사 수강생 |
| `performance-preparer@example.invalid` | 연차 지표·외부실적·보고 작성 |
| `performance-approver@example.invalid` | 별도 지표·보고 승인 |
| `badge-issuer@example.invalid` | 검증용 BADGE 위임 발급자 |
| `badge-learner@example.invalid` | 배지 발급·정정·공유 검증 수강생 |
| `badge-browser@example.invalid` | 브라우저 배지 발급 확인 수강생 |
| `development-instructor@example.invalid` | 강사 이력·공개 소개·과정 제안 검증 |
| `instructor-reviewer@example.invalid` | 별도 이력 심사·과정 심의·기수 개설 검증 |

비밀번호는 로컬 전용 `Local-Only-2026!`이다. 실제 Auth 로그인을 사용하며, 역할 우회 로그인은 없다. 이 계정과 테스트 정책은 위 검증 스크립트 실행 시에만 생성된다. 실제 개인정보를 입력하지 않는다. 테스트 자료를 운영 DB로 옮기지 않는다.

## 검증

```sh
npm run test:core
node scripts/verify-learning.mjs
node scripts/verify-certificates.mjs
node scripts/verify-finance.mjs
node scripts/verify-messaging.mjs
node scripts/verify-annual.mjs
node scripts/verify-badges.mjs
node scripts/verify-instructor-development.mjs
node scripts/verify-accessible-auth.mjs
node scripts/verify-auth-recovery.mjs
node scripts/verify-admin-mfa.mjs
npm run lint
npm run build
supabase db advisors --local --type security --level warn
supabase migration list --local
```

`test:core`는 로컬 가상 학습자의 이전 과제·신청을 초기화하고 33개 DB/Auth/Data API/RPC 검증을 실행한다. 신규 로컬 DB에서 전체 SQL 재생은 `supabase db reset --local --no-seed`로 검사할 수 있다. 이 명령은 해당 로컬 프로젝트의 데이터를 삭제하므로 운영 연결 옵션을 추가하지 않는다.

`npm run test:db-performance`는 조회 범위·실패 처리 회귀검사를 DB 연결 없이 실행한다. 기존 로컬 시험 데이터를 준비한 뒤 `npm run test:auth-load`로 로그인/MFA, 역할별 화면의 동시 요청 1·4·8개, 권한 차단과 사용자 세션 격리를 확인할 수 있다. 로컬 Supabase 55321과 가상 계정만 허용하며 URL이나 부하 인자를 받지 않는다. 현재 Git 추적 파일을 별도 임시 폴더에서 프로덕션 빌드하므로 `.env.local`과 기존 `.next`는 유지된다. 소스 파일을 새로 추가했다면 측정 전에 Git 추적 대상에 포함해야 한다.

부하 검증은 로그인 후 페이지 216회와 사용자 혼합 페이지 24회를 요청한다. 완료 또는 검증 오류 시 이번 실행의 로그인 세션·서버·임시 빌드를 정리한다. 집계 결과는 `ops/evidence/auth-load-result.json`에 저장한다. 로컬 측정값은 운영 수용량이나 사용자 체감 속도를 의미하지 않는다. [로그인·부하 검증 설계](docs/02-design/features/anchor-auth-load-verification.design.md).

학사 검증은 새 기수에서 33개 검사를, 증명 검증은 그 기수에서 24개 검사를 실행한다. 순서는 위와 같이 지킨다. 증명 검증을 다시 실행할 때는 학사 검증도 먼저 실행한다. 증명 검증은 Node.js 26 환경에서 확인했으며 `output/pdf/test-*.pdf`에 가상 정보로 만든 검증용 PDF를 남긴다. 프로그램 실행의 최소 Node 버전과 검증 스크립트에 사용한 버전은 다르다.

## 운영 적용 경계

인증 화면은 비밀번호 보이기/숨기기와 가입 시 조건4개 실시간 확인을 제공한다. 강사·관리자 포함 이메일 계정의 포털 가입/로그인 기준은12자 이상+영문·숫자·ASCII 특수문자이며 대문자·소문자를 각각 요구하지 않는다. 기존 비밀번호가 기준에 맞지 않으면 포털 로그인을 중지하고 재설정을 안내한다. [접근성 인증 설계와 간편 로그인 도입안](docs/02-design/features/anchor-accessible-auth.design.md), [검증 보고](docs/04-report/features/anchor-accessible-auth.report.md).

**인증 정책·복구:** 로컬 Auth 엔진에도12자+영문·숫자·ASCII 특수문자를 적용했으며 영문은 대소문자 중 하나면 된다. `configure-auth-local.mjs`는 전용 Auth 컨테이너에 공식 사용자 지정 설정을 적용한다. Supabase start/reset 후 실행하며 `dev:local`도 자동 확인한다. CLI 기본 프리셋만으로 같은 조건이 적용됐다고 간주하지 않는다. 사용자 지정 Auth 설정을 지원하는 운영 배치 또는 공급자의 동등한 통제를 배포 전에 별도로 확인해야 한다. 원격 Auth 설정은 변경하지 않았다.

`/auth/forgot-password`에서 이메일로 재설정 링크를 요청하고 `/auth/reset-password`에서 새 비밀번호를 정한다. 한국어 메일·15분 유효기간·일회용 토큰을 사용한다. 링크를 여는 것만으로 토큰을 소비하지 않으며 다른 기기에서도 변경할 수 있다. 이전 세션의 DB/RPC 접근과 구정책 계정의 자료 접근은 차단하고 기존 person·학습 기록은 유지한다. 실제 계정은 본인이 재설정하며 자동 대량 발송이나 임의 비밀번호 일괄 변경은 하지 않는다. 로컬 메일함은 `http://127.0.0.1:55324`이며 운영에는 승인된 SMTP·고정 `AUTH_SITE_ORIGIN`·SiteURL·템플릿·정책 설정이 필요하다. [설계](docs/02-design/features/anchor-auth-recovery.design.md), [검증 보고](docs/04-report/features/anchor-auth-recovery.report.md).

credential migration 이전부터 있던 로컬 가상 계정만 `node scripts/verify-auth-recovery.mjs --upgrade-local-fixtures`로 갱신할 수 있다. 이 옵션은55321의 `@example.invalid` 계정만 대상으로 하며 학습 기록은 삭제하지 않는다. 이후에는 옵션 없이 검증한다. Auth 감사 로그의 동일 transaction 비밀번호 변경 이벤트로 정책 준수를 기록하므로 Auth 업그레이드 시 해당 형식과 직접 API 거부를 재검증한다. 새 검증 스크립트는 Node.js26에서 확인했다. 카카오·네이버 로그인, PASS 본인확인과 운영 SMTP는 아직 연동하지 않았다.

원격 프로젝트는 읽기만 했고 새 마이그레이션을 적용하지 않았다. 확인 당시 원격에는 001~008이 적용되어 있었다. 원격 적용 전 009~010 및 새 마이그레이션을 함께 검토하고, 최신 원자료·백업·복구와 기관 정책을 확인한다.

새 구조는 `life_` 접두어를 사용한다. 기존 테이블/뷰/함수의 브라우저 권한을 회수하며 기존 데이터는 삭제하지 않는다. 기존 계정은 새 신원 구조에 최소권한으로 연결되고 기존 관리자 역할은 자동 승계하지 않는다. 과거 교육·수납·증명 데이터는 검토된 이관이 별도로 필요하다.

승인된 정책 원문이 없으면 신규 가입·모집 공개·신청이 제한된다. 기관이 확정한 처리방침·보유기간·모집·수료기준을 `life_policy_versions`에 등록해야 한다. 최초 승인자와 운영자 권한은 신원·위임 확인 후 신뢰된 DB 관리 경로에서 등록한다. 사용자의 `user_metadata.role`로 권한을 부여하지 않는다. 강사는 기관 역할과 기수 배정이 모두 필요하다. 승인된 강사의 기수 배정·해제는 사업단 과정 관리 화면에서 처리한다.

후속 운영 준비: MFA 등록 교육·분실 복구 승인자/절차 확정, 운영 CAPTCHA·신뢰 프록시 설정, 인증 외 API의 속도 제한, 보유·파기 작업, 모니터링, 백업·복구 검증, 배포 환경. 실제 은행/PG 연결·문자 발송·영상/QR 출결·서술형/재응시 시험·외부 배지 지갑 연동은 아직 제공하지 않는다.

## 인증 요청 제한·봇 확인

로그인·가입·복구 메일·복구 완료는 서버가 DB의 공유 제한을 통과한 뒤 Auth를 호출한다. 로그인은 이메일+접속망 8회/5분, 이메일 전체 30회/15분, 접속망 60회/5분을 적용한다. 가입은 이메일 3회/1시간·접속망 10회/1시간, 메일은 이메일 60초 간격 및 3회/15분·접속망 10회/15분, 복구 완료는 토큰 5회/15분·접속망 30회/15분이다. 허용된 시도는 성공 여부와 무관하게 계산한다. 영구 잠금이 아니며 차단된 요청으로 기간을 연장하지 않는다.

대기 초와 재시도 안내를 표시하며 입력 내용을 유지한다. 복구 메일은 가입 여부·메일 제한과 무관한 동일 응답 및 60초 안내를 제공한다. 따라서 버튼이 다시 활성화되어도 상위 한도나 native Auth 한도 때문에 메일이 즉시 재발송되지 않을 수 있다. native Auth의 같은 이메일 재발송 간격도 60초다.

`life_private.auth_request_buckets`에는 scope·HMAC 식별자·요청수·만료시각만 저장한다. 이메일/IP/복구 토큰/비밀번호 원문을 넣지 않는다. 서비스 키만 제한/정리 RPC를 호출할 수 있다. `AUTH_RATE_LIMIT_SECRET`은 별도의 32자 이상 무작위 서버 비밀이다. 비밀/DB/RPC 확인 실패 시 인증 요청을 중단한다. 원문 식별자를 로그하지 않는다.

`AUTH_TRUSTED_IP_HEADER`는 프록시가 클라이언트 값을 제거하고 단일 IP로 덮어쓸 때만 지정한다. 미지정·유효하지 않은 값은 공유 버킷을 사용하고 임의 X-Forwarded-For는 무시한다. IPv6는 /64로 묶는다. 공용 학교망의 실제 이용량을 측정한 뒤 한도를 조정한다. 요청량 제한은 서비스 거부 공격 전체를 막는 WAF를 대체하지 않는다.

Turnstile은 `AUTH_TURNSTILE_SITE_KEY`와 `AUTH_CAPTCHA_ENABLED=true`를 설정하고 native Supabase Auth에도 대응하는 비밀키·provider·활성화를 적용한다. 비밀키는 앱 브라우저에 넣지 않는다. 위젯은 한국어 안내·실패 재시도·만료 및 응답 후 초기화를 제공하며, native Auth가 토큰을 검증한다. 외부 환경에서는 설정 누락 또는 공개 테스트 키 사용 시 홈페이지 인증을 차단한다. 운영 배포 전 direct Auth의 누락/잘못된 토큰 거부를 실제로 확인해야 한다. 플래그만으로 native 설정 일치를 보장하지 않는다. 기관의 공급자·개인정보 처리 문안 검토도 필요하다.

로컬에서는 `node scripts/dev-local.mjs --build` → `node scripts/dev-local.mjs --production`으로 빌드/미리보기를 실행한다. 공개 환경변수는 빌드 시 고정되므로 로컬 실행에도 로컬 빌드가 필요하다. 기존 `.env.local`을 바꾸지 않는다. HMAC 키는 git 제외된 `supabase/.temp/auth-rate-secret`에 0600 권한으로 생성되어 재시작에도 유지된다. 기본 로컬은 외부 CAPTCHA를 사용하지 않는다.

`AUTH_LOCAL_CAPTCHA_TEST=pass` 또는 `fail`과 로컬 실행기를 사용하면 공식 공개 테스트 키로 native Auth까지 시험할 수 있다. 종료 후 환경변수를 제거하고 `node scripts/configure-auth-local.mjs` 및 기본 미리보기를 다시 시작해 복원한다. 테스트 키는 실제 봇 판별이 아니다. 테스트 모드 설정기는 전용 local project와 Docker 컨테이너를 확인한다.

만료 기록은 새 허용 요청 시 일부 정리한다. 운영에서는 `life_prune_auth_requests()`를 서비스 전용 스케줄에서 매일 호출하고 반환값이 10000이면 추가 배치를 실행한다. 만료 후 24시간이 지난 행만 삭제한다. 실제 스케줄러 설치·실패 감시는 아직 연결하지 않았으며, 미실행 시 기록이 남는다. 키 교체는 기존 제한을 새 키로 잇지 못하므로 점검 시간·대체 경계 제한을 준비한다.

검증: `node scripts/verify-auth-abuse.mjs`(DB/정책), 로컬 production 미리보기 후 `node scripts/verify-auth-abuse-http.mjs`(실제 액션), 이어 `node scripts/verify-auth-abuse-guards.mjs`(장애·CAPTCHA). 모두 전용 로컬/가상 계정만 사용한다. 마지막 검사는 native Auth 테스트 설정을 일시 변경 후 복원한다. [설계](docs/02-design/features/anchor-auth-abuse.design.md)·[검증 보고](docs/04-report/features/anchor-auth-abuse.report.md).

## 관리자 추가 인증·최근 인증

`/auth/security`에서 인증 앱의 QR/수동키 등록과6자리 확인, 추가 앱 연결·해제를 제공한다. COURSE_MANAGER·FINANCE·CERTIFIER·SYSTEM_ADMIN·PERFORMANCE 활성 계정은 MFA가 필수이며, 일반 수강생·INSTRUCTOR 단독 계정은 선택이다. 선택해서 등록한 계정도 이후 로그인에 추가 인증이 필요하다. 키·코드는 업무 DB나 브라우저 저장소에 따로 저장하지 않는다.

관리자 자료는 현재 세션의 AAL2와 유효한 TOTP factor를 확인한다. 관리자 계정의 `life_` 업무 데이터 저장·승인에는 실제 TOTP 확인 후15분 이내 조건을 추가한다. 토큰 갱신만으로 유효시간을 늘리지 않는다. 시간이 지나면 입력을 유지하고 새 창 추가 인증→원래 화면에서 다시 저장하도록 안내한다. 신규 `life_` 테이블을 추가할 때도 `life_recent_mfa_write` guard를 부착해야 한다.

비밀번호 복구에서도 MFA 등록 계정은 이메일 링크와 현재6자리 코드가 모두 필요하다. 코드가 없거나 틀렸다면 새 메일을 요청하고 다시 진행한다. 관리자는 화면에서 마지막 인증 앱을 삭제할 수 없으며 교체 앱을 먼저 추가한다. Native Auth factor API에도1분 유효·일회용 변경 허가와 현재 세션 확인을 적용하며, 관리자 마지막 factor 해제는 DB에서도 거부한다.

앱 분실 복구는 기관이 승인한 본인 확인·별도 승인·세션 회수·감사기록 후 신뢰된 관리 경로로 처리하는 운영 절차다. 이메일만으로 MFA를 해제하거나 자동 승인하지 않는다. 운영 담당자와 본인 확인 기준은 별도 확정이 필요하다. [설계](docs/02-design/features/anchor-admin-mfa.design.md), [검증 보고](docs/04-report/features/anchor-admin-mfa.report.md).

로컬 회귀 스크립트는 가상 계정에 native TOTP를 등록·확인한다. 테스트 키는 `/tmp/uc-life-mfa-fixtures.json`에0600 권한으로 보관하고 제품 코드에서 사용하지 않는다. 기존 테스트 계정으로 브라우저 로그인하면 인증 앱 확인 화면이 나타난다. 브라우저에서 직접 첫 등록을 보려면 별도의 가상 계정을 사용한다. 임시 키 파일을 잃었을 때 기존 factor를 자동 삭제하지 않는다. 실제 계정·키를 테스트에 입력하지 않는다.

이번 검사: 기존309개+MFA32개, 총341개 통과. 원격 환경에는 적용하지 않았다. 로컬 `configure-auth-local.mjs`는 정확한 비밀번호 정책과 TOTP 활성화를 함께 확인한다.

## 출결·시험·수료 운영 흐름

강사 공간의 기수 → 출결·시험 관리에서 수업·보강과 객관식 시험을 등록한다. 종료된 수업에 인정 출석분과 근거를 입력한다. 수강생 강의실의 출결·시험 확인에서 응시하며 임시저장·1회 최종 제출을 지원한다. 정답은 비공개이고 점수는 응시기간 종료 후 공개된다.

`/completion`에서 과정담당은 승인된 수료 정책에 맞는 계산 기준안을 작성한다. 별도 CERTIFIER 승인자가 문안과 산식을 검토한다. 기준은 출석률/모든 과제의 개별 최소점/모든 시험의 개별 최소점이며 빈칸은 명시적 미적용이다. 실제 기관 기준의 기본값은 없다. 전체 평가자료 등록을 마감하고 과정 종료 후 후보를 산출하면 다른 승인자가 확정한다. 누락·미채점은 검토 필요이고 원자료 변경은 이전 판정/확정을 재검토 대상으로 만든다. 승인된 기준은 새 정책 버전으로 변경한다.

시험은 문항별 동일 배점·객관식 단일선택·1회 응시이며 등록 후 수정 UI는 없다. 문항 오류·재응시·기준 소급 변경·공결 환산·가중 평균이 필요한 운영은 별도 설계를 거쳐야 한다. CERTIFIER 역할만으로 직인이나 증명 발급권을 부여하지 않는다.

## 이수증·강사 경력증명

`/mypage/certificates`에서 본인의 최신 수료 확정 또는 승인된 강의실적을 근거로 증명을 신청한다. 강사는 `/instructor/records`에서 종료 회차의 실제 강의시간과 내용을 제출하고, 과정담당은 `/credentials`에서 확인한다. 자기 실적은 승인할 수 없다. 예정 수업시간을 경력시간으로 간주하지 않는다.

기관의 유효한 CERTIFIER 역할에 문서종류별 발급 위임이 더해진 담당자만 증명을 승인한다. 서버는 승인된 자료로 한글 PDF·QR·원본 SHA-256을 생성해 비공개 DB에 보관한다. 파일과 발급 완료 상태는 함께 확정하며 실패 시 같은 건을 재시도한다. 다운로드는 같은 원본을 반환한다. 근거가 정정되면 이전 원본은 재검토 상태가 되고, 정정 신청·승인 후 새 번호로 대체한다. 취소에는 사유가 필요하다.

발급 명의·사업단장 직함/성명·유효기간·위임·서식·직인 또는 승인된 직인생략 근거는 신뢰된 DB 관리 경로로 등록한다. 실제 기관 설정은 마이그레이션에 포함하지 않았다. D05 기관 결정이 필요하며, 테스트 스크립트의 가상 발급자는 운영에서 사용할 수 없다. 자유 서식 편집·직인 업로드 화면은 아직 없다.

서버 전용 `SUPABASE_SERVICE_ROLE_KEY`와 검증 사이트의 고정 HTTPS 주소인 `CERTIFICATE_VERIFY_ORIGIN`이 필요하다. 공개 환경변수에 서비스 키를 넣지 않는다. `dev:local`은 전용 로컬 키와 `http://127.0.0.1:3100`을 주입한다. PDF는 2MB 이내로 제한되며 대규모 운영에서는 비공개 파일 저장소로 이관할 수 있다. 한글은 `assets/fonts/NanumGothic-Regular.ttf` 전체 글꼴을 임베드하며 OFL 라이선스를 함께 보관한다.

`/verify`는 QR의 fragment 토큰을 POST로 조회하고 주소에서 지운다. 공개 응답은 마스킹 이름과 최소 정보만 제공한다. 선택한 PDF는 브라우저에서 해시를 비교하며 서버에 업로드하지 않는다. QR·해시는 원본 대조 수단이며 PDF 전자서명 인증을 의미하지 않는다. 검증 API는 본문 1KB 제한, DB의 토큰별/전체 제한과 앱의 공유 제한을 적용한다. `TRUST_PROXY_IP=true`는 신뢰된 프록시가 전달 헤더를 덮어쓰는 환경에서만 설정하며, 이때 앱 제한을 IP별로 전환한다.

## 수강료 입금·환불

사용자 확인: **환불·감면 규정은 아직 미확정이며 규정 등록 후 사용**한다. 실제 기관의 수납 주체·모집/환불/개인정보 문안·보유기간·담당자 위임을 먼저 확정한다. 마이그레이션에는 운영 환불률이나 실제 계좌를 넣지 않는다.

신뢰된 DB 관리 경로로 승인 REFUND 정책과 `life_refund_rules` 조항을 등록한다. 조항은 수강료/확인입금 중 계산 기준과 분자·분모를 갖는다. 담당자는 요청시각·교육 진행·규정의 적용 조항을 확인하고 서버가 원 단위 내림 및 기지급 차감·입금 한도를 계산한다. 이는 법률상 환불률의 자동 판정이 아니다. 감면·장학금은 후속 기능이다.

과정담당은 기수 초안에서 수강료·규정·납부기한·승인 납부 안내를 연결한 뒤 공개한다. 유료 과정은 선발 후 납부 대기로 좌석을 예약하고, 기한 내 전액 배분된 입금이 확인돼야 강의실 이용을 허용한다. 늦은 입금은 자동 수강 확정하지 않으며 예외로 관리한다. 기한 만료는 명시적 정리와 후속 신청·선발·배분 트랜잭션에서 처리한다.

수강생은 `/mypage/payments`에서 청구·고정 환불 규정·입금 신고·환불 신청·처리 이력을 확인한다. 입금 신고는 확인된 입금이 아니다. `/finance`에서 실제 은행 거래를 대사한 뒤 입금을 기록하고 청구에 배분한다. 동일 기관/수강생의 여러 청구 배분과 분할 입금이 가능하다. 최근 청구/입금 100건을 표시하며 이는 전체 회계 총계 화면이 아니다.

환불신청은 수강취소와 학습 접근 종료를 동반한다. 산출 담당자와 승인자를 분리하고 승인 시 금액을 예약한다. 지급 담당자는 승인자와 달라야 한다. 홈페이지는 실제 송금하지 않으며 은행 업무의 시작·결과·고유 거래 참조·근거를 기록한다. 결과 불명은 거래 확인 상태로 남겨 재처리를 막고, 실제 미지급 확인 뒤에만 새 시도를 허용한다. 지급 완료와 청구 조정은 함께 저장해 허위 미납을 만들지 않는다.

FINANCE 역할 외에 `life_finance_grants`의 기관별 RECORD/APPROVE/PAYOUT 유효 위임이 필요하다. 계좌 원문은 수집하지 않으며 원입금자 반환 확인 문서 참조만 기록한다. 미배분/초과입금 반환, 확정 원장 정정 UI, 강사료·세무 증빙·은행 자동 연결은 후속이다. 기존 `COURSE_MANAGER`나 `CERTIFIER` 역할에 회계 권한을 자동 부여하지 않는다.

`verify-finance.mjs`는 새 가상 기수와 규정으로 37개 수납 검사를 실행한다. 기존 90개와 합계 127개가 통과했다. 실제 계좌나 돈을 사용하지 않는다.


## 안내문자 예약·홍보 선택동의

사업단 `/admin/messages`에서 기수와 승인 문안을 선택해 미리보기를 저장한다. 문안의 운영/홍보 종류와 대상 조건은 승인 당시 고정된다. 유효 신청자·수강중·납부대기·확정수료 조건과 검증 연락처·홍보 동의를 검사하며 제외 사유와 최대 5개 마스킹 표본을 표시한다. 15분 이내 미리보기에서 현재 이후 30일 이내 예약을 저장하고 취소할 수 있다. 최근 100개 작업을 보여준다.

`/mypage/notifications`는 본인과 관련 있는 기관의 인증 연락처 상태, 연결 해제, SMS 홍보 원문/버전 선택동의·철회, 최근 20개 변경 이력을 제공한다. 동의는 기본 미선택이며 수강·LMS 이용 조건이 아니다. 철회/연락처 해제는 대기 중 대상에서 즉시 제외한다. 예약 및 처리 시 계정·관계·권한·동의·인증 유효성을 다시 검사한다.

**실제 SMS는 전송하지 않는다.** 업체·발신번호·요금·위탁 조건·보유기간·휴대전화 본인확인 모듈을 연결하기 전 단계다. 전화번호 평문 입력을 받지 않고 승인된 인증 모듈에서 등록할 opaque 참조와 마스킹만 설계했다. 현재 본인확인 연계용 등록 API/UI는 없다. 승인된 `life_message_templates`와 SMS용 지정 `life_message_marketing_policies`는 신뢰된 DB 경로로 등록한다. 일반 MARKETING 정책을 SMS 동의로 자동 간주하지 않는다. 현재 설정에는 LIVE 값 자체가 없다.

기본 예약 상태는 업체 연결 대기이며 실제 전송 성공을 표시하지 않는다. TEST 설정도 자동 실행되지 않는다. 로컬만 허용하는 `node scripts/process-messages-local.mjs <job-uuid>`로 예약시각 이후 최대 100개를 가상 처리한다. 합성 자료 외에는 사용하지 않는다. test claim/finish는 service_role 전용이며 일반 관리자도 호출할 수 없다. 처리 만료는 결과 확인 필요로 남겨 자동 재시도를 막고, 동일 키·유효 lease의 가상 결과만 확정한다. TEST_PROCESSED는 실제 전달 증빙이 아니다. 실제 공급자 결과 대사·서명 검증 callback·재시도 화면·스케줄러는 후속 연계 범위다.

새 문자 검증 39개와 기존 127개 검증이 통과했다. 모든 데이터는 가상이며 원격 DB/실제 문자 업체에는 변경·발송하지 않았다. [설계](docs/02-design/features/anchor-messaging.design.md)와 [결과 보고](docs/04-report/features/anchor-messaging.report.md)에 구현 범위와 증거를 기록했다.


## 연차 평가·성과 보고

`/performance`는 사업연도 귀속 기준의 현재 운영 통계를 제공한다. 실인원과 수강건수·수료건수를 구분하고 원자료 변경·미확인 판정·연도 경계 예외를 표시한다. 아카데미 필터는 공식 보고 범위를 변경하지 않는다.

`/quality/[기수]`에서 승인된 조사 안내문·공개 기준으로 종강 후 설문을 개설한다. `/mypage/surveys`에서 본인 초대에 선택 응답한다. 참여와 답변을 분리하고 마감 후 사업단이 집계를 확정해 기준 인원 이상일 때만 점수를 공개한다. 수료·증명은 설문 참여에 종속되지 않는다. 강사 의견 → 사업단 검토 버전 → 개선 과제 → 다음 기수 반영 → 별도 확인을 연결한다.

PERFORMANCE 역할과 `life_performance_grants`의 PREPARE/APPROVE 위임을 분리한다. 지표 정의·외부 실적·보고를 등록한 뒤 별도 담당자가 확정한다. 본인이 작성하거나 외부 자료를 입력한 보고를 본인이 승인할 수 없다. 원자료 변경은 초안 확정을 막고 기존 확정본에 재검토 표시를 남긴다. 정정은 이전 확정본을 보존하는 새 버전이다. 승인된 JSON만 인증·no-store로 내려받을 수 있다.

실제 지표 산식·분모·중복 기준 및 조사 문안·보유기간·최소 응답수는 아직 승인됐다고 간주하지 않는다. C1 목표표는 참고이며 임의 실적을 생성하지 않는다. D06 지원지수의 목표/산식 불일치 확인과 복합지수 구현, 대외 제출, 증빙파일 업로드·검증, 개선과제 재배정·반려는 후속이다.

새 37개와 기존 166개, 총 203개 검증이 통과했다. [설계](docs/02-design/features/anchor-annual-evaluation.design.md), [검사](docs/03-analysis/anchor-annual-evaluation.analysis.md), [결과](docs/04-report/features/anchor-annual-evaluation.report.md)에 범위·증거를 기록했다. 데이터·정책·계정은 로컬 가상 검증용이다.

## 디지털배지 발급·검증

`/credentials/badges`에서 과정담당이 기수별 배지 정의를 작성한다. CERTIFIER 역할과 유효한 BADGE 발급 위임이 있는 별도 담당자가 승인한다. 기존 이수증·경력증명 위임은 배지 위임을 자동 부여하지 않는다. 기관 명의·발급권·BADGE/BADGE_SHARE 정책은 실제 기관 승인 후 신뢰된 DB 경로로 등록한다.

수강생은 `/mypage/badges`에서 승인 기준과 최신 확정 수료를 확인하고 신청한다. 위임자는 근거를 확인해 발급하거나 사유를 남겨 반려한다. 본인 발급은 금지한다. 발급 원본과 번호는 불변이며, 근거 변경·취소·만료는 현재 상태에 반영한다. 정정 발급은 이전 배지를 대체하면서 당시 원본을 보존한다. 수강이력·나의 공간·증명 관리에서 배지 메뉴로 이동할 수 있다.

배지는 기본 비공개다. 본인이 승인 공유 안내문을 확인하고 선택 동의해야 링크를 생성한다. 링크 교체·철회는 즉시 반영하며 원문 토큰을 DB에 저장하지 않는다. `/badges/verify`는 코드로 마스킹 이름·과정·발급기관·현재 상태 등 최소 항목만 조회한다. 계정 비활성·인증 연결 해제·공유 안내 만료도 조회를 제한한다. 받은 JSON은 브라우저에서만 SHA-256을 비교한다. 본인 및 위임자의 현재 유효 배지 원본 다운로드는 인증과 no-store를 적용한다.

원본 형식은 홈페이지 내부용 `U_LIFE_BADGE_V1` JSON이다. Open Badges 서명·표준 적합성 인증·외부 지갑 연동을 구현한 것으로 표시하지 않는다. JSON 원본에는 성명이 포함되어 있으므로 내려받은 파일을 공유할 때 화면 안내를 확인한다. 일괄 발급·복합 역량 조합·이미지 업로드·보유기간별 파기·대규모 부하 검사는 후속이다.

새 34개와 기존 203개, **총 237개 검사**가 통과했다. 18개 migration 재생, lint/build, 로컬 DB 보안 점검 및 실제 브라우저 발급 → 원본 다운로드 → 공유 검증 → 철회 흐름을 확인했다. [설계](docs/02-design/features/anchor-digital-badges.design.md), [검사](docs/03-analysis/anchor-digital-badges.analysis.md), [결과](docs/04-report/features/anchor-digital-badges.report.md)에 증거와 한계를 기록했다. 로컬 가상 데이터이며 운영 사이트에는 적용하지 않았다.

## 강사 이력 심사·과정 개발

사용자 확인: **강사 등록·자격 심사 기준은 미확정이며, 승인 기준 등록 후 사용**한다. 실제 등급·강사료·세율 기본값은 없다. 기관의 `INSTRUCTOR_PRIVACY`, `INSTRUCTOR_REVIEW`, `INSTRUCTOR_PUBLIC`, `DEVELOPMENT` 정책을 승인 문안·보유기간과 함께 신뢰된 DB 경로로 등록한다.

`/mypage/instructor`에서 강사 역할이 없는 회원도 개인정보 안내를 확인한 뒤 이력을 작성한다. 학력·자격·산업/강의 경력의 기관·기간·증빙 참조를 저장하고 심사를 신청한다. `/admin/instructors`에서 기관 과정담당이 제출된 자료를 대조해 보완·반려·승인한다. 미제출 초안은 담당자에게 공개하지 않는다. 승인에는 외부 증빙 확인·사유·유효기간을 요구하며 자기 승인을 막는다. 보완은 이전 내용을 보존한 새 버전이다.

공개 소개는 승인 후 별도로 선택 동의한다. 현재 승인·정책·역할·배정이 유효할 때만 실제 공개 과정에 이름·전문분야·공개 소개를 표시한다. 심사용 이력·증빙·연락처는 공개하지 않는다. 철회·배정 해제·계정 비활성·인증 연결 해제는 공개를 제한한다. 새 이력 버전 작성은 기존 공개를 끄고 재심사한다.

이력 승인으로 위촉·계약·INSTRUCTOR 역할을 자동 부여하지 않는다. 실제 위촉 확인 후 신뢰된 역할 등록과 기존 기수 배정 절차를 사용한다. 입력한 외부 경력은 앵커사업단 경력증명에 자동 포함되지 않는다. 경력증명은 기존 확정 강의실적만 사용한다.

`/development`에서 현재 강사 또는 유효 이력 승인자가 신규·개편 과정을 제안한다. 수요 근거·대상·역량·차시별 이론/실습 시간·장비·평가안·예산 근거를 저장한다. 제출 뒤 내용은 고정되며 시간 합계·정책·제안 자격을 DB에서도 검증한다. 별도 과정담당의 승인은 불변 과정 버전을 생성한다. `/admin/development`에서 승인본으로 여러 기수 초안을 개설하고 기존 모집·수납·강사 배정 절차로 이어간다. 승인 당시 수료 정책을 다른 정책으로 바꿔 공개할 수 없다.

최초 제안 유형과 후속 승인 버전을 구분한다. 같은 과정의 후속 승인은 개편, 같은 승인본의 반복 기수 개설은 별도 개발 건수가 아니다. 연도별 화면은 승인 취소를 제외한 내부 심의 원장이며 공식 RISE 산식을 자동 변경하지 않는다. 승인 취소·새 심의 초안은 신규 개설/공개를 제한하고 기존 운영 자료는 보존한다.

증빙 파일 업로드·외부 자격 진위 API·위촉/계약 관리·강사료/세무·기관별 이력 승인 정지 UI·위원회 다단계 심의·전체 검색/페이지네이션·개인정보 파기는 후속이다. 목록은 최근 등록 100건과 추가 자료 존재 여부를 표시한다. 저장소 없이 파일 첨부 성공을 표시하지 않으며 문서 참조만 받는다.

기존 237개와 새 33개, **총 270개 검사**가 통과했다. 19개 migration 재생, DB 보안 점검, lint/build와 브라우저 이력 제출·승인·공개/철회·과정 제출·승인·기수 개설·모집 공개를 확인했다. [설계](docs/02-design/features/anchor-instructor-development.design.md), [검사](docs/03-analysis/anchor-instructor-development.analysis.md), [보고](docs/04-report/features/anchor-instructor-development.report.md). 검증 계정은 스크립트가 만든 `[검증용] 강사·개발 사업단`을 기관 선택에서 골라 사용한다. 실제 운영 데이터와 원격 DB는 변경하지 않았다.
