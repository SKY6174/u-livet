# 페이지 안내 말풍선 오른쪽 정렬 설계

2026-10-10 · 계획: `page-help-right-center.plan.md`

기존 `transient-page-help-compact-tables.design.md`의 자동 노출·타이머·경로 전환·닫기와 접근성 규칙을 유지하면서 위치 규칙을 아래처럼 변경한다.

## 구현

- PageDescriptionHint의 버튼과 말풍선을 버튼 크기의 relative inline-flex 요소로 묶는다.
- 말풍선은 `left-full`, 12px 간격, `top-1/2`, `-translate-y-1/2`로 배치한다. 말풍선의 왼쪽 화살표는 수직 중앙에서 버튼을 가리킨다.
- 버튼의 실제 right와 뷰포트 폭으로 말풍선 너비를 계산한다. 최대 576px, 화면 오른쪽 여백 20px를 보장한다. resize 및 제목 행 ResizeObserver로 갱신하며 unmount 때 정리한다.
- 화살표가 잘리지 않도록 말풍선 외곽과 스크롤되는 내용 요소를 분리한다.
- PageIntro의 제목 행은 flex-wrap을 허용한다. 640px 미만에서 안내 그룹에 basis-full을 적용해 버튼이 제목 다음 줄 왼쪽에 오도록 한다. 말풍선은 계속 해당 버튼 오른쪽·수직 중앙에 표시한다.
- 자동 표시 7초, 포커스/호버 타이머 정지, 다시 열기, Escape 및 닫기 버튼을 유지한다. 권한·DB·API 변경은 없다.

## 추가 요청: 과정 카드 표시 삭제

OperationsDashboard 카드에서 “우선 승인 교내 강사”의 dt/dd 표시를 제거한다. 화면에서만 쓰이던 initialInstructorLabel 보조 함수가 남으면 제거한다. 운영계획 강사·지정 책임강사·보조강사/보조인력은 유지하며 원래 배정·승인·회원 데이터는 수정하지 않는다.

## 추가 요청: 문서 카드 식별 정보

DocumentListView에서 앵커 기관의 표시명을 “앵커사업단”으로 줄이고 year_label의 차년도만 추출해 “앵커사업단∙2차년도”로 표시한다. 다른 기관과 차년도 없는 연도 표기는 원래 값을 유지한다. 프로그램 ID와 같은 flex 행에 배치하고 기관·차년도에 ml-auto 및 text-right를 적용한다. 로컬창업 아카데미의 표시 배지만 “C1-LOCAL-BUSINESS-00”으로 바꾸며 카드·리스트에서 동일하게 표시한다. 실제 아카데미 값·필터·프로그램 ID·DB는 유지하고 새 배지 코드로도 검색할 수 있게 한다.

## 검증

공통 컴포넌트를 사용하는 공개 페이지를 로컬 브라우저에서 확인한다. 360/720/1440px에서 말풍선의 left가 버튼 right보다 크고 두 요소 중심 y 차이가 1px 이내이며 본문 가로 넘침이 없는지 측정한다. 재열기·Escape·닫기 버튼과 브라우저 오류도 확인한다. lint·TypeScript·production build를 통과한 커밋으로 PR과 운영 배포를 진행한다.
