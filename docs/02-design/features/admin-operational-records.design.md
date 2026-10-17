# 관리자 운영 기록 분류 설계

계획: `docs/01-plan/features/admin-operational-records.plan.md`

1. `life_private.non_operational_offerings`에 offering_id PK/FK, reason, classified_at을 저장한다. RLS 활성화, 일반 역할의 테이블 권한은 전부 회수한다. 기존 4개 검증 과정의 정확한 ID만 등록하며 기존 행은 수정하지 않는다.
2. `life_private.operational_offering(uuid)`는 분류표의 제외 여부만 반환하는 stable security definer 함수다. search_path는 빈 값이며 공개 catalog 조회에 필요한 anon/authenticated execute만 허용한다. null(미연결 실제 신청서)은 운영 자료로 유지한다.
3. 비공개 `operational_offerings` view는 기존 life_offerings의 모든 열을 유지하며 분류 제외 조건을 적용한다. security_invoker=true, 일반 역할에는 SELECT를 부여하지 않고 기존 security definer 조회 함수에서만 사용한다. 기존 security_invoker인 public life_catalog에는 base 테이블의 restrictive SELECT RLS 정책을 통해 기존 읽기 권한과 분류 조건을 AND로 적용한다. 허용 범위를 넓히거나 기존 정책을 제거하지 않는다.
4. 기존 조회 함수의 인증·기관 범위·반환형·grants를 보존하면서 과정 SELECT를 운영 view로 바꾼다. 대상은 관리 과정/신청 행, 과정 workspace, 운영문서 목록/상세, 공개 과정 소개, 서류 접수/선택지, 수납·문자 과정 선택, 성과 board/facts다. 수강생·신청 총건수는 management_application_rows에서 공통으로 제외한 뒤 검색/상태/limit/offset을 적용한다.
5. 서류 공통 조회는 종류/상태/이름 검색과 limit 500 이전에 연결 과정 제외를 적용한다. 미연결 신청서와 실제 과정 신청서는 유지한다. 기존 신청 상세와 운영문서 상세는 인증/기관 권한 검증 후 숨겨진 대상에 FORBIDDEN을 반환해 기존 Next notFound 처리로 연결한다.
6. 증명·배지·강의실적 관리의 과정 기반 조회도 같은 view를 적용하되 원본 발급물/승인/제출 snapshot과 공개 진위확인 경고는 변경하지 않는다. 다른 기능의 권한 helper나 쓰기 RPC를 일괄 변경하지 않는다.
7. 새 분류만 기록하고 기존 테이블 payload/count/hash는 전후 동일해야 한다. 현재 성과 집계는 검증 과정을 제외하고, 과거 확정 보고 snapshot은 재작성하지 않는다. 검증 전용 사업연도를 이름만으로 삭제하거나 실제 데이터가 없는 정상 기관을 숨기지 않는다.

검증 기준:
- 로컬 transaction에서 정상 45개 신청+검증 신청을 혼합하여 40/5 페이지, count 45, 이름/상태/과정 필터, hidden 과정 선택의 결과 0건과 정상 옵션을 검증한다.
- 실제·미연결 PDF 신청은 남고 검증 환불은 서류/알림에서 제외된다.
- hidden 과정 이름 변경 후에도 제외, private 분류 SELECT 차단, 권한 없는 사용자 RPC 거부, 기존 직접 주소 차단을 확인한다.
- 로컬 migration/검증은 ROLLBACK하며 운영에는 같은 커밋 SQL과 migration ledger를 atomic하게 적용한다. 기존 주요 데이터 hash와 보안 advisor를 비교한다.
- Preview 스키마 체크와 배포 체크 통과 후 운영 관리자 과정/신청/수강생/서류/수료/보고/모니터링 화면에서 표시·총건수·검색을 확인한다. 지급/심사/발송 작업은 수행하지 않는다.
