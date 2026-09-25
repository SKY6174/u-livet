# 운영 문서 목록 DB 최적화 설계

2026-09-25 · [계획](../../01-plan/features/anchor-operation-list-performance.plan.md)

## 함수

`life_private.operation_list()`만 `CREATE OR REPLACE` 한다. public `life_operation_list()`의 인자와 반환 형태는 유지한다. `SECURITY DEFINER`, `search_path=''`, 기존 권한 GRANT를 유지하고 테이블 참조는 모두 스키마를 명시한다.

1. 시작에서 `auth.uid()`와 `life_private.mfa_verified()`를 검사한다. 둘 중 실패하면 기존 `FORBIDDEN` 예외를 낸다.
2. `life_private.person_id()`를 한번 호출한다. NULL이면 기존처럼 빈 배열을 돌려준다.
3. 현재 시각의 활성 `COURSE_MANAGER`/`SYSTEM_ADMIN` 기관과 활성 `INSTRUCTOR` 기관을 역할 할당에서 각각 중복 없이 배열로 만든다. 유효기간의 경계(`valid_from<=now()`, `valid_until>now()`)는 기존 `has_role`과 동일하다.
4. 과정의 관리자 플래그는 관리자 기관 배열 포함 여부다. 행 접근은 관리자이거나, 본인이 책임강사이고 해당 과정에 유효한 강사 배정이 있으며 과정 기관에 활성 강사 역할이 있는 경우다. 기존 `operation_access`/`teaches`/`operation_manager`의 논리식과 동일하다.
5. 응답 JSON 필드와 과정 순서, 모든 JOIN은 현재 운영 함수 그대로 둔다. `life_operation_documents`의 계획/결과 상태는 기존처럼 별도 LEFT JOIN 한다.

## 검증·배포

CLI가 생성한 migration 파일을 사용한다. 로컬 DB 트랜잭션 안에서 기존 함수를 임시 복제하고 새 정의를 적용하여, 기존 MFA 유효 시험 계정의 관리자·강사·비권한 결과를 JSON 객체 집합으로 비교한다. 동일 트랜잭션 안의 교차 실행으로 SQL 실행시간을 측정하고 롤백한다. 실제 로컬 PostgREST 회귀를 수행한다. 운영 적용 전후에는 인증된 사용자의 자료를 읽지 않고 함수 정의·권한·배포 revision/health·공개 접근 차단을 확인한다. 검증된 DB migration과 앱 commit을 `main`에 반영한다.

참고: [Supabase RLS 성능](https://supabase.com/docs/guides/database/postgres/row-level-security), [PostgreSQL EXPLAIN](https://www.postgresql.org/docs/current/sql-explain.html).
