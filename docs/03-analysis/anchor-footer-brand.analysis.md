# 하단 ANCHOR 브랜드 검증

- 하단 왼쪽 ANCHOR 로고, 오른쪽 상단 기관명, 오른쪽 하단 `U-LIFE | 함께 성장하는 평생직업교육` 배치를 확인했다.
- 최종 슬로건은 `지역과 함께하는 든든한 전문대학`이다. 원본 슬로건 영역에 HTML 텍스트를 배치해 로고 이미지의 나머지 부분과 색상은 유지한다. 10px 글자 크기, 약 128px 문구 폭으로 기존 영역 안에 들어가며 짧아진 문구를 확대하지 않는다.
- 1440px 데스크톱 및 390px/320px 모바일에서 이미지 로딩과 가로 넘침 없는 레이아웃을 확인했다. 작은 화면에서는 로고·문구가 세로 정렬된다.
- 조타륜·닻 원본 픽셀은 RGB(230,230,230), 일반 글자는 약 RGB(254,254,253)이다. screen 합성으로 심벌이 청록 배경과 약 10% 섞여 옅은 민트색으로 표시된다.
- 기존 세 안내 링크, 키보드 포커스, 상단 울산과학대학교 로고를 유지했다.
- 최종 `npm run build` 성공: 컴파일·린트·타입 검사 통과. 브라우저 콘솔 오류 없음.

## 로고 자산 및 제작 기록

- 사용자가 제공한 ANCHOR 로고를 built-in imagegen 편집 도구로 변환했다. 상단 기관명은 이미지에서 분리하여 HTML 텍스트로 배치했다. 최종 슬로건은 원본 이미지 내부의 문구를 가린 뒤 Footer에서 별도의 HTML 텍스트로 표시한다.
- 최종 자산: `public/images/anchor-footer-white.png` (2010×782 PNG). 파일명은 밝은 Footer용 자산을 뜻하며, 합성용 검정 배경과 회색 심벌을 포함한다.
- 최종 편집 입력: `/Users/thomas/.codex/generated_images/01a0b4f1-3bf6-7a20-8266-d913ebd3caf8/exec-592d9430-59e2-473a-bd99-c98f68cb08aa.png`.
- 최종 생성 출력: `/Users/thomas/.codex/generated_images/01a0b4f1-3bf6-7a20-8266-d913ebd3caf8/exec-6091f54f-5506-47de-a7bc-0977548564e1.png`.

최종 편집 프롬프트:

> Recolor this existing ANCHOR footer logo precisely; do not redesign or move anything. Keep the exact shapes, typography, spacing, positions and Korean slogan. Change the background to perfectly uniform PURE BLACK #000000, including every hole inside letters and symbol. Keep A,N,C,H,R and the entire small Korean slogan '지역사회와 함께하는 든든한 버팀목' in solid PURE WHITE #FFFFFF. Recolor ONLY the complete O / ship-wheel / anchor combined symbol (the circular wheel plus vertical stem, arms and bottom pointed anchor) to solid light gray #E6E6E6, exactly 90% white. The symbol needs only a subtle 10% tonal difference from the pure white letters, not a dark or strongly colored treatment. This black-background source asset will be displayed with CSS screen blending on a teal background, making the 90%-white symbol pale mint. Use only black, white and #E6E6E6 with antialiased edges, no texture or shading. OPAQUE PNG. Crop away excess empty background to a small consistent margin around artwork, especially above the wordmark. Preserve the existing logo and text completely.
