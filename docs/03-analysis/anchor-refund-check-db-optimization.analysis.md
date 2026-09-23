# 환불 PDF 체크박스 및 서류 DB 최적화 Gap Analysis

> Date: 2026-09-23 | Design: `docs/02-design/features/anchor-refund-check-db-optimization.design.md`

## Match Rate: 100%

## 구현 일치

- [x] 발생일 행의 원본 zero-advance 체크박스·문구 영역만 마스킹했다.
- [x] 7pt 사각형, 3pt 후행 간격, 내부 여백을 둔 체크 표시로 다시 그렸다.
- [x] 원본 시작 좌표와 문구 크기·행 중앙 정렬을 유지했다.
- [x] 요청의 person, org, offering, reviewer, event, private PDF 연결을 점검했다.
- [x] 관리자 권한 조직을 materialized CTE로 한 번만 계산한다.
- [x] 최근 500건을 먼저 제한한 뒤 해당 요청의 이력만 집계한다.
- [x] 조직·상태·종류 복합 인덱스와 과정명·신청자명 trigram 인덱스를 추가했다.
- [x] 공개 RPC JSON 필드와 상태 전환 규칙을 유지했다.

## 검증 증거

- 220dpi 렌더에서 다섯 사각형의 동일 간격과 선택 표시 경계 확인
- 세 양식 PDF 1.7, A4, 빈 값·입력 값·동의 거부·서명 경계 검사 통과
- 로컬 DB에서 요청 연결 누락 0건, 고아 사건 0건
- `EXPLAIN`에서 `life_learner_documents_queue_kind`와 `life_learner_documents_course_search` 사용 확인
- 민원 통합 검사에서 멱등성, 환불 계산, 조직 격리, PDF 무결성, 복합 필터, 상태 이력 통과
- TypeScript, ESLint, Next.js production build 통과
- DB lint의 유일한 오류는 기존 `course_budget_allowed(uuid)` 누락이며 이번 함수·인덱스 오류는 없음

## 차이 및 잔여 항목

없음. `scripts/verify-learner-documents.mjs`는 기존 검사가 변경된 렌더러를 이미 호출하므로 별도 코드 변경 없이 회귀 검증에 사용했다.

## 다음 단계

- [x] 운영 migration 적용
- [ ] Git 커밋·푸시
- [ ] 운영 revision·health 확인
