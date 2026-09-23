# DB 지연 후속 개선 설계

2026-09-23 · [계획](../../01-plan/features/anchor-db-latency-followup.plan.md)

## 공개 목록

CourseGuideSummary를 CourseGuide의 id/year/sort_order/name/academy/summary/mode/capacity/teaching_hours/period_label/certificate/offering_id로 정의한다. 목록 쿼리는 이 12개 필드만 선택하며 published=true와 year.desc/sort_order 정렬을 유지한다. 상세 getCourseGuide는 기존 전체 필드를 유지한다. mergeCatalog는 summary 타입을 받아 기존 병합·중복 제거·검색 결과를 유지한다.

## 운영문서 편집

기존 getOperationContext의 인증·UUID·오류 처리를 작은 내부 함수로 공유한다. getOperationEditorData(id)는 인증·UUID 검사 후 같은 세션 DB 클라이언트로 life_operation_context(f=id), life_operation_list()를 Promise.all로 실행한다. context의 FORBIDDEN은 notFound, 기타 오류·null은 기존 메시지로 throw한다. list 실패는 기존처럼 현재 과정만 선택할 수 있게 한다. 선택 옵션은 id/name/starts_on만 명시적으로 매핑한다. 병렬로 조회한 목록은 context 접근이 허용된 뒤에만 반환한다.

페이지는 kind를 먼저 검사하고 새 loader 결과를 DocumentEditor에 전달한다. getOperationContext를 사용하는 인쇄 화면은 기존 단일 RPC 경로를 유지한다. 캐시나 사용자 사이의 데이터 공유는 추가하지 않는다.

## 검증

- 실제 Supabase query builder 요청으로 목록 projection/published/order, 상세 데이터, 병합·검색, DB 오류를 검사한다.
- loader를 실행하여 두 RPC의 동시 시작 barrier, 인증 실패·잘못된 ID의 요청 0건, FORBIDDEN·DB 오류, 현재 과정 fallback, 선택 옵션 필드 제한을 검사한다.
- 운영 공개 REST를 이전/새 projection으로 번갈아 읽어 목록 내용 동일성과 bytes를 비교한다. 응답 본문과 인증 키는 출력하지 않는다.
- 관련 회귀·lint·빌드 및 설계 대비 gap 확인, main push와 Vercel READY/version/health 확인.

참고: [Next.js 병렬 조회](https://nextjs.org/docs/app/getting-started/fetching-data), [Supabase select](https://supabase.com/docs/reference/javascript/select).
