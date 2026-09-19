# DB 연동 점검 결과

점검일: 2026-09-19 12:44~12:46 KST

기존 [운영 구성](../operations/managed-cloud-release.md)과 [플랫폼 설계](../02-design/features/anchor-lifelong-education-platform.design.md)를 기준으로 연결 및 조회를 확인했다. 기능 구현이나 DB 변경은 수행하지 않았다.

## 결과

| 검사 | 결과 |
|---|---|
| 운영 Supabase `uoebygejgglgiivzgyks` | `ACTIVE_HEALTHY`, 실제 SQL 조회 성공 |
| Preview Supabase `bfqwntulxabfrimcypvx` | 브랜치 조회에서 `ACTIVE_HEALTHY`, 실제 SQL 조회 성공 |
| 양쪽 스키마 기본 현황 | 각각 public 테이블 92개, 뷰 5개 |
| 마이그레이션 이력 | 각각 23개, 버전·이름 목록 일치 |
| `.env.local` 공개 키 | 운영 DB의 `life_catalog`, `life_policy_versions` 조회 HTTP 200 |
| `.env.local` 서버 키 | 운영 DB의 `life_catalog` HEAD 조회 HTTP 200 |
| 운영 Auth 상태 | `/auth/v1/health` HTTP 200 |
| 운영 앱 → DB | `https://uc-life.org/api/health` HTTP 200, `{"status":"healthy"}`, 캐시 MISS |
| 운영 과정 페이지 | `/courses` HTTP 200 |
| 비로그인 개인정보 조회 | `life_people` 조회 HTTP 401 / SQLSTATE 42501, 접근 거부 |
| 운영 public 테이블 RLS | 미설정 테이블 0개 |
| 운영 보안 Advisor | WARN/ERROR 0개, `rls_enabled_no_policy` INFO 63개 |

`/api/health` 구현은 실제 `life_catalog` 조회 성공 여부로 상태를 반환한다. 운영 `/api/version` 확인 당시 revision은 `05d76d5379f1e075a549368a08c19c54c63cf49a`, environment는 `production`, reviewOnly는 `false`였다.

운영 `life_offerings` 전체·공개 과정 모두 0건이며, 운영·Preview `life_catalog`도 0건이다. 과정 조회의 빈 결과는 이번 검사에서 연결 오류가 아닌 실제 등록 데이터 부재로 확인됐다.

## 범위와 제한

- Preview 웹 `/api/health`, `/api/version`은 접근 보호로 HTTP 302를 반환했다. Preview DB 직접 조회는 성공했지만 Preview 앱을 통한 DB 조회는 이번에 검증하지 않았다.
- 보안 Advisor의 INFO는 RLS가 켜져 있지만 정책이 없는 테이블에 대한 알림이다. 전체 역할별 업무 권한의 정확성을 보장하는 결과는 아니다. [공식 설명](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- 데이터 변경 없이 연결·읽기 및 비로그인 접근 거부를 확인했다. 로그인 사용자별 저장·수정·삭제는 이번 범위에서 실행하지 않았다.
- 소스 코드, 환경변수, 운영·Preview 데이터 및 스키마를 변경하지 않았다. 비밀키 값은 출력하거나 기록하지 않았다.

후속 검증은 Preview에서 승인된 시험 계정으로 로그인하고 주요 업무의 저장·수정 및 역할별 접근을 확인하는 것이다.
