# 프로젝트 사진 배경 설계

- 기존 `anchor-about-projects.design.md`의 카드 레이아웃을 보완한다.
- article: relative/isolate flex column, 최소 높이 28rem, overflow hidden, 기존 2열/1열 유지. 사용자 후속 요청에 따라 사진이 과도하게 높지 않도록 36rem에서 줄인다.
- Next Image: fill + object-cover로 카드 전체 배경. 원본 파일과 alt, sizes 유지.
- 분류 배지: relative로 사진 위에 표시. 설명과의 gap은 2rem으로 제한한다.
- 설명 패널: relative, margin-top auto, bg-[#0b162b]/70. opacity 속성을 부모에 적용하지 않아 글자와 버튼은 투명해지지 않는다.
- 설명·목록·버튼은 일반 흐름에 남겨 내용에 따라 카드가 늘어나며, 프로젝트 색상 구분선 유지.
- 패널 여백은 모바일 1.25rem, sm 이상 1.5rem으로 구성해 내용과 배경 사진이 한 카드 안에서 조밀하게 보인다. 사진은 독립 높이가 없고 카드의 실측 높이를 그대로 채운다.
- RCC센터 및 나머지 페이지 구조는 기존 설계를 따른다.
