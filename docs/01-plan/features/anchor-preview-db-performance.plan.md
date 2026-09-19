# Preview DB 연결 및 성능 점검 계획

2026-09-19 · anchor-preview-db-performance

Preview DB bfqwntulxabfrimcypvx와 staging.uc-life.org의 연결, 환경 분리, 응답시간을 재확인하고 확인된 불필요한 조회를 최적화한다. 현재 preview 브랜치의 최신 코드를 기준으로 검증 후 push한다.

## 범위

- DB 상태·migration·업무 데이터 건수·쿼리 통계·실행계획을 확인한다.
- 보호된 Preview 앱은 권한 있는 접근 경로로 GET 측정한다. 키와 보호 쿠키는 출력하거나 커밋하지 않는다.
- Preview DB는 현재 과정·신청·수강 0건이므로 빈 DB 결과와 데이터가 있는 로컬 검증을 구분한다.
- 수료·강의실적·증명 화면에 남은 전체 과정 조회를 점검한다. 현재 권한, 표시 항목, 오류 처리를 보존하면서 필요한 범위만 읽는다.
- 기능 회귀와 실제 DB 비교, Preview 배포 및 health/version 확인을 수행한다.

## 완료 기준

Preview 앱/DB 연결 및 revision을 확인하고 반복 요청 중앙값·p95를 기록한다. 최적화 전후 결과를 같은 데이터·권한으로 비교하고 과장 없이 보고한다. 오류와 접근 거부를 성공으로 집계하지 않는다. Production 설정이나 실제 계정을 변경하지 않고 preview에 일반 push한다.

대량 인덱스 생성이나 RLS 정책 통합은 경고 수만으로 실행하지 않는다. 계획상 병목과 실제 측정에서 필요성이 확인된 변경만 진행한다.
