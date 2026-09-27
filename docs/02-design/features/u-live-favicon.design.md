# U-LiVE 파비콘 교체 설계

2026-09-27 · [계획](../../01-plan/features/u-live-favicon.plan.md)

## 자산

- 첨부 PNG 원본(2048×1957, 투명 배경)을 바이트 변경 없이 `public/images/u-live-favicon.png`에 복사한다.
- 새로운 파일명으로 브라우저의 기존 아이콘 캐시와 구분한다.

## 연결

- `src/app/layout.tsx`의 `metadata.icons.icon` URL을 `/images/u-live-favicon.png`로 지정하고 PNG MIME 유형을 유지한다.
- `next.config.js`의 `/favicon.ico` rewrite 대상을 같은 PNG 경로로 바꿔 레거시 요청도 동일 그림을 받게 한다.
- 본문에 쓰는 울산과학대학교 기관 로고는 변경하지 않는다.

## 검증

- 원본과 복사본의 SHA-256을 비교한다.
- 빌드 또는 실행 화면에서 `<link rel="icon">` URL과 정적 PNG, `/favicon.ico` 응답을 확인한다.
- 배포 후 운영 URL에서도 메타데이터와 두 자산 경로를 확인한다.
