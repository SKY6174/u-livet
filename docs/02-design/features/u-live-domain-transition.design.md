# u-live.org 도메인 전환 설계

2026-09-27 · [계획](../../01-plan/features/u-live-domain-transition.plan.md)

## 주소와 인증 흐름

- 운영 기준 origin은 `https://u-live.org`, Preview 기준 origin은 기존 `https://staging.uc-life.org`를 우선 유지한다. Preview 도메인의 별도 변경은 운영 전환 확인 후 결정한다.
- `AUTH_SITE_ORIGIN`, `CERTIFICATE_VERIFY_ORIGIN`의 Production 값 및 양 환경의 `RELEASE_PRODUCTION_SITE_ORIGIN`은 새 운영 origin으로 맞춘다. Preview 자신의 `AUTH_SITE_ORIGIN`과 DB ref는 유지한다.
- 제품 코드는 고정 도메인 대신 `AUTH_SITE_ORIGIN`에서 OAuth `/auth/callback`, 비밀번호 `/auth/reset-password`, 회원가입 `/auth/complete-signup`, metadata base를 구성한다. 현재 소스의 해당 방식을 유지한다.
- Supabase Production Site URL은 새 origin으로 설정한다. Redirect allowlist에는 실제 사용하는 새 callback, 복구, 가입 복귀 경로를 추가하고 이전 경로는 전환 기간에 보존한다. 광범위한 `/**`는 필요한 경우에만 쓴다.
- Google/Kakao/Naver의 Supabase OAuth 제공자 callback은 운영 `https://uoebygejgglgiivzgyks.supabase.co/auth/v1/callback`, Preview `https://bfqwntulxabfrimcypvx.supabase.co/auth/v1/callback`이다. 앱의 `/auth/callback`은 Supabase가 인증 후 되돌리는 주소다. 따라서 제공자 콘솔에서 실제 등록된 callback을 확인한 후 필요한 서비스 URL, Web Domain, JavaScript origin, 개인정보 URL, Naver userinfo URL을 변경한다.

## Vercel, DNS, 메일

- 현재 `u-live.org`는 `u-live-org-redirect` 프로젝트가 소유하고 `uc-life.org`로 307 이동한다. 새 주소를 운영 `uc-life` 프로젝트에 연결할 때 프로젝트 간 도메인 이동이 필요하다. 이전 프로젝트의 redirect는 제거하거나 목적에 맞게 정리한다.
- 새 주소가 운영 앱에 연결되고 인증을 검증한 후 `uc-life.org`, `www.uc-life.org`, `uc-life.vercel.app`은 `https://u-live.org`로 308 이동시킨다. 경로/쿼리를 보존한다. `www.u-live.org`는 실제 소유 및 DNS 상태를 확인한 후 새 apex로 이동시킨다.
- Resend에 `u-live.org`를 별도 도메인으로 등록하고 제공된 SPF/DKIM/MX 레코드를 현재 DNS에 등록한다. Verified 전에는 `noreply@uc-life.org` 발신을 유지한다. Verified 이후 Supabase SMTP sender만 `noreply@u-live.org`로 바꾼다. 기존 API 키는 도메인 제한 여부를 확인하며 비밀을 저장소에 쓰지 않는다.
- Vercel 프로젝트 Git 연결이 새 `SKY6174/u-live` 저장소를 가리키는지 확인한다. 로컬 origin 및 GitHub About URL도 새 주소에 맞춘다.

## 저장소 변경

- Git 원격 URL은 `https://github.com/SKY6174/u-live.git`로 갱신한다.
- `package.json`과 lockfile의 내부 package name, `/api/version`의 application 식별자는 저장소 이름에 맞춰 `u-live`로 변경한다. 제품 소스에는 옛 도메인 하드코딩이 없어 다른 기능 코드는 변경하지 않는다.
- 운영 절차 문서에 새 도메인 기준값과 제공자별 콘솔 점검값을 기록한다. 과거 배포 기록은 당시 URL을 증거로 유지한다.
- 기존 `U-LIFE` 브랜드 문구는 별도의 브랜드 승인 없이 일괄 치환하지 않는다. 도메인과 저장소 이름 변경과 브랜드 표기 변경은 별개의 범위다.

## 검증

- `git remote -v`, GitHub API, Vercel Git 설정에서 저장소 주소를 확인한다.
- `curl -I`로 신구 도메인의 HTTP 상태, Location, 경로/쿼리 보존, 순환 여부를 확인한다.
- `/api/version`, `/api/health`, 공개 홈페이지, `auth/login`의 주소와 canonical을 확인한다.
- 제공자별 로그인과 이메일 인증·복구·초대 메일은 새 도메인의 실제 사용자 흐름으로 확인한다. 실사용자 계정 대신 승인된 테스트 계정을 사용한다.
- 기존 미커밋 변경이 많으므로 파일별 차이만 확인하고 무관한 파일은 수정하지 않는다.

## 후속 결정: Preview 도메인 전환 (2026-09-27)

- 사용자 요청에 따라 Preview 기준 origin을 `https://staging.u-live.org`로 변경한다. `staging.uc-life.org`는 경로와 쿼리를 보존하여 새 주소로 301 이동한다.
- Vercel에서 새 도메인을 `preview` 브랜치에 연결하고 해당 브랜치의 `AUTH_SITE_ORIGIN`, `CERTIFICATE_VERIFY_ORIGIN`을 새 origin으로 맞춘다. Production 설정과 Supabase 프로젝트는 변경하지 않는다.
- Preview Supabase Site URL과 복구·초대·OAuth 앱 복귀 허용 경로를 새 주소로 변경한다. Google OAuth 웹 클라이언트의 JavaScript origin도 새 주소로 변경한다. Google의 서버 redirect URI는 기존 Preview Supabase callback을 유지한다.
- 새 주소의 배포 보호를 유지하고 Google 계정 선택 화면에서 `redirect_to=https://staging.u-live.org/auth/callback...`을 확인한다. 실제 계정 선택과 로그인 완료는 별도 테스트 계정으로 확인한다.

## 후속 결정: 검색 엔진 사이트맵 (2026-09-27)

- 운영 사이트의 `/sitemap.xml`에 새 도메인의 공개 정적 페이지와 게시된 교육과정 목록의 상세 URL만 포함한다. 로그인, 개인 계정, 신청 및 검증 화면은 제외한다.
- 사이트맵 URL은 `RELEASE_PRODUCTION_SITE_ORIGIN`을 기준으로 생성하고, 공개 과정 목록을 불러오지 못해도 정적 페이지는 제공한다.
- `robots.txt`에서 사이트맵 위치를 알린다. 운영 응답과 URL 목록을 확인한 뒤 Search Console의 새 도메인 속성에 제출한다.
