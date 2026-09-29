# U-LiVET 브랜드 전환 설계

2026-09-29 · [계획](../../01-plan/features/u-livet-brand-transition.plan.md)

## 표기와 자산

- 화면에 노출되는 현행 서비스명 `U-LiVE`를 `U-LiVET`으로 바꾼다. 홈에는 정식 영문명 `Ulsan Lifelong Vocation Education & Training`을 표시한다.
- 헤더에는 기존 파랑·초록 심볼, `U-LiVET` 워드마크, `Ulsan Lifelong T-VET` 보조 문구를 표시한다.
- 제공된 벡터 심볼의 경로와 그라데이션을 재사용해 `public/images/u-livet-logo.svg`를 만든다. 이 SVG를 같은 비율의 투명 PNG로 렌더링하여 `public/images/u-livet-logo.png`에 저장한다. 접근성 이름과 PNG의 보이는 문구도 일치시킨다.
- 기존 심볼 전용 favicon은 모양을 유지한다. 과거 문서와 로고 산출물은 교체하지 않고 새 자산을 배포한다.

## 동작과 호환성

- 페이지 metadata, 헤더·푸터, 현재 화면의 안내 문구, 생성 PDF의 producer 및 다운로드 파일명은 새 이름을 쓴다.
- 신규 TOTP issuer는 `U-LiVET`이다. MFA 목록에는 과거 `U-LIFE`, `U-LiVE`와 새 `U-LiVET` prefix를 모두 인식한다.
- `package.json`의 내부 패키지명, API 식별자, Supabase ref, 경로는 바꾸지 않는다.
- `u-livet.org`는 향후 DNS 전환 대상이다. 현재 운영 주소 `u-live.org`의 sitemap, robots, 인증 origin 및 redirect는 도메인 소유와 인증 설정을 검증하는 별도 전환 때 수정한다.

## 검증

- 새 SVG/PNG의 치수와 실제 문구를 확인한다. 현재 화면 소스에서 이전 표기 잔여를 점검한다.
- 기존 및 신규 MFA prefix를 확인하고 lint, TypeScript, build를 실행한다.
