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
