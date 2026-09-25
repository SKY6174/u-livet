# 운영 문서 목록 최적화 설계 비교

2026-09-25 · anchor-operation-list-performance

## 설계 일치: 8/8

| 항목 | 검증 |
| --- | --- |
| 기존 public RPC 이름과 JSON 필드 유지 | 로컬 원본/개선 JSON 객체 집합 비교 통과 |
| MFA·인증 실패 차단 유지 | 함수 시작의 기존 FORBIDDEN 검사 보존, anon EXECUTE 권한 없음 확인 |
| active 사용자 식별 1회 | `v_person` 한 번 계산 |
| 활성 기관별 관리자/강사 역할 1회 | 역할 할당 한 번 조회, 기존 시간 경계 유지 |
| 관리자 기관 과정 허용 | 129개 과정의 전체 행/필드 일치 |
| 책임강사+활성 강사 역할+유효한 배정 | 책임강사 1개 과정 일치 |
| 권한 없는 사용자 차단 | 결과 0개 일치 |
| 기존 JOIN, 상태·순서식 유지 | 동일 SQL 구조, 날짜/과정명 정렬 유지 |

원본 `ORDER BY starts_on DESC, name`에 동률의 고정 순서가 없으므로 JSON 배열 자체의 바이트 동일성 대신 ID를 포함한 JSON 객체 집합과 건수를 비교했다. 양쪽 모두 129/1/0개로 일치했다. 로컬 원본 함수와 운영 DB 원본 함수의 정의 MD5도 `11c33726159f4a1f12ca20257731c84e`로 같았다.

## 성능·검증

로컬 DB(154개 과정)에서 기존 MFA 확인 시험 관리자에게 접근 가능한 과정 129개를 대상으로, 하나의 트랜잭션에서 기존/새 함수를 번갈아 6쌍 실행했다. 첫 쌍을 제외한 5쌍 중앙값: **1,749.68ms → 4.41ms**, 약 99.75% 감소. 전체 변경은 트랜잭션 ROLLBACK으로 되돌렸다. 이는 로컬 SQL 실행시간으로 운영 HTTP 화면 시간은 아니다.

운영 프로젝트는 ACTIVE_HEALTHY(Postgres 17.6.1)이며 변경 전 누적 `pg_stat_statements`의 `life_operation_list()` 평균은 477.2ms(212회)다. 이 누적 값은 다른 데이터·시점의 측정이므로 로컬 개선율을 운영 개선율로 환산하지 않는다.

`npm run build`에서 설명서 검사, 컴파일, lint, TypeScript, 정적 생성 통과. `git diff --check` 통과. 전체 `verify-operation-documents.mjs`는 함수 변경과 관계없는 기존 시험 입력의 `completionAttendancePercent=10`이 현행 유효 범위 80~100을 위반하여 397행에서 중단됐다. 중단 전에는 관리자 접근·익명/미배정 거부·개인 지급정보 차단 검사까지 통과했다. 새 함수의 동등성은 `node scripts/verify-operation-list-optimization.mjs`로 별도 검증했다.

보안 advisor는 ERROR/WARN 없이 INFO `rls_enabled_no_policy`만 보고했다. [진단 설명](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). 신규 표·권한 부여·RLS 변경은 없다.
