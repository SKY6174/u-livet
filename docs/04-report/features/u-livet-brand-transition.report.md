# U-LiVET 브랜드 전환 결과

2026-09-29 · [설계](../../02-design/features/u-livet-brand-transition.design.md)

- 사용자 화면 및 페이지 제목의 현재 `U-LiVE` 표기를 `U-LiVET`으로 바꿨다. 홈에 `Ulsan Lifelong Vocation Education & Training`을 표시한다.
- 제공된 열린 책 심볼을 사용해 `U-LiVET` / `Ulsan Lifelong T-VET` 로고 SVG와 투명 PNG(1360×380)를 만들고 헤더에 SVG를 적용했다.
- 신규 MFA issuer를 바꾸고 기존 `U-LIFE`, `U-LiVE` 인증기 이름의 표시 호환성을 유지했다.
- `u-livet.org`는 향후 DNS 전환 대상으로 기록했다. 현재 운영 도메인 설정은 그대로 둔다.

## 검증

- SVG XML 유효성, PNG 렌더링 육안 확인, 기존·신규 MFA prefix 표시 확인.
- `npm run lint`, `npx tsc --noEmit`, `npm run build`, `git diff --check` 통과.
