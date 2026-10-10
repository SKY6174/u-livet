# page-help-right-center 설계 대조

2026-10-10 · 설계: `docs/02-design/features/page-help-right-center.design.md`

## 구현 일치율: 100% (10/10)

1. 안내문 버튼 기준 오른쪽 배치 및 수직 중심 정렬.
2. 12px 간격과 왼쪽 중앙 화살표.
3. 최대 576px, 오른쪽 화면 여백 20px의 가용 폭 계산.
4. resize/ResizeObserver 정리 및 내용 스크롤 분리.
5. 모바일에서 안내 버튼 다음 줄 배치.
6. 기존 자동 노출, 타이머, 토글, 닫기, Escape 유지.
7. 과정 카드와 리스트의 우선 승인 강사 표시 제거, 지정 책임강사 유지.
8. 문서 카드 기관·차년도를 “앵커사업단∙2차년도”로 축약.
9. 프로그램 ID 오른쪽 우측 정렬.
10. 로컬창업 표시 코드 및 카드·리스트·코드 검색 반영.

## 검증

- 실제 브라우저 360/720/1440px: 말풍선 간격 12px, 중심 y 차이 0px, 가로 넘침 없음. 재열기·닫기·Escape 확인.
- 실제 문서 컴포넌트와 원문 P03 기반 로컬 fixture: 카드의 기관 표기는 ID 오른쪽, 중심 y 차이 0px, 360px 가로 넘침 없음.
- 카드·리스트 렌더링, 새 배지 코드 검색, 지정 책임강사 유지 확인 5건 통과.
- lint, TypeScript, production build, manuals:check, 원문 문서 16과정·7보고서 검증 통과.
- 기존 verify-course-operations-clarity는 변경하지 않은 admin/courses의 life_organizations 조회를 지원하지 않는 오래된 mock에서 실패한다. verify-operation-documents는 로컬 Supabase API_URL 조건을 충족하지 않아 실행할 수 없었다. 이번 변경의 UI 검증은 별도 실제 컴포넌트 렌더링과 브라우저로 수행했다.

빠진 설계 항목이나 추가 수정은 없다. 배포 확인 후 report 단계를 완료한다.
