# 접수 문서 표 밀도 조정 보고

## 변경
- 현재 수강생 안내는 한 줄 말줄임으로, 새 안내는 한 줄 입력칸으로 표시한다.
- 신청시각을 한국어·서울 시간대의 날짜와 시각 두 줄로 표시한다.
- 비고의 현재 상태와 저장 버튼을 나란히 배치하고 저장 버튼 폭을 절반 수준으로 줄였다.

## 검증
- 합성 자료 검사에서 8열·행별 폼·상태 전환·권한·날짜 두 줄을 확인했다.
- 브라우저에서 새 입력값의 native FormData 연결과 필수값을 확인했다.
- 1680px 화면과 390px 화면의 1320px 표에서 상태/저장 칸 겹침 없이 한 행 배치 확인.
- `npm run build` 및 `git diff --check` 통과.
- 설계 대조: `docs/03-analysis/anchor-learner-document-table-compact.analysis.md`.

## 전달
- 브랜치: `codex/learner-document-table-compact`.
