# 과정 모니터링 설계

> Version: 1.0.0 | Date: 2026-09-24 | Status: Approved by user request
> Plan: `docs/01-plan/features/anchor-course-monitoring.plan.md`

## 경로와 권한

- `officeSections()`의 `접수·운영` 첫 항목에 `/admin/monitoring`을 `COURSE_MANAGER`에게 노출한다. 다른 항목의 순서와 권한은 유지한다.
- `officeActiveHref()`가 해당 경로를 정확히 선택하게 한다.
- 새 서버 페이지는 `requireIdentity('/admin/monitoring')` 후 `COURSE_MANAGER` 역할을 확인한다.
- 기존 `life_course_workspace()`는 로그인·최근 MFA·담당 조직을 검사해 과정별 집계를 반환한다. 페이지는 이 RPC를 재사용하며 조직 범위를 클라이언트 입력으로 넓히지 않는다.
- 클라이언트에는 화면에 필요한 집계 필드만 전달하고 개인별 명단·증빙·결제 세부 정보는 전달하지 않는다.

## 데이터 흐름

1. 서버에서 `getCourseWorkspaces()`를 한 번 호출한다. 조회 실패는 빈 수치로 대체하지 않고 오류 안내를 표시한다.
2. 사용자에게 허용된 조직 ID만 사용해 `life_organizations`의 표시 이름을 조회한다. 실패하면 조직 ID 대신 `담당 기관`이라고 표시한다.
3. 서버가 과정별 상태·정원·신청 대기·전산 수강 확정·수업 회차·출결·수료 집계 필드만 선택한다.
4. 클라이언트는 조직·사업연도·상태·검색어로 목록을 필터링하고, 화면에 보이는 과정만 합산한다. 기본은 전체 과정이다.
5. 기존 `AdminLiveRefresh`의 수동/30초 새로고침으로 서버 집계를 다시 읽는다.

## 화면

- 상단 요약: 표시 과정, 신청 대기·대기자, 수강 확정, 출결 미입력, 수료 검토.
- 과정별 목록: 과정 상태·교육 기간·정원, 신청 대기·대기자, 확정 인원/정원, 예정/종료 수업, 종료 수업 출결 입력/대상 및 미입력, 수료 승인/검토.
- `출결 입력률`은 입력 건수/기대 건수이며 실제 출석률이 아니다. 종료 수업과 확정 수강생이 없으면 `집계 대상 없음`을 표시한다.
- `미입력`은 결석이 아니다. 휴강·예정 수업은 기존 RPC에서 제외된다.
- `ARCHIVED`의 원본 보고서 인원은 `원본 기록`으로 따로 표기한다. 전산 확정 인원과 합산하지 않는다.
- 과정 개요, 신청 처리, 출결 현황, 수료 검토, 보고서로 이동하는 링크를 제공한다. 신청 처리는 운영 완료 과정에서 숨긴다.
- 좁은 화면은 가로 스크롤 표로 제공하되 표 머리글과 접근 가능한 필터 이름을 유지한다.

## 구현 파일

- `src/lib/auth/workspace-navigation.ts`: 첫 메뉴·현재 메뉴 판별.
- `src/app/admin/page.tsx`: 업무 홈의 새 메뉴 아이콘.
- `src/app/admin/monitoring/page.tsx`: 권한 검사·데이터 취득·실패 상태.
- `src/app/admin/monitoring/layout.tsx`: 기존 관리자 역할 게이트 재사용.
- `src/components/admin/course-monitoring-dashboard.tsx`: 필터·요약·과정별 현황.
- `scripts/verify-role-navigation.mjs`: 역할별 메뉴·경로 회귀.
- `scripts/verify-course-monitoring.mjs`: 실제 화면 집계/권한·원본 구분 검사.

## 검증

- 역할별 메뉴와 직접 URL 접근 차단.
- 신청 대기와 수강 확정, 출결 입력과 실제 출석을 혼동하지 않는지 검사.
- 필터별 합계, 빈 목록, RPC 실패, 원본 이관 표시 확인.
- 린트와 프로덕션 빌드, Supabase 읽기 쿼리 확인.
