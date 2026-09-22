# DB 연동 점검 및 최적화 결과

2026-09-22 · anchor-db-integration-review

운영·스테이징 DB 연결, 마이그레이션 47개와 공개 업무 함수 169개의 일치, 외래키 257개의 검증 상태, 주요 공개 읽기와 비인증 업무 접근 차단을 확인했다.

강사 관리 및 서류 목록은 서버에서 확인한 관리 기관의 ID·이름만 조회한다. 기존 전체 옵션 RPC와 비교한 스테이징 DB 측정에서 기관 선택용 전송량이 13,928 → 194B(98.6% 감소), 반복 조회 중앙값이 42.311 → 0.103ms였다. 작은 DB의 해당 쿼리 결과이며 페이지 전체 속도나 동시 부하 성능을 의미하지 않는다.

심사 상세는 필요한 정책을 계속 제공하고 대장 읽기와 병렬 실행한다. 기관별 권한 검사와 저장 규칙을 유지했다. 성능 점검 도구는 동일 사이트의 정상 홈페이지→로그인 이동을 성공으로 처리하며 외부 이동·보호 화면·health 오류는 실패로 구분한다.

조회·권한·저장·점검 도구 회귀 64개, lint, 격리 프로덕션 빌드 및 설계 대조 8항목을 통과했다. 스키마·RLS·실사용자 업무 데이터는 변경하지 않았다. 소스 반영 대상은 main/preview이며, 배포 후 버전과 health를 확인한다.

상세 측정과 범위: [검증 기록](../../03-analysis/anchor-db-integration-review.analysis.md)

재검증: `npm run test:db-performance`, `npm run test:workspace-queries`, `node scripts/verify-instructor-queries.mjs`, `node scripts/verify-db-performance-probe.mjs`. 실제 로컬 DB는 `node scripts/verify-instructor-pool.mjs`로 검사한다.

PDCA 구현·검증·보고 완료. 다음 성능 점검은 실제 이용량이 증가했을 때 로그인 업무의 동시 요청과 느린 쿼리를 대상으로 한다.
