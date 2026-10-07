# u-livet.org 잔여 주소 정리

2026-10-07 · [계획](../01-plan/features/u-livet-domain-reference-cleanup.plan.md) · [설계](../02-design/features/u-livet-domain-reference-cleanup.design.md)

## 현재 기준 주소

- 운영: `https://u-livet.org`
- 스테이징: `https://staging.u-livet.org` (`preview` 브랜치, Vercel Deployment Protection 유지)
- `u-live.org`와 `www.u-live.org`는 운영 주소로 직접 308 이동한다. `staging.u-live.org` 및 `staging.uc-life.org`는 새 스테이징 주소로 직접 이동한다. 이전 도메인 소유는 기존 링크를 위해 유지한다.

## 변경 사항

- 정적 robots 사이트맵과 소셜 로그인 운영 안내를 새 주소로 갱신했다.
- Vercel에 새 스테이징 브랜치 도메인을 연결하고 Preview의 `AUTH_SITE_ORIGIN`·`CERTIFICATE_VERIFY_ORIGIN`을 새 주소로 갱신했다. `preview` 브랜치 전용 값과 일반 Preview 값 모두 수정했다.
- Supabase Preview Auth Site URL을 새 주소로 바꾸고 비밀번호 재설정·초대 수락·OAuth callback 허용 URL을 추가했다. 전환 중인 세션을 위해 이전 허용 URL은 보존한다.
- Google Cloud Staging OAuth 웹 클라이언트에 새 스테이징 JavaScript origin을 추가했다. Supabase OAuth callback URI는 그대로다. Google 앱 브랜딩의 홈페이지·개인정보처리방침·약관 링크를 새 운영 주소로 바꾸고 `u-livet.org`를 허용 도메인에 추가했다. 브랜드 재검증 후 공개 상태를 확인했다.

## 확인 사항

배포 후 새 스테이징의 HTTPS·보호 상태, 이전 스테이징 주소의 경로·쿼리 보존, 새 스테이징 Google OAuth 시작 요청, 운영 robots·사이트맵 응답을 확인한다. 실제 사용자 Google 로그인 완료는 사용자 계정의 인증 절차가 필요하다.
