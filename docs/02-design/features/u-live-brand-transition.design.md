# U-LiVE 화면 브랜드 전환 설계

2026-09-27 · [계획](../../01-plan/features/u-live-brand-transition.plan.md)

## 표기와 로고

- 서비스 표준 표기는 대소문자를 포함해 `U-LiVE`로 한다. 화면의 `U-LIFE`, `UC Life`와 페이지 제목을 새 표기로 바꾼다.
- 헤더는 기존 울산과학대학교 `uc` 상징 옆의 서비스 워드마크를 `U-LiVE`로 교체하고, 푸터도 같은 표기를 쓴다. 기관 로고, ANCHOR 로고와 색상 체계는 그대로 둔다.
- 기존 기관 아이콘을 favicon으로 사용하는 설정은 유지한다. 새 서비스 심볼 이미지가 없는 상태에서 별도의 그림을 임의 제작하지 않는다.
- 기존에 발행된 버전별 매뉴얼 PDF와 사업 공문·양식은 당시 산출물로 보존한다.

## 적용 지점

- `src/app/layout.tsx` 및 각 페이지 metadata, 헤더·푸터·홈·소개·인증 화면의 사용자 노출 문자열을 수정한다.
- 다운로드 파일명과 PDF producer 문자열도 새 브랜드로 수정한다.
- 새 MFA 등록의 TOTP issuer를 `U-LiVE`로 수정한다. factor 목록에는 이전 `U-LIFE`와 새 `U-LiVE` prefix를 모두 내부 이름으로 인식하도록 호환 로직을 둔다.
- 서비스 URL, OAuth callback, Supabase ref, DB RPC 이름, 경로, 프로그래밍 식별자 등 브랜드와 무관한 값은 유지한다.

## 검증

- 사용자 노출 소스 전체를 다시 검색해 이전 표기가 남은 곳을 확인한다. 과거 factor prefix만 허용한다.
- TypeScript 검사와 Vercel 빌드를 실행한다. MFA 목록 포맷 함수의 기존·신규 prefix를 의미 있는 방식으로 확인한다.
- Preview 배포에서 제목, 헤더·푸터, 공개 소개 및 로그인 화면을 확인한 뒤 운영 배포를 확인한다.
