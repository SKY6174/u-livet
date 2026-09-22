# Supabase 인증 호환성 확인 및 Preview 인수

2026-09-19 · `anchor-hosted-auth-preflight` / `anchor-preview-db-validation` 후속 확인 반영

**ANCHOR 조직의 `uc-life`를 찾았고 원격 메타데이터 조회를 완료했다. 운영 인증 호환성 판정은 아직 미완료다.** 처음 사용한 MCP 연결에는 SKY6174 조직만 보였으나 CLI 연결에는 ANCHOR도 보였다. 프로젝트가 없었던 것이 아니라 연결별 접근 범위가 달랐다.

## 확인한 실제 대상

| 항목 | 조회 결과 |
|---|---|
| 조직 / 프로젝트 | ANCHOR / uc-life |
| 조직 요금제 | Pro (Preview 생성 준비 중 후속 조회로 확인) |
| Project ref | `uoebygejgglgiivzgyks` |
| 위치 / DB | ap-northeast-1 / PostgreSQL 17 |
| 프로젝트 상태 | ACTIVE_HEALTHY |
| 브랜치 | main + preview. Preview ref `bfqwntulxabfrimcypvx` (후속 생성 완료) |
| 브랜치 메타데이터 상태 | MIGRATIONS_FAILED; 009에서 동명 정책 생성 충돌(SQLSTATE 42710) 확인 |
| 적용 migration | main 001~008 총 8개 유지. Preview는 업무용 11개 추가 적용 후 총 19개 |
| 현재 저장소 migration | 총 22개. Preview에는 마지막 Auth 복구·MFA·남용 방지 3개 미적용 |
| 인증 의존 컬럼 | 19개 모두 존재, 타입 목록 확보 |
| 기대 복구·MFA 트리거 | 4개 모두 아직 없음 |
| postgres 권한 조회 | 대상 Auth 테이블 5개에서 SELECT/TRIGGER=true |

프로젝트 건강 상태와 과거/현재 브랜치 작업 상태는 다른 지표다. `MIGRATIONS_FAILED`는 main의 기존 작업 상태이며 Preview는 FUNCTIONS_DEPLOYED/ACTIVE_HEALTHY다. 이를 DB 전체 장애라고 해석하지 않는다. 트리거 권한의 catalog 결과도 실제 DDL 허용과 공급자 지원 계약을 보장하지 않는다. 사용자·세션·비밀번호 해시·감사 로그 데이터 행은 조회하지 않았다. 후속 단계에서 Preview의 업무 schema와 최소 길이 설정만 변경했고 main은 유지했다.

## 배포 전에 해결해야 할 차이

### 확정 비밀번호 규칙과 관리 API 프리셋

요구사항은 **12자 이상, 영문·숫자·ASCII 특수문자, 대소문자 혼용 의무 없음**이다. 현재 공식 Management API의 `password_required_characters` enum은 다음 선택지를 제공한다.

| 프리셋 | 확정 규칙과의 차이 |
|---|---|
| 영문 한 집합 + 숫자 | 특수문자 의무가 빠짐 |
| 소문자 + 대문자 + 숫자 | 대소문자를 각각 요구, 특수문자 의무가 빠짐 |
| 소문자 + 대문자 + 숫자 + 특수문자 | 대소문자를 각각 요구 |
| 빈 값 / null | 문자 조합 강제 없음 |

