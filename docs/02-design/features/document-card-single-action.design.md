# 운영 문서 카드 단일 버튼 설계

계획: `docs/01-plan/features/document-card-single-action.plan.md`

- `DocumentListView` 카드 상단의 상태 배지를 상태 표시의 유일한 위치로 둔다.
- 등록된 과정의 하단 `Link`에서는 오른쪽 `statusText`를 제거하고, 가운데 정렬된 `{운영계획서|결과보고서} 작성·검토`와 오른쪽 방향 아이콘만 표시한다.
- 같은 컴포넌트의 계획·결과 카드에 공통 적용한다. 미등록 과정 안내와 리스트형 보기, 라우팅·권한은 변경하지 않는다.
- 공통 `PageDescriptionHint`의 설명 본문을 `text-base`에서 `text-sm`으로 바꾼다. 현재 역할별 글자 토큰에서 정확히 2px 낮아져 사업단·강사는 16px, 수강생은 17.25px이 된다. 제목과 정보 버튼 크기는 유지한다.
