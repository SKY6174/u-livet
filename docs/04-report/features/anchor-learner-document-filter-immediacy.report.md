# 접수 문서 필터·표시 개선 보고

## 변경
- 서류 종류 버튼을 누르면 해당 종류의 접수 목록을 즉시 조회한다. 처리 상태와 검색어 조건은 유지한다.
- ‘다음 처리 단계’를 ‘처리 결과’로, PDF 링크를 ‘신청서’로 변경했다.
- 신청서는 해당 접수 ID의 인증된 PDF를 새 창에서 연다. PDF 응답은 브라우저 표시 방식이다.
- 수강생 안내 내용 열을 22%에서 17.6%로 줄이고 인접 열에 너비를 배분했다.

## 검증
- 합성 자료 검사: 네 종류 링크, 필터별 행 수, 기존 행별 처리 폼과 권한 검사 통과.
- production build 및 `git diff --check` 통과.
- 데스크톱 1680px·모바일 390px 화면에서 표와 스크롤 영역 확인.
- 설계 대조 8/8: `docs/03-analysis/anchor-learner-document-filter-immediacy.analysis.md`.

## 전달
- 기능 브랜치 `codex/learner-document-filter-immediacy`로 push한다.
