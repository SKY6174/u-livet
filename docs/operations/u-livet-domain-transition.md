# u-livet.org 운영 도메인 전환

2026-09-30 · [계획](../01-plan/features/u-livet-domain-transition.plan.md) · [설계](../02-design/features/u-livet-domain-transition.design.md)

## 공식 주소와 기존 주소

- 공식 운영 주소는 `https://u-livet.org`다. Vercel 프로젝트 `u-live`에서 apex가 Production이고 `www.u-livet.org`는 apex로 308 이동한다. 두 주소 모두 Vercel에서 Valid Configuration으로 확인했다.
- `u-live.org`와 `www.u-live.org`는 경로·쿼리를 유지하며 `https://u-livet.org`로 308 이동한다. 기존 `uc-life.org`와 `www.uc-life.org`는 같은 목적지로 301, `uc-life.vercel.app`은 308 이동한다. Vercel의 연쇄 이동 제한 때문에 각 주소의 목적지를 공식 주소로 직접 지정했다.
- `staging.u-live.org`와 `staging.uc-life.org`의 Preview 동작은 유지한다.
- 공용 DNS의 Vercel nameserver, 새 도메인의 A 레코드, TLS 및 `/api/version` HTTP 200을 확인했다. 이 컴퓨터의 기본 DNS 캐시가 한동안 새 도메인을 해석하지 못해 `curl --resolve`와 공용 DNS 서버로 별도 확인했다.

## 인증과 메일

- Vercel Production의 `AUTH_SITE_ORIGIN`, `CERTIFICATE_VERIFY_ORIGIN`, `RELEASE_PRODUCTION_SITE_ORIGIN`을 `https://u-livet.org`로 저장했다. Preview의 `RELEASE_PRODUCTION_SITE_ORIGIN` 전체 및 기존 브랜치별 재정의도 새 운영 주소로 저장했고, Preview 자체의 인증 origin은 변경하지 않았다. 환경 변수 변경은 새 배포부터 적용된다.
- Supabase 운영 프로젝트 `uoebygejgglgiivzgyks`의 Site URL은 `https://u-livet.org`이며 새 `/auth/login`, `/auth/reset-password`, `/auth/callback**`, `/auth/complete-signup**`를 Redirect URLs에 추가했다. 기존 허용 항목은 이전 링크를 위해 보존했다.
- 네이버 custom OAuth provider의 userinfo URL은 `https://u-livet.org/api/auth/naver/userinfo`로 변경했다. Studio 저장 양식이 기존 OAuth2 설정에도 빈 Issuer URL을 요구하여, 공식 Auth admin API에 `userinfo_url` 필드만 PUT하고 GET으로 재조회했다. 외부 제공자 callback은 계속 Supabase의 `/auth/v1/callback`이다.
- Resend에 `u-livet.org`를 Tokyo 리전 발신 도메인으로 등록했다. Vercel DNS의 DKIM TXT, `send` SPF TXT 및 MX를 공용 DNS에서 확인했고 Resend가 도메인과 세 레코드를 Verified로 표시한다. 운영 SMTP 키의 허용 도메인은 새 도메인으로 제한했고, Supabase SMTP 발신 주소를 `noreply@u-livet.org`로 저장했다. 비밀값은 변경하거나 문서화하지 않았다.

## 소셜 로그인

- Google 운영 OAuth 클라이언트의 JavaScript origin에 `https://u-livet.org`를 추가하고 기존 origin을 유지했다. 브랜딩의 홈과 개인정보처리방침 URL, Authorized domain을 새 주소로 변경했다. Search Console에서 새 도메인의 DNS 소유권을 확인하고 사이트맵을 제출했다. 소유권 확인 뒤 브랜딩 재검증이 통과했고 `Publish branding`을 실행했다. Google 화면에서 검증된 브랜딩이 사용자에게 표시 중임을 확인했다.
- 네이버 운영 앱의 서비스 URL과 연결 해제 callback을 새 주소로 저장했다. 로그인 callback은 Supabase 주소로 유지한다.
- 카카오 운영 앱의 대표 도메인을 `https://u-livet.org`로 저장했다. REST API 로그인 리다이렉트 URI는 Supabase callback과 일치해 유지한다.

## 배포 후 확인

- PR #113 병합 커밋 `0fcf0d6bc7d3331ac77823fa5f0926de56503730`의 운영 배포가 Ready인 것을 확인했다. 새 주소의 `/api/version`은 같은 revision과 production 환경을 반환했고 홈, 로그인, 건강 상태, 개인정보처리방침은 HTTP 200이었다. 사이트맵과 canonical은 새 공식 주소를 사용한다.
- Google, Kakao, Naver의 Supabase OAuth 시작 요청은 각 제공자의 인증 페이지로 302 이동했다. 새 도메인의 Naver userinfo 경로는 토큰이 없는 요청에 예상대로 401을 반환했다.
- 실제 사용자 로그인 완료와 수신함 도착 및 Resend 발송 로그는 승인된 테스트 계정과 수신 주소가 준비되면 확인한다.
