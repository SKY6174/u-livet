# 운영 증명·배지 조회 검증

설계: `docs/02-design/features/operational-credential-records.design.md`

2026-10-17 · 설계 구현 6/6, 로컬 SQL 검증 통과. 운영 신규/구형 발급 원장·신청·배지 정의는 현재 모두 0건이므로 삭제·취소할 발급 데이터는 없다.

공통 문맥 함수와 권한이 회수된 security_invoker view 6개를 추가하고 기존 읽기 함수 7개에 적용했다. 과정·인물 분류와 현재 발급권 test_only, 발급 당시 snapshot/artifact test_only를 함께 확인한다. 일반 역할의 helper/view 직접 접근은 허용하지 않는다. 기존 원장 UPDATE/DELETE/TRUNCATE 없음. QR 진위확인·다운로드·상태·발급/승인/worker는 변경하지 않는다.

로컬 8개 사례: 정상 발급, 숨김 과정, 숨김 인물, test_only 발급권, 정상 발급권+test snapshot, 정상 취소, 정상 대체, 정상 발급 대기. 증명·배지 각각 신청 8건/발급 원본 7건을 혼합해 운영 신청 4건/발급 원본 3건과 상태별/그룹별 count 집계를 확인했다. 정상 취소·대체 상태도 유지한다. 이름을 바꾼 검증 과정·인물도 계속 제외된다.

목록/발급권 선택/배지 board·본인 wallet/정상 상세/검증 상세 FORBIDDEN, 비로그인·다른 기관 사용자·private view/helper 접근 차단이 통과했다. 로컬 테스트의 발급 위임과 모든 fixture는 한 transaction에서 ROLLBACK한다. 요청·발급·정의·파일 바이트·artifact 원문 6개 aggregate hash가 조회 전후 동일했다. 원본 바이트 보존용 로컬 fixture이며 PDF 생성 엔진을 재검증하거나 실제 증명으로 사용하지 않는다.

로컬 실행: `20261008131827_course_catalog_organization.sql`, `20261017062713_admin_operational_records.sql`, `20261017065240_operational_account_directory.sql`, 현재 migration, `scripts/verify-operational-credentials.sql`을 결합한다. migration 외곽 BEGIN/COMMIT 및 검증 파일의 BEGIN을 제거하고 단일 BEGIN과 마지막 ROLLBACK으로 `docker exec -i supabase_db_uc-life-issues psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q`를 실행했다.

운영 기존 34개 원본에 발급/원문/토큰/카운터/공유/발급권/위임/서식/구형 원장을 더해 총 50개 aggregate count/hash와 보안 advisor 기준값을 확보했다. 운영·Preview 체크와 실제 화면 결과는 PR 설명에 이어 기록한다. 원본 연락처·암호·공유 토큰·PDF/JSON 본문은 출력하지 않는다.

Preview에서 전체 migration 130개와 현재 ledger `20261017072037`, private security_invoker view 6개, 미인증 목록/지갑 검사 및 직접 view/helper 접근 차단을 확인했다. Preview 빌드의 `/api/version`은 같은 source commit을 반환한다. 운영 적용 후 비교할 함수는 변경한 읽기 7개와 변경하지 않은 발급/근거/상태/다운로드/진위확인 등 36개, 총 43개다.

운영 검증에서 원본 50개 aggregate count/hash 및 보존 대상 함수 36개의 정의 hash가 전후 동일했고 읽기 함수 7개는 기대한 정의와 일치했다. 증명·배지 관리, 개인 증명/배지, 공개 진위확인 페이지는 오류 없이 빈 원장을 표시한다. 모니터링 선택지의 검증 조직 잔여 1개를 발견해 운영 과정의 기관 범위에 맞춰 옵션을 제한한다. DB 원본이나 통계 계산은 추가 변경하지 않는다.
