# 수납·환불·장학금 운영 읽기 설계

계획: `docs/01-plan/features/operational-finance-records.plan.md`
참고: anchor-finance, anchor-result-attachments-scholarships 및 기존 운영 과정·계정 분류 설계.

1. 비공개 security_invoker view operational_invoices는 operational_offering과 non_operational_members의 확정 ID 분류를 조합한다. 연결된 operational_refunds, operational_refund_transfers는 같은 범위를 이어받는다. 원본 행/열은 유지하며 일반 역할의 직접 권한을 전부 회수한다.
2. operational_payments는 원입금 열을 유지하고 operational_amount(원입금−검증 청구 배분 합계)를 추가한다. 검증 계정은 제외한다. 정상 배분 또는 원래 미배분액이 있는 입금은 유지하고 전액 검증 배분 입금만 제외한다. 음수/초과 배분 등 원래 불일치는 임의 보정하지 않는다. finance_overview에서 미배분액은 반드시 원입금−전체 원배분으로 계산한다. 운영 화면은 운영 반영액을 표시하고 혼합 건에만 원입금도 함께 표시한다. 운영 합계는 operational_amount를 사용한다. 원장 amount, fin_totals, 모든 쓰기 함수는 변경하지 않는다.
3. finance_overview의 원장 참조를 운영 view로 치환해 목록 LIMIT 100과 환불/송금 중첩 조회 전에 제외한다. 기존 인증/기관 FINANCE 위임/본인 조건/정렬을 유지한다. 정책·신고·배분·이벤트는 정상 청구 하위의 원본 이력을 그대로 반환한다.
4. operational_scholarship_rows는 구형 보고서의 장학금 개별 행을 운영 과정 및 확정 인물 ID로 제한한다. 문자열 personId를 비교하므로 과거 미연결/비 UUID 자료를 삭제하거나 실패시키지 않는다. course_workspace의 장학금 지급/미지급 건수와 my_learning 장학금 목록이 이 view를 공유한다. 학습자 과정 목록에도 기존 운영 과정 view를 사용한다.
5. 공식 문서 편집기·저장 함수·확정 보고서/snapshot/인쇄·default budget·sourceReport 확정 집계는 변경하지 않는다. 실제 개별 지급 내역이 0건이므로 부분 문서 projection 후 저장으로 원본 지급 행이 사라지는 기능을 만들지 않는다. 구형 payments와 scholarship_disbursements는 0건이고 현재 운영 UI에서 직접 읽지 않는다. 제도 3건은 보존한다.
6. 로컬 단일 transaction 후 ROLLBACK: 정상/검증 과정/계정, 미배분·검증 전액 배분·혼합 입금, 지급/반려/확인중 환불, 원장 잔액/상태 보존, 장학금 지급/미지급 집계, 이름 변경, 본인·타 기관·비로그인·private view 차단, 최신 검증 100건 때문에 정상 건이 밀려나지 않는지 검증한다. 운영 50개 기존 보존 항목에 모든 회계 원장·위임·규정·구형 payments를 추가해 count/hash 전후 비교한다.

출시: 보존 baseline, 로컬/Preview 확인, PR/check 통과, 동일 SQL 원자적 운영 적용 및 ledger 등록, 병합 자동 배포 READY·SHA·health·실제 읽기 페이지 확인. 운영 권한을 QA 목적으로 확대하거나 실제 승인/송금을 실행하지 않는다.
