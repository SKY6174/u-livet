# 신청내역 관리 리스트 설계

계획: `docs/01-plan/features/application-management-list.plan.md`

## 표시와 재사용

- `src/components/management/management-list.tsx`의 `ApplicationRows`를 semantic table로 바꾼다.
- 열 순서는 신청자, 과정, 신청 상태, 신청일시, 수강 상태이다. 각 신청은 고유 `id`를 key로 갖는 한 행이다.
- 신청자 이름은 기존 `/admin/applications/{id}` 상세 링크이며 과정 이름을 포함한 접근성 이름을 갖는다. 삭제된 계정 표시는 이름 아래에 남긴다.
- 신청 상태는 기존 `statusLabel`, 수강 상태는 기존 ACTIVE/WITHDRAWN/미확정 규칙, 시각은 기존 Asia/Seoul `dateTime`을 사용한다. 시각에 원문 `submitted_at`을 담은 `time` 요소를 사용한다.
- 표에 숨겨진 caption과 열/행 머리글 scope를 둔다. 행 구분선과 hover 배경, 적절한 패딩으로 카드보다 밀도를 높인다.
- 표 최소 너비는 960px이다. 키보드로 초점을 받을 수 있고 이름이 있는 region에 가로 스크롤을 제한한다. 페이지 본문은 화면 너비 안에 유지한다.
- 동일 renderer를 쓰는 수강생 상세의 신청·수강 이력에도 같은 목록 표시가 적용된다.

## 기존 조회 흐름

관리 페이지와 RPC·권한·DB 구조는 기존 설계를 사용한다. GET 검색 form, 입력값, 상태 필터, 결과 수, 40건 페이지 링크 및 빈 결과 안내는 변경하지 않는다.

## 검증

실제 컴포넌트 SSR에서 혼합 신청/수강 상태와 삭제된 계정, 신청별 상세 링크, time 원문, 빈 검색 결과, 검색 form 및 이전/다음 조건을 확인한다. production CSS를 사용하는 브라우저에서 1440px/360px 표 행과 내부 스크롤을 확인한다. lint, TypeScript, production build 후 PR 병합과 운영 revision·health를 확인한다.
