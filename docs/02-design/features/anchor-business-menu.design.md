# anchor-business-menu - Design Document

> Version: 1.0.0 | Date: 2026-09-21 | Status: Approved

## UI structure

- `Header`가 `officeSections(identity)`를 이용해 `업무 홈`과 권한별 하위 메뉴를 구성한다.
- 데스크톱 상위 네비게이션에서 `사업단 관리`는 disclosure button으로 렌더링하고, 상대 위치 컨테이너 아래에 하위 메뉴 패널을 배치한다.
- 활성 상위 메뉴에는 연한 teal 배경, 진한 teal 글자, 굵은 글씨와 `aria-current`를 적용한다.
- 모바일 메뉴에서도 동일한 disclosure를 사용하며, 하위 링크를 세로로 표시한다.

## Interaction

- 마우스 진입, 키보드 포커스, 클릭으로 하위 메뉴를 연다.
- Escape 또는 메뉴 컨테이너 밖으로 포커스가 이동하면 닫는다.
- 하위 메뉴 링크를 선택하면 기존 경로로 이동하고 모바일 메뉴도 닫는다.

## Accessibility and responsive behavior

- disclosure button에 `aria-expanded`, `aria-controls`를 제공한다.
- 닫힌 패널 링크는 포커스 순서에서 제외한다.
- 데스크톱 패널은 `absolute`로 상위 메뉴 아래에 배치하고, 모바일은 일반 흐름으로 펼쳐 가로 넘침을 방지한다.

## Data and security

- 데이터베이스·API 변경 없음
- 메뉴 노출은 기존 `isOfficeMember`와 `officeSections`를 따르며 실제 접근 제어는 서버 라우트와 RLS가 담당한다.
