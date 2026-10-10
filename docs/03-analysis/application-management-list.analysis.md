# 신청내역 관리 리스트 검증

2026-10-10 · 설계: `docs/02-design/features/application-management-list.design.md`

## 설계 대조

| 기준 | 결과 |
| --- | --- |
| 신청자·과정·신청 상태·신청일시·수강 상태를 한 행에 표시 | 충족 |
| 고유 신청 상세 링크·삭제된 계정·상태와 한국 시각 보존 | 충족 |
| caption·머리글 scope·초점 가능한 스크롤 region | 충족 |
| 960px 최소 표 너비와 내부 가로 스크롤 | 충족 |
| 기존 검색 조건·결과 수·페이지 이동·빈 안내 보존 | 충족 |

표시 설계 5/5 충족, 일치율 100%. 담당 기관 조회 및 권한 코드는 변경하지 않았다.

## 실행 검증

- 실제 `ApplicationRows`와 `ManagementList`, 기존 상태/시각 formatter를 React 서버 렌더링했다. 혼합 상태 5개, ACTIVE/WITHDRAWN/null, 삭제 계정, 고유 링크/time 원문, 검색 조건과 2페이지의 이전·다음 조건, 빈 결과, 기존 수강생 관리 표시를 검증한 6개 항목이 통과했다.
- 브라우저에 실제 컴포넌트 HTML과 production CSS를 제공했다. 1440px에서 본문 1440px, 표 영역 1214px이며 일반 행 높이는 약 48px이었다. 360px에서 본문 360px, 표 영역 318px, 내부 표 960px으로 외부 넘침이 없었다. region의 키보드 초점과 빈 결과 안내를 확인했다.
- lint, `tsc --noEmit`, production build, 매뉴얼 검사, `git diff --check` 통과.
- 최초 임시 SSR 검증의 time 속성 비교가 HTML 속성 대소문자를 가정해 실패했다. 속성 비교를 대소문자 구분 없이 수정한 뒤 통과했으며 제품 코드는 변경할 필요가 없었다.
