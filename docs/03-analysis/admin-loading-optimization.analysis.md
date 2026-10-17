# 관리자 로딩 최적화 검증

2026-10-17 · admin-loading-optimization

## 변경 전 실화면 측정

기존 운영 로그인 세션, 같은 앱 브라우저의 background 탭에서 10화면을 각각 4회 읽었다. 첫 표본을 제외한 3회 중앙값이다. 측정 시작은 이동/새로고침 직전, 끝은 데이터 조회 뒤 실제 제목의 visible 확인 직후다. 실제 탐색·서버 렌더링·브라우저 통신을 포함하며 브라우저의 Navigation Timing/TTFB/LCP 지표로 해석하지 않는다.

| 화면 | 경로 | 본문 표시 중앙값(ms) |
| --- | --- | ---: |
| 사업단 관리 | /admin | 766 |
| 과정 모니터링 | /admin/monitoring | 706 |
| 과정 운영 관리 | /admin/courses | 805 |
| 구성원 관리 | /admin/accounts | 728 |
| 평생직업교육 강사 관리 | /admin/instructors | 666 |
| 무료 주차권 관리 | /admin/parking | 844 |
| 수강생 서류 접수·처리 | /admin/learner-documents | 811 |
| 강의실적·증명 관리 | /credentials | 869 |
| 연차 평가·성과 관리 | /performance | 465 |
| 수료 검토·승인 | /completion | 1372 |

## 설계 대조

- 주차권 입력 검사 순서를 유지하고, 활성 COURSE_MANAGER/SYSTEM_ADMIN 기관과 센터 심사자 이메일 확인을 조회당 한 번 계산한다. 공개 RPC/권한 helper·쓰기/재고/발급 함수는 유지한다.
- metadata view는 security_invoker이며 기존 offering/year RLS를 재사용한다. 과정·버전 상세 조인을 생략하고 원래 노출 가능한 과정 필드와 공개 연도명만 반환한다. SELECT 이외의 일반 권한은 없다.
- 프런트엔드는 getWorkspaceOfferings의 테이블 이름 1곳만 교체한다. scope, 입력 검증, 반환 8필드, 정렬·오류 처리는 유지한다. 공개·상세 카탈로그 조회 경로는 그대로다.
- 실제 Supabase query builder가 새 view와 정확한 8열을 요청하는지 검증했다. DB performance 16개 + workspace 8개 + DB response 10개, lint·설명서·전체 Next 빌드 통과.

## DB 및 배포 검증

로컬 교차 측정·RLS 동등성, Preview 및 최종 배포 검증 결과를 이어서 기록한다. 운영 기준선은 데이터 91종(기존 86+주차권 5원장), 기타 함수 628개, 함수 ACL 629개, 기존 관계 권한/RLS 184개, 정책 88개다.


로컬/운영 검증 근거:

- 로컬 실제 RLS: 관리자·INSTRUCTOR·CERTIFIER·PERFORMANCE·SYSTEM_ADMIN, 복수/중복/만료/미래 역할, 타 기관, MFA 부족·잘못된 세션, 미확인 이메일·삭제 사용자, 익명에서 이전/새 메타 목록 및 주차권 JSON/오류 동등성을 확인했다. 상태·연도·센터 등 9입력, 전체/id/org scope, 센터 심사 가능 여부, 정상 미공개·보관 과정과 숨김 제외, SELECT-only를 확인했다. 15항목 통과, 원본 9종 해시 보존 및 전체 ROLLBACK.
- 8쌍 교차 실행의 첫 쌍 제외 7쌍 중앙값: 주차권 1310.85→4.57ms, 메타 목록 3856.24→248.42ms. 로컬 조건의 DB 시간으로 운영 전체 화면 개선율과 구분한다. EXPLAIN ANALYZE는 동일 41행, shared hit blocks 153996→15360, 실행시간 4599.268→366.485ms였다.
- 로컬 기존 주차권 정의 해시가 운영 기준선과 같다. 본문 표시 이전 운영 DB 실행 평균은 주차권 474.63ms(4회), 증명·수료용 메타 목록 512.01ms(8회)다.
- 독립 Preview DB의 136개 전체 migration과 FUNCTIONS_DEPLOYED, 최종 주차권 정의·9열 view·security_invoker·일반 SELECT-only 권한을 확인했다. 최종 head 검사와 운영 적용 후 결과는 PR 본문에 기록한다.

재현: `node scripts/verify-admin-loading.mjs` (전용 supabase_db_uc-life-issues, 전부 ROLLBACK).

설계 대조 8/8: 기존 입력 순서, 활성 기관/MFA, 센터 심사자 조건, 전체 연도 이력, 원본·권한 보존, invoker metadata, 동일 query-builder 계약, 실제 DB/화면 측정 및 배포 순서를 확인했다.
