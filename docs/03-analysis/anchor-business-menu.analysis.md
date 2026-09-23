# Gap Analysis: anchor-business-menu

> Date: 2026-09-21 | Design: docs/02-design/features/anchor-business-menu.design.md

## Match Rate: 100%

## Summary

공통 헤더에 권한별 사업단 하위 메뉴를 연결하고 데스크톱·모바일 disclosure 동작을 구현했다. 기존 서버 권한과 URL은 유지했다.

## Implemented Items

- [x] 사업단 관리 상위 메뉴의 활성 배경·글자·링·`aria-current` 표시
- [x] 데스크톱 호버·포커스·클릭으로 하위 메뉴 패널 표시
- [x] 모바일 클릭 disclosure와 세로 하위 메뉴 표시
- [x] Escape와 포커스 이탈 시 닫힘 처리
- [x] 닫힌 데스크톱 하위 링크의 tab 순서 제외
- [x] 기존 `officeSections` 권한별 링크와 서버 접근 제어 유지

## Missing Items

- 없음

## Changed Items (Deviations from Design)

- 없음

## Validation

- TypeScript 검사 통과
- ESLint 통과
- Next.js production build 통과
- 18개 역할·메뉴 회귀 검증 통과

## Revision 4 — 2026-09-24: 범주화 메뉴

**설계 일치율: 100% (5/5)**

- [x] `업무 홈`을 독립 링크로 유지하고, 데스크톱 메뉴에 `officeSections`의 다섯 업무 범주를 카드로 표시한다.
- [x] 모바일 메뉴에도 동일한 범주와 링크 순서를 적용한다.
- [x] 권한상 비어 있는 범주는 표시하지 않고, 링크 목적지와 서버 권한 검사는 변경하지 않는다.
- [x] 데스크톱의 호버·포커스 설명 패널, 활성 경로 표시, 닫힌 메뉴의 포커스 제외를 유지한다.
- [x] 긴 메뉴 목록은 데스크톱 범주 영역에서 스크롤하고 모바일은 기존 메뉴 스크롤을 사용한다.

역할별 메뉴 회귀 검사 23개, ESLint, TypeScript, Next.js production build를 통과했다. 실제 브라우저의 가로 폭과 키보드 동작은 배포 화면에서 추가 확인한다.
