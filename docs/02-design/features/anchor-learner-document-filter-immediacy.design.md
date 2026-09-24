# 접수 문서 필터와 표시 문구 개선 설계

## 서류 종류 전환
- 기존 Server Component와 `getAdminLearnerDocuments({ kind, status, query })`를 유지한다.
- 종류 4개를 GET 폼 안의 버튼 모양 링크로 표시한다. 링크 클릭은 해당 `kind`와 현재 적용된 `status`, `q`를 URL에 넣어 즉시 페이지를 다시 불러온다.
- `URLSearchParams`로 값을 인코딩하고 값이 없는 조건은 URL에서 생략한다. 전체 링크는 종류 조건을 제거한다.
- 현재 종류는 청록 배경 및 `aria-current="page"`로 식별한다. 링크는 키보드 포커스가 보여야 한다.
- 조회 폼은 현재 종류를 hidden input으로 담아 처리 상태·검색어를 조회 버튼/Enter로 제출한다. 종류 쿼리 값은 한 개만 생긴다.

## 표 표시
- 열 헤더와 행별 select의 접근성 라벨을 ‘처리 결과’로 변경한다. 서버 액션의 `next_status` 값과 허용 전환 규칙은 유지한다.
- PDF 링크 문구는 ‘신청서’, 아이콘은 문서 아이콘으로 바꾼다. 기존 문서 ID별 `/api/learner-documents/[id]/pdf` 경로를 새 창에 열고 `rel="noreferrer"`를 유지한다. 응답의 `application/pdf` 및 `Content-Disposition: inline`을 확인한다.
- 안내 열의 `colgroup` 너비는 22%에서 17.6%로 조정한다. 나머지 4.4%포인트는 과정·처리 결과·첨부문서에 배분하여 합계 100%를 유지한다. 표의 최소 너비와 내부 가로 스크롤은 보존한다.

## 검증
- 네 종류 링크의 목적지와 현재 선택·GET 폼의 hidden 종류를 확인한다.
- 합성 자료 렌더링에서 선택 종류에 따라 목록 행이 달라지는지, 조회와 행별 폼 필터가 유지되는지 확인한다.
- PDF 링크의 새 창 속성·관련 문서 ID와 API 응답 헤더를 확인한다.
- production build와 모바일 가로 넘침을 확인한다.
