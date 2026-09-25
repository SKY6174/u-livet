# 수강생별 수료 판정 목록 전환 계획

> Feature: anchor-completion-review-list | 2026-09-25 | Dynamic

## 목적

수강생마다 큰 카드가 반복되어 여러 명의 출석률과 판정 상태를 한눈에 비교하기 어렵다. 기존 판정·승인 기능을 유지하면서 수강생 한 명을 표의 한 행으로 표시한다.

## 범위와 완료 기준

- 수강생, 출석률/기준 충족 여부, 등록·환불 상태, 판정 결과, 산출 시각, 근거 확인과 처리 버튼을 목록의 열로 배치한다.
- 근거 상세와 사유는 필요한 행에서 펼쳐 본다. 재산출·수료 확정의 조건, 체크박스, 오류 안내, 예시 모드 비활성화는 유지한다.
- 좁은 화면에서는 가로 스크롤하며 열 머리글과 행을 연결해 읽을 수 있게 한다.
- lint, TypeScript, build와 실제 테스트 기수 화면을 확인한다.

## 참고

- [기존 수료 화면 설계](../../02-design/features/anchor-completion-attendance-refunds.design.md)
- [예시 데이터 설계](../../02-design/features/anchor-completion-review-sample.design.md)
