# 운영 DB 목록 조회 성능 개선

2026-09-25 · anchor-operation-list-performance

운영 DB 연결 상태는 정상이다. 운영 문서 목록 RPC의 반복된 MFA·사용자·역할 조회를 요청당 한 번으로 줄였다. public RPC의 입력·응답·접근 범위는 유지했다.

로컬 DB에서 기존과 변경 함수를 같은 세션의 관리자·책임강사·권한 없는 사용자로 비교해 결과가 각각 **129개·1개·0개**로 일치했다. 관리자 조회의 로컬 SQL 중앙값은 **1,749.68 → 4.41ms**였다(6쌍 교차 실행, 첫 쌍 제외). 운영 화면 전체 응답시간의 개선율은 별도 계측이 필요하다.

설명서·lint·TypeScript·Next 프로덕션 빌드와 이 기능의 실제 DB 동등성 검사는 통과했다. 기존 전체 운영문서 검사는 오래된 출석률 시험 입력값 때문에 중간에 멈췄다. [검증 조건과 제한](../../03-analysis/anchor-operation-list-performance.analysis.md)을 기록했다.

재현: `npm run test:operation-list:local`. 시험은 전용 로컬 컨테이너만 사용하고 함수 변경을 롤백한다. migration: `20260925134328_optimize_operation_list_access.sql`.
