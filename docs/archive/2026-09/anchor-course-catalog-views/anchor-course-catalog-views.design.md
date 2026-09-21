# 16개 교육과정 안내 설계

2026-09-21 · anchor-course-catalog-views

## 데이터와 공개 범위
`public.life_course_guides`에 공개용 16개 안내 레코드를 저장한다. `id`(안정적 slug), `year`, `sort_order`, `name`, `academy`, `summary`, `curriculum text[]`, `mode`, `capacity`, `teaching_hours`, `period_label`, `schedule_history text[]`, `time_label`, `location`, `certificate`(nullable), `offering_id`(기존 운영 기수 FK nullable/unique), `published`를 둔다. 날짜 미정/수정/2차는 원문 문자열로 보존한다.

RLS는 published=true 행만 anon/authenticated SELECT 허용. 두 역할에 INSERT/UPDATE/DELETE를 허용하지 않는다. 서비스 역할 이외의 기본 테이블 권한도 회수한다. 공개용 자료에 내부 인력·예산·모집/수료 인원·개인정보는 넣지 않는다. 기존 life_offerings 등의 행은 수정하지 않는다.

첨부 순서대로 라이프케어 6개, 로컬창업 6개, 팝업 4개. 표의 아카데미 소계는 해당 그룹의 마지막 행이므로 스마트테크 제목 다음 6개가 라이프케어다. 이번 자료에 없는 재활운동지도사 제외. 자격증 12개, 미기재 4개. 세부 합계는 244명/541시간이며 표 하단 합계 232명/511시간과 차이가 있다. 목록은 16개 세부 행 값을 따른다. 소개·교육내용은 기존 16개 운영계획서 추출본을 사용하되 현재 현황표 명칭·일정·정원·시수를 우선한다.

## 조회
`src/lib/course-guide/data.ts`는 공개 안내 SELECT와 기존 공개 소개 조회를 병렬 실행한다. 16개 안내에 연결된 기존 3개 기수는 중복 제외하며, 향후 추가된 공개 기수는 유지한다. 조회 실패는 안내문을 표시해 일부 결과를 전체인 것처럼 표시하지 않는다. 홈의 기존 모집 추천은 변경하지 않는다.

`/courses/[id]`는 published 안내 한 건을 읽는 서버 페이지. 설명, 교육내용, 현재·이전 일정, 장소, 정원/시간, 자격증을 제공한다. 연결된 기수는 기존 공개 RPC로 확인한 경우에만 추가 링크를 제공한다. 안내 자체에서 신청 상태를 만들지 않는다.

## UI
`/courses`는 서버 컴포넌트. q/mode/view URL 파라미터를 정규화하고 카드/리스트 링크와 검색 폼에 보존한다. 자격증도 검색 대상. 기본 cards, list만 인정. 키보드 접근 가능한 링크에 aria-current 표시.

카드: xl 4열, sm 2열, 기본1열. 원문순 16개로 4×4 구성. 아카데미 색상, 순번, 제목, 2줄 설명, 기간·정원·시수, 자격증, 상세 링크. 3개 아카데미 공통 레이아웃.
리스트: 과정/기간/운영/정원·시수/관련자격증/상세의 비교 표. 모바일은 표 내부 스크롤만 허용. 빈 자격증은 ‘미기재’. 구형 공개 기수에는 기존 상세 링크 유지.

## 검증
DB: 16개, 그룹별6·6·4, 자격증12개, 합계244/541, 익명 공개읽기/비공개차단/쓰기거부, 기수3개 불변. 프론트: 필터·URL보존·중복제외·상세/404·DB실패. 실제브라우저 desktop4×4, list, 검색, 상세, 모바일390px, keyboard/콘솔. lint/typecheck/build 및 Preview/운영 익명 REST 확인 후 git push.
