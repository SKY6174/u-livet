# DB 연결·응답 최적화 설계

2026-10-08 · db-connectivity-performance

계획: [db-connectivity-performance.plan.md](../../01-plan/features/db-connectivity-performance.plan.md)

## 데이터 흐름

`/admin/courses`는 인증·기관 권한 확인 뒤 `life_course_budget_overview(o,y)`와 과정 workspace, 기관·연도를 병렬 조회한다. 기존 `life_operation_list()` 병렬 조회를 없앤다. 예산 RPC의 각 `life_course_guides` 행에 `current_responsible_name`을 추가한다. `g.offering_id`로 `life_operation_responsibilities`(offering_id 고유 인덱스)와 `life_people`을 LEFT JOIN한다. 해당 이름은 이미 반환하는 승인 전 초기 책임강사 이름과 구분한다.

## 권한·계약

- 기존 `life_private.course_budget_allowed(o)`를 함수 시작에서 그대로 검사한다. `WHERE g.year=y AND g.org_id=o`도 유지한다.
- 새 JSON 키만 추가한다. 이전 소비자는 영향받지 않는다.
- 이름을 얻지 못할 때는 기존 화면의 초기 지정 또는 미지정 안내를 유지한다.
- 프런트엔드는 예산 결과에 `current_responsible_name`이 전혀 없는 구 DB와는 배포 순서로 호환한다. DB 마이그레이션을 먼저 적용한다.

## 파일과 검증

1. 새 SQL 마이그레이션: budget RPC 정의 갱신. 기존 역할·검색경로·권한 유지.
2. `src/lib/course-budget/model.ts`: `OperationCourse`에 nullable 이름 추가.
3. `src/app/admin/courses/page.tsx`: 운영문서 RPC 제거.
4. `src/components/course-workspace/operations-dashboard.tsx`: 행 자체의 현재 이름을 표시.
5. `scripts/verify-db-response-optimization.mjs`: 읽기 수와 병렬 시작 보장. SQL/화면 회귀는 별도 점검.

검증은 로컬 DB 마이그레이션·권한 테스트, 앱 테스트·lint·빌드, 운영 DB 연결·마이그레이션 상태와 운영 배포 상태 확인으로 한다. 실제 로그인 사용자 페이지 지연 개선은 인증된 계정으로 별도 측정하지 않는 한 추정하지 않는다.