따라서 **현재 공개 API의 프리셋만으로는 확정 조건을 그대로 표현할 수 없다.** 로컬 GoTrue의 사용자 지정 문자 집합이 hosted 관리 API에서도 지원된다고 가정하지 않는다. 기관 요구사항을 유지한 채 공급자가 지원하는 다른 강제 수단이 있는지 확인하고, 없으면 운영 인증 구성을 재설계한다. 앱 입력 검사만 통과시키고 직접 Auth API에서 약한 비밀번호가 허용되는 상태는 인수하지 않는다. [공식 관리 API](https://supabase.com/docs/reference/api/v1-update-auth-service-config), [공개 OpenAPI 스펙](https://api.supabase.com/api/v1-json)

### DB 감사 기록에 대한 의존

현재 복구 migration은 `auth.audit_log_entries`의 비밀번호 변경 이벤트가 같은 transaction에 쓰였는지 확인하여 새 비밀번호 정책 준수를 기록한다. Supabase의 DB 감사 기록 저장은 선택 설정이다. 외부 로그나 대시보드에서 이벤트가 보이더라도 이 DB 트리거는 실행되지 않을 수 있다. DB 저장 활성 여부와 실제 비밀번호 변경 이벤트의 내용·순서를 별도로 확인해야 한다. 이번에 읽은 Management API 스펙에는 해당 저장 옵션이 없어 이 검사 도구로 자동 판정하지 않는다. [Auth Audit Logs](https://supabase.com/docs/guides/auth/audit-logs)

### 관리형 Auth 테이블의 트리거

기존 MFA migration은 `auth.mfa_factors`의 INSERT/DELETE에 허가 확인 트리거를 만든다. 공급자의 schema 제한 문서에 명시된 트리거 허용 목록에는 이 테이블이 포함되어 있지 않다. 반면 이번 uc-life catalog 조회에서는 postgres의 TRIGGER 권한이 true였다. **문서 범위와 catalog 권한을 구분**하고 공급자 지원 및 별도 Preview 실제 migration 실행 결과로 확인한다. 읽기 권한/컬럼 존재만으로 통과 처리하지 않는다. [관리형 schema 제한](https://supabase.com/changelog/34270-restricting-access-on-auth-storage-and-realtime-schemas-on-april-21-2025)

### 메일 템플릿 및 실제 인증 설정

현재 한국어 복구 메일은 `/auth/reset-password#token_hash=...` 연결을 사용한다. 후속 조회에서 custom SMTP 미설정, ANCHOR 조직은 Pro임을 확인했다. 따라서 신규 Free 프로젝트의 기본 SMTP 템플릿 편집 제한을 이 프로젝트의 차단 사유로 적용하지 않는다. 실제 한국어 템플릿·발신자·수신·복구 연결 인수는 별도로 필요하다. [이메일 템플릿 변경 공지](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier)

초기에는 브라우저 로그인과 프로세스 토큰이 없어 실제 설정을 조회하지 못했다. 후속 진단에서 기존 Supabase CLI의 macOS 자격 증명을 메모리에서만 재사용하여 공식 Management API GET으로 설정을 확인했다. 토큰·SMTP 비밀·전체 응답을 출력하거나 파일에 저장하지 않았고 `.env.local`을 읽지 않았다. 별도 `check:hosted-auth` 도구의 토큰 입력 방식은 변경하지 않았다.

| 실제 설정 요약 | 2026-09-19 조회 |
|---|---|
| 최소 길이 / 문자 조합 | main 6 / null; Preview는 후속 설정 후 12 / null |
| 이메일 가입 / 메일 자동 확인 | 활성 / 비활성 |
| 메일 OTP 유효시간 / 최소 발송 간격 | 3,600초 / 60초 |
| Native CAPTCHA | 비활성 |
| TOTP 등록 / 검증 | 활성 / 활성 |
| Custom SMTP | 미설정 |

이는 설정 조회 결과이며 실제 가입·메일 발송·MFA 행동 시험은 아니다. 설정 차이를 해결하기 전 운영 인증 인수는 완료되지 않는다. [실패 진단과 재시도 절차](supabase-migration-retry.md), [인증 구성 결정안](auth-deployment-decision.md)을 함께 참조한다.

후속으로 [별도 Preview](supabase-preview.md)를 생성했다. 확정된 사용자 지정 문자 집합과 최소 12자 설정을 Preview에 함께 PATCH한 요청은 HTTP 400으로 거부됐으며, 재조회에서 설정이 바뀌지 않은 것을 확인했다. 이후 최소 길이만 PATCH하여 12자 적용을 확인했다. main 설정은 유지했다. API 오류 응답 본문을 보관하지 않았으므로 상세 검증 메시지를 인용하지 않는다. 정확한 문자 조합 지원 여부의 판단은 이 관측과 공개 enum을 함께 근거로 한다.

## 준비한 도구

```sh
npm run test:hosted-auth
npm run check:hosted-auth -- --help
```

오프라인 비교는 비밀값 없이 정리한 설정 파일로 실행한다. 예시 파일은 null이므로 실패가 정상이다. 아래 도메인은 형식 설명용이며 실제 구축된 Preview 도메인이 아니다.

```sh
npm run check:hosted-auth -- --config-file ops/hosted-auth.example.json --site-origin https://stage.uc.ac.kr
```

실제 Preview를 만든 뒤에는 별도 보호된 프로세스 환경에 `SUPABASE_ACCESS_TOKEN`을 제공하고 아래 명령의 값을 교체한다. `.env.local`은 자동 탐색하거나 덮어쓰지 않는다. 이 토큰은 서버에서 사용하는 Supabase service role key와 다르다. 기존 CLI 로그인 토큰 저장소를 이 도구가 읽지는 않는다.

```sh
npm run check:hosted-auth -- --live --preview-ref PREVIEW_REF --production-ref PRODUCTION_REF --site-origin PREVIEW_HTTPS_ORIGIN
```

live는 서로 다른 20자 프로젝트 ref를 요구하며 고정 Management API로 GET 한 번만 한다. 리다이렉트를 따르지 않고 10초·1 MiB 제한을 적용한다. config 전체·SMTP/CAPTCHA 비밀·토큰·공급자 에러 원문을 출력하지 않는다. 입력 설정을 저장하거나 PATCH, migration, 가입, 메일 발송을 수행하지 않는다.

| 결과 | 의미 |
|---|---|
| CONFIG_BLOCKED / 종료 1 | 설정 불일치·누락 또는 입력/조회 실패 |
| CONFIG_MATCH_RUNTIME_PENDING / 종료 0 | 설정 비교만 통과. 실제 native API·DB 이벤트·MFA 시험 미완료 |

이 검사는 필요한 일부 Auth 설정을 비교한다. 감사 기록 저장, SMTP/CAPTCHA 키 유효성, 실제 비밀번호 허용·거부, DB 트리거·session 동작을 검증하는 도구가 아니다. 현재 API의 프리셋 대신 사용자 지정 문자열과 정확히 비교하므로, 공급자가 다른 동등한 표현을 지원한다면 증거 검토 후 비교 설계를 수정한다.

메타데이터 진단 SQL은 migration에 포함하지 않는다. 대상 Preview가 확인된 뒤 명시적으로 실행한다. uc-life main에 대해서는 이번에 동일한 SELECT만 수행했다.

```sh
supabase db query --linked --project-ref PREVIEW_REF --file scripts/inspect-hosted-auth.sql --output-format json
```

`--project-ref`만으로는 현재 CLI에서 동작하지 않아 `--linked`를 함께 지정한다. `supabase link`, reset, push, migration apply는 필요 없다. 쿼리는 pg_catalog만 읽으며 컬럼/타입, postgres 권한, 기대 트리거의 존재·활성·연결 함수만 반환한다. 트리거 본문 전체의 동일성을 증명하지 않는다.

## 후속 인수 시험 순서

1. Cloud Preview 업무 DB는 총 19개 migration, 업무 테이블 84개 RLS, 익명 REST 3건을 검증했다. [검증 보고서](../04-report/features/anchor-preview-db-validation.report.md)를 기준으로 현재 이력을 재확인한다.
2. 사용자는 별도 인증 서버 운영 설계를 선택했다. [운영 설계](self-hosted-auth-design.md)의 DB 배치와 운영 책임을 확정하고 별도 시험 스택을 준비한다. Cloud main에 미적용 파일을 일괄 밀어 넣지 않는다.
3. 새 시험 스택에서 정확한 native 비밀번호 정책을 먼저 구성한 뒤 전체 migration과 DB 감사/MFA를 검증한다. metadata 성공 뒤에 아래 행동 시험을 한다.
4. 기관이 지정한 시험 계정·수신함·실제 CAPTCHA 토큰으로 검증한다. CAPTCHA 실패와 비밀번호 정책 실패를 구분하고 보안을 끄지 않는다.
5. 원격 검증 결과/담당자/시각/설정과 소스 지문을 기록한다. `ops/release.example.json`의 관련 항목은 실제 증거가 생긴 후 확인 처리한다.

| 시험 | 기대 결과 |
|---|---|
| 소문자만+숫자+특수문자, 정확히 12자 | 가입/비밀번호 변경 허용 |
| 대문자만+숫자+특수문자, 정확히 12자 | 가입/비밀번호 변경 허용 |
| 11자 / 영문 없음 / 숫자 없음 / 특수문자 없음 | 직접 Auth API에서도 각각 거부 |
| 복구 증명 만료·재사용·다른 기기 | 만료/재사용 거부, 유효한 다른 기기 복구 성공 |
| 정책 전 계정·변경 전 session | 업무 자료 접근 거부, 본인 재설정 후 기록 연결 유지 |
| DB 감사 저장·변경 이벤트 | credential 정책 상태가 실제 native 이벤트로 갱신, 해시 rehash만으로 승인되지 않음 |
| MFA 첫 등록·잘못된 코드·이전 AAL2·직접 factor API | 올바른 등록 경로만 허용, 재인증 없는 변경/우회 거부 |
| 관리자 마지막 factor·분실 복구 | 임의 제거 거부, 승인된 복구 절차와 session 회수 확인 |

기존 `verify-auth-recovery.mjs`, `verify-admin-mfa.mjs` 등은 **전용 로컬 자료에 묶인 검사**다. 프로젝트 보호 조건을 지워 main 또는 Preview에 실행하지 않는다. 실제 원격 행동 시험은 대상·계정·부작용·정리 범위를 정한 별도 절차로 진행한다.

## 이번 결과

초기 preflight 결과는 합성 검사 70개와 배포 준비 검사 111개 통과, 로컬 컬럼 19개/활성 트리거 4개, 원격 main 컬럼 19개/트리거 미설치였다. 이후 Preview만 최소 비밀번호 길이를 12자로 변경하고 업무 migration 11개를 적용했다. 사용자 비밀번호·MFA 요소 변경이나 실제 메일 발송은 하지 않았다. **현재 Cloud Preview 인증은 요구조건 미충족이며, 다음 인증 인수는 사용자가 선택한 별도 서버 설계에 따라 진행한다.**
