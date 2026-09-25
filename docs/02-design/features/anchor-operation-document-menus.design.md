# 운영계획서·결과보고서 메뉴 분리 설계

> 2026-09-22 · [계획](../../01-plan/features/anchor-operation-document-menus.plan.md) · 기존 [운영 문서](anchor-operation-documents.design.md), [결과 보고](anchor-course-reports.design.md), [역할 메뉴](anchor-role-navigation.design.md) 설계 연계

## 경로·탐색

- `/operation-documents/plan`: 운영계획서 목록과 원본 양식. `/operation-documents/result`: 공식 운영결과보고서 목록·원본 양식. 같은 메뉴의 `?view=evidence` 탭은 ‘결과 보고(5종 증빙 포함)’로 표시하고 기존 검색·상태 필터·첨부 5종 목록을 둔다. 과정이 많아도 어느 목록이든 바로 열 수 있다.
- 기존 `/operation-documents`는 계획 목록으로, `/admin/reports`는 결과 메뉴의 기존 증빙 탭으로 리다이렉트한다. `/admin/offerings/[id]/reports`, 인쇄 및 `/operation-documents/[id]/[kind]`의 URL과 권한은 유지한다.
- `officeSections`에서 합쳐진 메뉴와 기존 ‘결과 보고’ 메뉴를 각각 ‘운영계획서’, ‘결과보고서’ 두 메뉴로 바꾼다. 문서 작성 화면과 기존 결과 보고 세부 화면도 각 메뉴를 활성화한다. 관리자 업무 홈의 아이콘·과정 운영 링크와 강사 진입 링크를 맞춘다.

## 화면·권한

- 공통 목록 컴포넌트는 `life_operation_list`를 호출한다. 계획 목록은 plan 상태와 링크만, 결과 목록은 result 상태와 링크만 표시한다. 책임강사는 자신의 지정 과정, COURSE_MANAGER/SYSTEM_ADMIN은 접근 가능한 기관 과정을 본다. RPC 실패와 빈 결과를 구분한다.
- 결과 메뉴의 별도 탭에 기존 `ReportList`를 그대로 재사용하여 관리자에게 과정별 보고서 작성·검토, 상태 검색, 결과보고서와 첨부 5종의 출력 미리보기를 제공한다. 이 탭은 COURSE_MANAGER에게만 보이고 기존 `getCourseWorkspaces` 데이터 경로를 유지한다. 선택하지 않은 탭의 데이터는 조회하지 않으며 두 자료의 오류 상태도 독립적이다.
- 결과 목록에서 공식 문서와 증빙의 차이를 제목·설명으로 드러낸다. 보관된 원본 PDF, 지급자료와 민감정보 접근은 기존 과정별 세부 권한으로 제한한다. 새 DB/RPC는 만들지 않는다.

## 검증

역할별 메뉴·중첩 활성 상태·리다이렉트·목록의 kind 분리·manager-only 증빙·오류 독립성을 역할 탐색 검사에 반영한다. lint/build와 브라우저 기본 렌더링을 검사한다.
