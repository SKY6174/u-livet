# U-LiVE 파비콘 교체 검증

2026-09-27 · 설계 일치율 100% (3/3)

- 첨부 PNG와 `public/images/u-live-favicon.png` SHA-256 일치: `068d09efdaf715614fcff37c53b043b60029fed2addb0d723ab96b6d65d4adae`.
- Vercel Preview `/about`의 `rel="icon"` 링크가 `/images/u-live-favicon.png`를 가리킨다.
- Preview의 이미지 경로와 `/favicon.ico` 모두 PNG 200을 반환하며 응답 본문 SHA-256이 원본과 같다.
- Vercel 빌드 검사, `node --check next.config.js`, `git diff --check` 통과.

설계와 다른 항목은 없다. 운영 배포 후 동일 경로를 재확인한다.
