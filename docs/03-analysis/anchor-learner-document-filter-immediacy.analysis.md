# 접수 문서 필터·표시 개선 설계 대조

- 날짜: 2026-09-24
- 설계: `docs/02-design/features/anchor-learner-document-filter-immediacy.design.md`
- 구현 일치: 8/8 (100%).

| 설계 항목 | 결과 |
|---|---|
| 종류별 즉시 이동 | 네 링크가 해당 `kind` URL로 이동하고 서버 조회에 적용됨 |
| 조건 유지 | 현재 적용된 `status`·`q`가 종류별 링크에 인코딩되어 보존됨 |
| 조회 폼 | 현재 종류 hidden input 한 개를 제출하여 조회 버튼·Enter와 조합됨 |
| 선택 상태 | 해당 링크만 청록색 및 `aria-current="page"` 표시 |
| 처리 결과 문구 | 열 헤더·행별 접근성 라벨 변경, 상태 값은 유지 |
| 신청서 PDF | 요청 ID별 링크·새 창 속성 유지, API는 `application/pdf`와 `inline` 반환 |
| 안내 너비 | 22%에서 17.6%로 변경, 열 너비 합계 100% |
| 반응형 | 390px 화면의 페이지 폭 390px, 목록 영역 348px·내부 표 1320px 확인 |

`node scripts/verify-learner-document-list.mjs --preview`와 `npm run build`, `git diff --check`가 통과했다. 합성 자료를 실제 페이지 컴포넌트로 렌더링해 확인했으며 실제 접수 기록이나 인증된 PDF 본문은 열람하지 않았다.
