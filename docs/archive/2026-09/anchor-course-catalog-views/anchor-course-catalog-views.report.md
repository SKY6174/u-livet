# 16개 교육과정 안내 완료

2026-09-21 · anchor-course-catalog-views

교육과정 찾기에 첨부 현황표의16개 과정을 반영했다. 데스크톱4×4 카드와 리스트를 전환할 수 있으며, 검색어·운영방식은 전환 후에도 유지된다. 관련 자격증을 카드·리스트·상세에 표시하고 검색에 포함했다. 모바일은 카드1열, 리스트는 표 내부 스크롤로 제공한다.

공개 안내 데이터를 Preview/Production DB에 저장하고 기존3개 기수와 연결하여 중복을 제거했다. 모든 과정에서 교육내용·일정·장소·정원·시수·자격증 상세를 볼 수 있다. 변경 일정/2차 일정/12월 예정은 원문대로 보존했다. 기존 운영 기록은 변경하지 않았다.

신규 회귀14개, DB assertion20개, 기존 공개 소개 권한 회귀, 실제16개 상세/404, 브라우저, lint/typecheck/build 통과. 양쪽 DB의16개 레코드 및 쓰기차단을 익명 REST로 검증했고 보안 advisor 경고가 없다.

원문 하단합계와 세부행 합계의 차이는 [검증 기록](anchor-course-catalog-views.analysis.md)에 기록했다. 화면은 개별 과정 값을 사용한다.

[설계](anchor-course-catalog-views.design.md) · [공개 데이터](../../../operations/2026-public-course-guides.json)
