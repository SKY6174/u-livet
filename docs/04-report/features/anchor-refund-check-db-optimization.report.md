# 환불 PDF 체크박스 및 서류 DB 최적화 완료 보고서

> Date: 2026-09-23
> Feature: `anchor-refund-check-db-optimization`
> Match rate: 100%

## 결과

- 환불신청서 발생일 행의 체크박스와 문구 사이에 3pt 간격을 적용했다.
- 체크 표시는 7pt 사각형 내부 여백을 유지하도록 다시 그렸다.
- 민원 요청과 수강생·조직·과정·처리자·이력·비공개 PDF의 연결 누락이 없음을 확인했다.
- 관리자 권한 조직을 한 번만 계산하고 최근 500건을 먼저 제한한 뒤 이력을 결합하도록 조회 RPC를 최적화했다.
- 조직·상태·종류 복합 인덱스와 과정명·신청자명 부분검색 인덱스를 추가했다.
- 운영 Supabase에 `20260923200500_anchor_refund_check_db_optimization.sql`을 적용했다.

## 검증

| 검사 | 결과 |
|---|---|
| PDF 220dpi 시각 확인 | PASS |
| PDF 1.7·A4·입력 경계 회귀 | PASS |
| 민원 DB 통합·권한·상태 이력 | PASS |
| FK 연결 누락·고아 이력 | 0건 |
| 복합·trigram 인덱스 실행계획 | PASS |
| TypeScript·ESLint | PASS |
| Next.js production build | PASS |
| 설계 일치율 | 100% |

DB lint에는 기존 `life_private.course_budget_overview`가 참조하는 `course_budget_allowed(uuid)` 누락 1건이 남아 있다. 이번에 추가한 함수·인덱스와 관련된 lint 오류는 없다.

## 운영 영향

공개 RPC 응답 형태와 상태 전환 규칙은 유지된다. 관리자 목록은 최근 500건으로 제한되며, 더 오래된 요청은 종류·상태·검색어로 좁혀 조회한다. 실제 회계 환불 지급은 기존과 같이 별도 행정 단계로 남는다.
