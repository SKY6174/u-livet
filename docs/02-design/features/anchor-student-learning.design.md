# 수강생 학습 허브 상세설계

2026-09-21 · 계획: docs/01-plan/features/anchor-student-learning.plan.md

## 화면 구조
/mypage 수강생 분기만 StudentLearning으로 교체한다. 네이비/민트 브랜드의 인사·요약, 섹션 내비게이션, 내 강의실과 다음 수업/할 일 2열, 학습 기록·장학금, 추천 과정, 희망 과목 제안, 계정 설정 순서다. 모바일에서는 1열이며 모든 주요 버튼은 44px 이상이다. 제목은 `${name}님의 학습`이다.

## 데이터 계약
- `life_my_learning()` 인수 없는 RPC: 검증된 `life_private.person_id()` 기준의 신청과 기수·과정 정보, ACTIVE 등록 여부, 강사 이름, 승인 이수정책/규칙, 회차와 본인 출석, 공개 학습자료 제목, 본인 장학 지급 기록, 제안 이력 및 선택 가능한 소속기관.
- 신청이 있어도 ACTIVE 등록이 없는 경우 수업 자료·출석은 반환하지 않는다. 강사 이름은 ACTIVE 등록자에게 담당자 이름만 제공한다. 기타 개인정보 제외.
- 장학금은 보고서 scholarships에서 personId가 본인과 일치하는 행의 category/amount/paidOn만 반환한다. 보고서 원문/계좌/타인 정보 반환 금지. `지급 기록`이며 수급 자격·송금을 보장하지 않는다.
- 기존 `life_completion_history`, `life_my_surveys`, `getCourseCatalog` 병렬 조회. 실패 상태별 안내. 학습 허브 RPC 실패 시 오류/재시도 링크를 표시하며 0으로 오인시키지 않는다.
- 출석률은 기존 attendanceSummary 재사용: 종료된 유효 회차의 인정분 비율, 미입력이 있으면 확인 중, 미래/휴강 제외. 수료 확정과 구분.
- 다음 수업은 ACTIVE 등록 과정의 취소되지 않은 미래/진행 중 회차 중 시작시각이 가장 빠른 수업. 회차별 제목과 공개 학습자료 목록을 별도 표시해 둘의 순번을 잘못 연결하지 않는다.
- 추천은 본인이 신청/수강한 과정을 제외하고 동일 academy를 우선한다. 동일 분야 추천임을 표시하고 해당 분야가 없으면 과정 탐색으로 제시한다. 공식 선수과정 연결이라고 주장하지 않는다.

## 과목 제안
`life_learning_requests`: id, person_id, org_id, title(2–100), goal(10–2000), preferred_schedule(<=200), status(SUBMITTED/REVIEWING/PLANNED/NOT_PLANNED), response(<=2000), created_at, updated_at. 인증된 본인 조회 및 기관 COURSE_MANAGER 조회 RLS. 직접 쓰기 권한 없음.
`life_submit_learning_request(o,title,goal,schedule)`는 유효 세션, 본인 소속기관, 길이, 하루 최대 5건을 검증하고 잠금 내 삽입한다. 같은 내용 재전송은 기존 ID를 반환한다. `life_review_learning_request(r,status,response)`는 기관 관리자만 상태/답변 변경 가능. 공개 함수는 invoker, private 함수는 제한된 definer와 빈 search_path, PUBLIC/anon 권한 제거.
/mypage 내부 제안 폼과 제출 이력. /admin/course-requests에 담당자 검토 화면 및 admin 진입 링크. 성공 시 관련 경로 revalidate.

## 파일과 검증
src/lib/student-learning/{types,model,data}.ts, src/components/student-learning/dashboard.tsx, src/app/learning-request-actions.ts, 관리자 페이지, SQL migration. RLS/교차 사용자/기관/익명/잘못된 입력/중복 제출/장학정보 최소화 로컬 통합 테스트. 출석과 추천 순위 단위 테스트, 실제 서버에서 빈/수강 상태 데스크톱·모바일 확인, lint와 production build. 신규 스키마는 로컬 적용 후 생성하고 Git에 포함한다.

## 참고
기존 anchor-learning-evaluation, anchor-finance 설계 및 [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Next.js Server Components](https://nextjs.org/docs/app/getting-started/server-and-client-components).
