# 운영 계정 명부 분류 검증

설계: `docs/02-design/features/operational-account-directory.design.md`

2026-10-17 · 설계 항목 6/6 구현, 로컬 검증 통과.

- 운영 DB 사람 83명/Auth 29개 조사. 명시적인 검증/테스트/dummy 인물 25개 ID를 분류한다. 운영 화면의 dummy 수강생 10명 표시를 실제 확인했다. 정상 사업단 11명·강사 41명·수강생 5명 유지가 운영 검증 기준이다.
- 새 비공개 분류표는 RLS/권한 회수, 읽기 전용 운영 scope helper는 일반 역할 execute 회수. 기존 member_scope_for/인증/쓰기/자기 프로필은 수정하지 않았다.
- 기존 조회 함수 5개를 실제 운영 pg_get_functiondef와 비교했다. member 읽기 scope와 과정 읽기 view 치환 외 본문 차이 없음. 기존 auth/기관 범위/입력 검증/반환형/정렬/페이지/엑셀 제한을 보존한다. 원본 행 UPDATE/DELETE/TRUNCATE 없음.
- 로컬 SQL transaction에서 45 정상+7 숨김 수강생, 사업단/강사 정상·숨김 쌍, 정상·숨김 혼합 과정 이력, 타 기관 인물, 숨김 처리한 관리자 fixture를 확인했다. 20/20/5 페이지·중복 없음·총인원·정렬·검색·연도/강사 구분·구/신 엑셀 조회·직접 상세/이력 차단·정상 강의/수강 이력 유지 통과. 이름 변경 후에도 숨김 유지.
- private 분류표와 helper 접근 거부, 비로그인/비관리자/타 기관 조회 거부, 숨긴 관리자의 기존 인증/조회 권한 유지 통과. 로컬 테스트의 임시 권한·계정·신청 자료 전체 ROLLBACK.
- 로컬 사람/Auth/역할/수동등록/신청/수강 원본 hash 보존 통과. 운영 계정 관련 원본을 포함한 31개 aggregate count/hash와 보안 advisor 기준값을 저장했다. 원본 연락처/암호는 출력하지 않는다.

출시 확인은 PR 설명에 기록한다: Preview migration/배포 및 운영 migration ledger, 기존 31개 원본 count/hash, 보안 advisor, 운영 브라우저의 정상 명단과 dummy/검증 검색/기존 상세 주소, READY/health/version.
