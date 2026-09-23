# DB 지연 후속 개선 설계 비교

2026-09-23 · anchor-db-latency-followup

## 구현 일치: 8/8 (100%)

| 설계 항목 | 결과 |
| --- | --- |
| 공개 목록 12개 필드·published·정렬 유지 | 실제 Supabase builder 요청 검사 통과 |
| 목록 표시·검색·연결 중복 제거 유지 | 새 회귀 및 기존 catalog 회귀 통과 |
| 상세 교육내용·일정 이력 유지 | 상세 조회·화면 회귀 통과 |
| 인증·UUID 검사 이후 DB 조회 | 실패 경로 요청 0건 확인 |
| 편집 context/list 동시 조회 | 양쪽이 시작되어야 풀리는 barrier 통과 |
| FORBIDDEN·DB 오류 처리 유지 | 404/명시적 오류 검사 통과 |
| 선택 옵션 최소 필드·현재 과정 fallback | id/name/starts_on만 반환 확인 |
| 인쇄 loader 단일 context RPC 유지 | 요청 1건 확인 |

새 회귀 11개, catalog 14개, 이전 DB 응답 10개, DB 성능 16개: 합계 51개 통과. `npm run build`의 설명서 확인·컴파일·lint·TypeScript·정적 생성 통과. `git diff --check` 통과. 요청마다 기존 세션 클라이언트를 사용하며 사용자 간 캐시를 도입하지 않았다. migration·RLS·권한·운영 자료 수정은 없다.

## 실제 운영 DB와 응답 측정

운영 프로젝트 `uoebygejgglgiivzgyks`: ACTIVE_HEALTHY, 도쿄, Postgres 17.6.1.166. 공개 course_guides를 이전/새 projection으로 7쌍 번갈아 조회했다. 14회 모두 200이며 동일한 16개 과정의 목록 필드가 일치했다. 첫 쌍을 제외한 각 6회의 중앙값:

| 항목 | 이전 | 개선 |
| --- | ---: | ---: |
| 선택 필드 | 16 | 12 |
| JSON 응답 본문 UTF-8 크기 | 13,070B | 7,318B |
| 응답시간 | 160ms | 173ms |

본문 크기 44.0% 감소. 압축 후 네트워크 전송량은 측정하지 않았다. 이 소표본에서 HTTP 응답시간 단축은 확인되지 않았다. 인증된 편집 화면의 전체 응답시간·동시 부하는 측정하지 않았으며 병렬화의 효과는 직렬 대기 단계 2개를 동시 단계 1개로 줄인 실행 검증으로 한정한다.

`life_operation_context`, `life_operation_list`의 비로그인 호출은 모두 401. 보안 advisor는 ERROR/WARN 없이 기존 INFO `rls_enabled_no_policy` 분류만 반환했다. [해당 진단 설명](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

변경 전 공개 사이트 5회/경로, 첫 회 제외 중앙값/p95: health 198.5/435ms(200 healthy), courses 265.5/287ms(200), login 148/165ms(200), 홈 198/245ms(307 로그인 이동). 로그인 이동은 인증된 홈 화면 응답시간이 아니다.

누적 pg_stat_statements에서 identity 평균 72.71ms(465회), operation_list 평균 160.62ms(32회), operation_context 평균 80.68ms(31회)를 확인했다. 서로 다른 입력·실행 시점의 누적 통계이므로 이를 합산해 실제 페이지 개선율로 환산하지 않았다.

실행: `npm run test:db-latency`, `node scripts/verify-course-catalog.mjs`, `npm run test:db-response`, `npm run test:db-performance`, `npm run build`.
