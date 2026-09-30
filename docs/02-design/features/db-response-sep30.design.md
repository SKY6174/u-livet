# 운영 DB 신원 조회 최적화 설계

2026-09-30 · [계획](../../01-plan/features/db-response-sep30.plan.md)

## SQL 변경

`life_private.identity()`의 시작에 `person AS MATERIALIZED (SELECT life_private.person_id() AS id)`를 둔다. 기존 `member_entry_orgs()`의 신원 검증 조건은 이 함수 안에서 이미 검증한 `person.id IS NOT NULL`로 대체한다. 기관 목록은 같은 `member_entry_operators`·`life_organizations`·`auth.users` 조인, `auth.uid()`, `email_confirmed_at`, `deleted_at` 조건을 그대로 사용한다. JSON 정렬과 `is_super_admin` 집계도 유지한다.

최종 `life_people` 조회는 `person.id`로 제한한다. 기존 JSON 필드와 `STABLE SECURITY DEFINER SET search_path=''`, 함수 소유자·기존 EXECUTE 권한을 유지한다. 일반 `member_entry_orgs()` 함수는 다른 호출자가 사용하므로 변경하지 않는다.

## 검증

- 동일한 이름의 8개 로컬 마이그레이션을 운영 이력의 버전으로 이름 변경한다. 기존 SQL은 수정하지 않는다. CLI dry-run에서 새 마이그레이션 1건만 남는지 확인한다.
- 운영 DB 트랜잭션 안에서 후보를 임시 함수로 만들고 기존 함수와 비교한다. 기존 세션의 유효·무효 상태와 익명 상태를 `authenticated` 역할의 합성 JWT로 검사한다. JSON·식별자는 출력하지 않고 동등 여부와 시간만 남긴다. 마지막에 `ROLLBACK`한다.
- 동등성과 중앙값 개선이 확인되면 CLI가 생성한 새 migration에 동일 SQL을 기록한다. Preview/운영 마이그레이션 상태를 확인하고 운영에 적용한다.
- 공개 health·로그인·과정 목록과 DB 함수 정의/권한을 재확인한다. 기존 회귀 검사, lint, TypeScript, build, PR 체크를 통과시킨다.

참고: [PostgreSQL 17 MATERIALIZED CTE](https://www.postgresql.org/docs/17/queries-with.html), [Supabase Query Optimization](https://supabase.com/docs/guides/database/query-optimization).
