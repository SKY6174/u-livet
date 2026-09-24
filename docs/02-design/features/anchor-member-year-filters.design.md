# 구성원 연도별 명부 설계

2026-09-24 · anchor-member-year-filters

## 기준과 화면
- 연도는 `life_project_years.starts_on`의 연도(2025~2029)를 뜻한다. 강사와 수강생 탭에 전체/연도 선택을 노출하고 강사 탭에는 전체/교내/교외 선택을 더한다.
- 수강생의 해당 연도 소속은 `life_enrollments.status='ACTIVE'`와 연결된 기수의 `project_year_id`로 판단한다. 단순 신청·대기·철회는 제외한다.
- 강사의 해당 연도 소속은 `life_offering_instructors` 배정과 연결된 기수의 `project_year_id`로 판단한다. 등록만 된 강사 풀 또는 운영계획서 예정 명단은 제외하며, 종료된 배정은 실제 강의 이력으로 남긴다.
- 전체는 기존 가시 범위의 사람을 각각 1회 반환한다. 연도별 조건은 사람을 복제하지 않고 `exists`로 적용한다. 교내/교외는 기존 분류 또는 강사 풀의 구분을 사용한다.
- 명부의 정렬 선택은 사업단 직책순, 성명 가나다/역순, 이메일 오름/내림, 강사 교내/교외, 수강생 생년월일을 제공한다. 항상 ID를 마지막 기준으로 사용한다. URL query가 검색·페이지·내려받기와 일치한다.
- 연도 선택 시 수강과목 열은 선택한 사업연도의 수강 확정 과정을 표시한다. 선택이 없으면 기존 올해 수강과목 의미를 유지한다. 빈 명부 안내에는 현재 조건을 드러낸다.

## API·권한
- 기존 `life_member_directory`와 상세 조회는 그대로 둔다. 새 `life_member_directory_filtered`는 private definer 구현/public invoker 래퍼로 구성해 group/query/page/year/kind/sort/direction을 검증한다. 기존 member scope, 관리 가능 여부, 검색·총수·권한 조건을 유지한다.
- 엑셀도 같은 조건을 받는 별도 filtered RPC를 제공한다. 1,000명 한도와 권한은 기존과 같다. 서버 액션은 허용 목록으로 매개변수를 검증한다.
- 명부 조건은 개인정보 접근 범위를 넓히지 않는다. 민감한 명부 조회는 항상 기존 `member_scope_for(false)`를 통과한다.

## 검증
- SQL 합성 fixture에서 전체/연도/교내외/중복 배정/미배정/신청만/철회/정렬/페이지/검색/권한 거절 및 Excel 일치를 확인한다.
- TypeScript, lint, build와 사용자 화면에서 URL 조건 보존·접근성·빈 상태를 확인한다.
