# 수강생별 수료 판정 목록 전환 결과

> Feature: anchor-completion-review-list | 2026-09-25

수강생별 큰 카드를 표 목록으로 전환했다. 각 수강생의 출석률, 수강·환불 상태, 판정 결과와 산출 시각을 같은 행에서 비교할 수 있다. 해당 행에서 판정 근거를 펼치고 기존 재산출·승인 기능을 사용할 수 있다. 좁은 화면에서는 표를 가로로 스크롤한다.

변경 파일은 `src/app/completion/[id]/page.tsx`이며 DB와 판정 규칙은 변경하지 않았다. `npm run lint`, `npx tsc --noEmit`, `npm run build`, `git diff --check`를 통과했다. 설계 일치율은 100%로 확인했다.

운영 화면 확인에서 승인 대기 행이 높아진 문제를 발견하여 승인 체크박스와 확정 버튼을 해당 행에서 펼쳐 보도록 보완했다. 수정 후 `npm run build`를 다시 통과했다.
