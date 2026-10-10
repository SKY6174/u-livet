# 문서 카드 표기 보정 설계

2026-10-10 · 계획: `course-card-program-label.plan.md`

프로젝트의 text-xs는 calc(1rem + var(--type-adjust))로 재정의되어 기본 화면에서 16px이다. DocumentListView의 카드 기관·차년도 p에 text-[calc(1em-2px)]를 적용해 부모의 기존 크기에서 정확히 2px 줄인다(기본 16px → 14px). 글자 확대 설정에도 같은 2px 차이를 유지한다. 프로그램 ID 오른쪽의 ml-auto·text-right·수직 중앙 배치는 유지한다.

academyLabel 보조 함수를 제거하고 카드·리스트의 아카데미 표시에는 실제 c.academy를 사용한다. programIdLabel 보조 함수는 정확히 C1-RISE-P03일 때 C1-LOCAL-BUSINESS-03을 반환하며 그 외 프로그램 ID는 그대로 표시한다. 카드·리스트·검색에서 같은 보정 함수를 사용한다. 원문 programId와 sourceId·UUID 조회는 기존의 고유 연결을 사용한다.

## 검증

- 실제 문서 컴포넌트로 카드·리스트·새 코드 검색·아카데미 검색을 검증한다.
- 원문 16개 과정·7보고서 및 고유 ID 검사를 통과한다.
- 브라우저에서 메타데이터와 프로그램 ID의 크기 차이 2px, 우측 정렬 및 좁은 화면 넘침을 확인한다.
- lint·TypeScript·운영 빌드, PR preview와 운영 READY·merge revision·health를 확인한다.
