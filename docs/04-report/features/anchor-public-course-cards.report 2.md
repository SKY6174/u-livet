# 기존 3개 과정 소개 카드 복구

2026-09-21 · anchor-public-course-cards

교육과정 찾기는 보관된 업무 과정을 직접 조회하여 비로그인 방문자에게 0개로 표시했다. 사용자가 선택한 공개 범위에 따라 별도 소개 조회를 추가하고 기존 3개 과정만 공개로 지정했다.

- 로컬 쿠키 창업 마스터클래스
- 파크골프지도사 양성(자격증)과정
- 반려동물수제간식 만들기

누구나 카드와 교육내용·일정·장소·정원 상세를 볼 수 있다. ‘운영 완료’를 표시하며 접수는 열지 않는다. 보고서·원본 PDF·학습자 자료의 관리자 권한은 유지한다. 추가 보관 과정은 자동 공개되지 않는다.

Preview·Production DB 적용과 실제 익명 조회 검증을 완료했다. 목록·검색·상세·모바일, 회귀 28개, PostgreSQL 접근 경계, lint/build를 확인했다. 기존 과정과 보고서·첨부 내용은 유지했다.

[설계](../../02-design/features/anchor-public-course-cards.design.md) · [검증](../../03-analysis/anchor-public-course-cards.analysis.md)
