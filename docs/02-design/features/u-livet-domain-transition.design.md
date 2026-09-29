# u-livet.org 운영 도메인 전환 설계

2026-09-30 · [계획](../../01-plan/features/u-livet-domain-transition.plan.md)

## 주소 구성

- 공식 운영 origin은 `https://u-livet.org`이며 사이트맵, canonical, 인증 메일, 증명서 QR의 기준이다.
- `www.u-livet.org`는 Vercel 308로 apex에 이동한다. 현재 콘솔의 역방향 이동을 교체한다.
- `u-live.org`는 운영 프로젝트에 남겨 `u-livet.org`로 308 이동시키며 기존 링크의 경로·쿼리를 보존한다. `www.u-live.org`도 접근 가능하게 유지한다.
- Preview는 `https://staging.u-live.org` 및 별도 Supabase 프로젝트를 그대로 쓴다.

## 인증 흐름

- Vercel Production의 `AUTH_SITE_ORIGIN`, `CERTIFICATE_VERIFY_ORIGIN`, `RELEASE_PRODUCTION_SITE_ORIGIN`을 새 origin으로 바꾼다. Preview의 `RELEASE_PRODUCTION_SITE_ORIGIN`만 새 운영 origin으로 바꾸고 Preview 자신의 `AUTH_SITE_ORIGIN`은 유지한다.
- 운영 Supabase Site URL을 새 origin으로 설정한다. Redirect allowlist에 새 `/auth/callback`, `/auth/complete-signup`, `/auth/reset-password` 경로를 기존 항목과 함께 등록한다. 필요한 경로만 허용한다.
- Google·Kakao·Naver의 provider redirect URI는 계속 `https://uoebygejgglgiivzgyks.supabase.co/auth/v1/callback`이다. 각 제공자에서 새 홈페이지·서비스 도메인·JavaScript origin 등을 추가하고 기존 등록값은 전환 검증까지 보존한다.
- Supabase Naver custom provider의 userinfo URL은 새 사이트의 `/api/auth/naver/userinfo`로 갱신한다. 이 URL은 OAuth callback과 다르다.
- 제품의 OAuth `/auth/callback` 및 메일 링크는 기존 `AUTH_SITE_ORIGIN` 구성 방식을 유지한다.

## 메일과 DNS

- Resend에서 `u-livet.org`를 별도 도메인으로 등록하고 도쿄 발송 리전을 유지한다. 제시된 DKIM, SPF, MX만 정확히 DNS에 등록하고 Verified 및 공개 조회를 확인한다.
- 검증 후 Supabase 운영 SMTP sender를 `noreply@u-livet.org`로 전환한다. SMTP 자격증명과 API 키는 노출·복사하지 않고 현재 키의 도메인 제한을 확인한다. 이전 `u-live.org` 발신 도메인은 남긴다.
- DNS/TLS와 새 주소의 HTTP 200 확인 전에는 Site URL, 메일 발신 주소, canonical을 전환하지 않는다.

## 저장소 변경

- `src/app/sitemap.ts`의 운영 fallback을 새 origin으로 바꾼다. 실제 배포는 환경 변수가 우선한다.
- `docs/operations/social-login-setup.md`와 새 운영 전환 기록에 현재 설정, 검증 증거 및 보류 사항을 적는다. 과거 배포·로그 기록의 URL은 당시 증거로 보존한다.
- 새 데이터 모델이나 API는 추가하지 않는다.

## 검증

- `npm run lint`, `npm run build` 및 관련 URL 구성 검사.
- Vercel에서 새 apex/`www`와 옛 주소의 상태·Location·경로·쿼리·TLS를 확인한다.
- 운영 `/api/version`, `/api/health`, 홈, 로그인, 사이트맵, OAuth 시작 3종의 `redirect_to`를 확인한다.
- Supabase Site URL·허용 URL, Resend Verified·실제 발송 로그, 제공자 콘솔의 저장값을 재조회한다. 실제 로그인 완료와 수신함 도착은 테스트 계정이 있을 때 검증한다.

## 보안

- OAuth 허용 URL은 새 소유 도메인으로 한정하고 넓은 wildcard를 추가하지 않는다.
- SMTP/API 키 및 OAuth secret을 저장소·문서·로그에 쓰지 않는다.
- 메일 발신 도메인 검증과 링크 복귀를 마친 뒤 기존 도메인 정리를 별도 판단한다.
