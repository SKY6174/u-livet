# Preview staging 도메인 전환 결과

2026-09-27 · 기준 URL: `https://staging.u-live.org`

- Vercel `u-live` 프로젝트의 `preview` 브랜치에 새 도메인을 연결하고 배포 `dpl_F3PGwE9H5uH7SjiiQNDxAZpru4qp`를 READY로 확인했다. 기존 `staging.uc-life.org`는 새 주소로 301 이동한다.
- Preview 브랜치의 `AUTH_SITE_ORIGIN`, `CERTIFICATE_VERIFY_ORIGIN`을 새 origin으로 변경했다. 운영 환경변수는 변경하지 않았다.
- Preview Supabase의 Site URL을 새 origin으로 변경하고 `/auth/callback**`, `/auth/reset-password`, `/auth/accept-invitation`을 허용했다. 이전 staging 복귀 주소 세 개는 허용 목록에서 제거했다. Supabase OAuth 제공자 callback은 유지했다.
- Google Cloud Staging 웹 클라이언트의 JavaScript origin을 `https://staging.u-live.org`로 변경하고 이전 origin은 제거했다. Google Auth Platform은 기존 `uc-life.org` 승인 도메인이 아직 클라이언트 URI에서 사용 중이라고 표시해 승인 도메인 등록만 유지했다.
- `https://staging.u-live.org/courses`에서 16개 과정이 보였다. Google 로그인 버튼으로 계정 선택 화면까지 이동했고 OAuth 요청의 `redirect_to`가 새 도메인의 `/auth/callback`을 가리키는 것을 확인했다. 실제 계정 선택과 로그인 완료는 수행하지 않았다.
- `staging.uc-life.org/courses?x=1`은 `staging.u-live.org/courses?x=1`로 301 응답했으며, 새 도메인의 배포 보호는 유지됐다.
