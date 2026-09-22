# DB 응답 최적화 설계

2026-09-22 · [계획](../../01-plan/features/anchor-db-response-optimization.plan.md)

## 과정별 조회

강사와 학습자 강의실은 기존 로그인·배정·수강 검사를 통과한 다음에만 학습 자료를 읽는다. PostgREST FK inner join 필터로 부모 행까지 현재 과정에 한정한다. 단순 embedded 필터만 사용해 다른 과정의 부모 행을 남기지 않는다.

- 학습자 읽음: `lesson_id,life_lessons!inner(offering_id)`, `life_lessons.offering_id=현재 과정`, `person_id=본인`.
- 제출: `*,life_assignments!inner(offering_id)`, `life_assignments.offering_id=현재 과정`. 학습자는 기존 본인 person_id 조건도 유지한다.
- 성적: `*,life_submissions!inner(life_assignments!inner(offering_id))`, `life_submissions.life_assignments.offering_id=현재 과정`. 학습자는 submission의 person_id도 본인으로 제한한다.
- 기존 5개 쿼리의 Promise.all과 오류 표시를 유지한다. 화면이 쓰는 필드는 삭제하지 않는다.
- 강사 배정 확인은 사용하지 않는 전체 속성 대신 valid_until만 선택한다.

각 페이지에 위 요청을 직접 적용하여 실행 경로를 분명하게 유지한다. 권한은 기존 Supabase RLS에서도 계속 검사된다. migration과 DB 권한 변경은 없다.

## 과정 관리 화면

권한과 선택 조직 확인 후 workspace, project years, 임시저장본, 예산, 책임강사 목록을 한 Promise.all에서 시작한다. 예산은 빈 workspace 인자로 먼저 읽고, 두 결과가 도착하면 기존 mergeOperationCourses로 합친다. 기존 getCourseBudgets API와 다른 호출자는 변경하지 않는다. 조직 필터와 SYSTEM_ADMIN의 예산 전용 동작, DB 오류 표시는 유지한다. 연도 목록은 실제 필요한 id/org_id/label만 선택한다.

## 검증

1. 페이지를 실행하고 설치된 Supabase query builder가 생성한 요청을 수집한다. 강사·학습자 과정/사용자 범위, inner join, 권한 거부 시 후속 조회 없음, 오류 화면을 검증한다.
2. 과정 관리의 지연된 mock 조회를 모두 시작해야 풀리는 barrier로 순차 회귀를 탐지하고 조직별 workspace 결합을 확인한다. 기존 개설·임시저장·역할 회귀도 수행한다.
3. 로컬 PostgREST에서 실제 FK join 문법과 결과 집합 일치를 검증한다. 기존 MFA fixture secret이 없으면 계정 설정을 바꾸지 않고 로컬 시험을 별도 계정 또는 공개/관리자 읽기 범위로 제한하고 결과에 명시한다.
4. 운영 자료는 읽기 전용으로 확인한다. 공개 health·과정 목록·로그인과 비로그인 redirect를 각각 측정하고 구분한다.
5. lint/프로덕션 빌드, 설계 비교를 완료한 후 main에 fast-forward하고 push한다. 운영 revision/health 및 배포 READY를 확인한다.

참고: [Supabase select](https://supabase.com/docs/reference/javascript/select), Next.js data-patterns skill의 독립 조회 병렬화 원칙.
