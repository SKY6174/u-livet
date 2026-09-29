# u-live.org 운영 도메인 전환 현황

기준일: 2026-09-27. [계획](../01-plan/features/u-live-domain-transition.plan.md) · [설계](../02-design/features/u-live-domain-transition.design.md)

## 실제 구성

| 항목 | 현재 확인값 | 전환 목표 |
| --- | --- | --- |
| GitHub | `SKY6174/u-live`로 이름 변경, Vercel Git 연결 갱신 | 새 커밋 자동 배포 확인 |
| Vercel 운영 앱 | project ID `prj_h5sjV2a5VUNpxFMEa1dPYwoFMAz0`, 프로젝트 표시명 `u-live`, 새 운영 배포 준비 완료 | 실제 계정으로 인증 흐름 확인 |
| Vercel 새 도메인 | `u-live.org`를 운영 앱에 연결, `www.u-live.org`는 apex로 308 이동 | HTTPS·인증 흐름 검증 |
| Vercel 기존 도메인 | `uc-life.org`, `www.uc-life.org`는 301, `uc-life.vercel.app`은 308로 `u-live.org` 이동 | 기존 링크 유입 점검 |
| Supabase 운영 | `uoebygejgglgiivzgyks`, Site URL `https://u-live.org` | 실제 로그인·메일 확인 |
| Supabase Preview | `bfqwntulxabfrimcypvx`, 사이트 `https://staging.uc-life.org` | 이번 운영 전환에서는 유지 |
| Resend | `u-live.org` Verified, Supabase 발신 주소 `noreply@u-live.org` | 실제 수신 확인 |

## 준비 완료

- 로컬 Git origin을 `https://github.com/SKY6174/u-live.git`로 변경했다.
- 운영 Supabase Auth Redirect URLs에 기존 항목을 유지하며 새 로그인, 비밀번호 재설정, OAuth callback, 가입 완료 URL을 추가했다.
- Resend에 `u-live.org`를 도쿄 리전으로 등록했고 Vercel DNS에 `resend._domainkey` TXT, `send` MX, `send` SPF TXT를 등록했다. 공개 DNS 조회에서 세 레코드가 응답하며 Resend Dashboard에서 Verified 상태를 확인했다.
- Vercel 운영 프로젝트의 Git 연결을 `SKY6174/u-live`로 갱신했다. 연결된 GitHub 저장소 ID는 기존과 동일하다.
- Vercel의 운영 `AUTH_SITE_ORIGIN`, `CERTIFICATE_VERIFY_ORIGIN`, `RELEASE_PRODUCTION_SITE_ORIGIN`과 Preview `RELEASE_PRODUCTION_SITE_ORIGIN`을 `https://u-live.org`로 갱신했다. 새 배포부터 적용된다.
- 카카오 운영 앱의 대표 도메인이 이미 `https://u-live.org`로 지정되어 있고, REST API 로그인 URI는 Supabase callback으로 유지된 것을 확인했다.
- `u-live.org`를 Vercel 운영 앱으로 옮기고 `/api/version`의 HTTP 200 응답을 확인했다. `www.u-live.org`는 apex로 308 이동한다.
- Supabase Site URL이 이미 `https://u-live.org`로 변경된 것을 확인했다. Resend SMTP 발신 주소와 발신 이름을 새 브랜드로 저장했다.
- Naver 운영 앱의 표시명, 서비스 URL, 연결 끊기 callback 도메인을 새 이름으로 저장했다. 로그인 callback은 Supabase 주소로 유지했다.
- Supabase Naver custom OAuth의 userinfo URL을 Admin API로 새 도메인 주소에 변경하고 재조회했다.
- 새 Vercel Production 배포 후 `/api/version`, `/api/health`, `/auth/login`, `/privacy`의 HTTP 200을 확인했다. Google/Kakao/Naver의 Supabase OAuth 시작 URL은 새 도메인 callback으로 302 이동한다.
- 기존 세 호스트는 경로와 쿼리를 보존하며 새 도메인으로 이동한다. 옛 커스텀 도메인 두 개는 Search Console 주소 변경 요건에 맞춰 HTTP 301로 설정했고, 옛 `vercel.app` 호스트는 308을 유지했다.
- Google 운영 OAuth 클라이언트의 Authorized JavaScript origins에 `https://u-live.org`를 추가하고 기존 `https://uc-life.org`를 유지했다. Authorized redirect URI는 Supabase callback `https://uoebygejgglgiivzgyks.supabase.co/auth/v1/callback` 그대로다.
- Google 동의 화면의 홈페이지와 개인정보처리방침 URL을 새 도메인으로 저장했다. 새 브랜드 재검증 후 콘솔에 "Your branding has been verified and is being shown to users"가 표시됐다.
- Google Search Console에 `u-live.org` 도메인 속성을 추가하고 DNS TXT 레코드로 소유권을 검증했다. 검증 레코드는 유지한다.
- 기존 `uc-life.org` 속성의 주소 변경 도구에서 `u-live.org`를 선택했다. 두 속성의 소유권 검사는 통과했으나, 301 검사에서 `http://uc-life.org/`를 "Couldn't fetch the page"라고 표시해 알림을 접수하지 못했다. 직접 HTTP 요청으로는 옛 HTTP 주소가 HTTPS로 308 이동하고, 옛 HTTPS 주소가 새 도메인으로 301 이동하는 것을 확인했다.
- 더 이상 커스텀 도메인을 사용하지 않는 Vercel `u-live-org-redirect` 프로젝트의 Git 연결을 해제했다. 이 프로젝트의 이전 Preview 빌드는 운영 앱용 환경 변수가 없어 실패했지만, 운영 앱 `u-live`의 Preview 빌드는 통과했다.

## 남은 설정 및 전환 순서

1. Search Console 주소 변경 도구의 301 검사를 이후 다시 시도한다. 검사가 계속 실패하면 `http://uc-life.org/`의 Googlebot 실시간 URL 검사를 하고 Google 지원 문서를 따른다. 이전 도메인 제거는 기존 링크 사용 현황을 확인한 뒤 별도로 진행한다.
2. 소셜 로그인 3종, 가입·초대·비밀번호 복구 메일, 증명서 검증 주소를 실제 계정으로 확인한다. 전환 기간에는 Supabase의 기존 Redirect URLs와 Google의 이전 origin을 유지한다.
3. Naver 연결 끊기 callback은 현재 앱의 `/auth/callback`이 연결 해제 알림을 처리하지 않으므로 별도 엔드포인트 설계가 필요하다.

## 2026-09-29 인증 메일 미발송 점검

- 운영 Supabase Auth 로그에서 04:24:36, 04:25:04 UTC의 `/signup` 요청 두 건이 HTTP 500으로 끝났다. DB의 `public.handle_new_user()`가 `MEMBER_ACTIVATION_UNAVAILABLE`을 반환해 SMTP 호출 전에 가입이 중단됐다. 각 요청의 수신 주소와 선택한 가입 유형은 로그만으로 확인하지 못했다.
- 운영 명부에는 활성 사업단 구성원 9명이 있으나, 점검 시점에 이들과 연결된 Auth 계정 또는 활성화 claim은 없었다. 명부 등록 자체는 Auth 계정 생성이나 인증 메일 발송을 하지 않는다. 가입하려는 사람은 명부에 등록된 이메일로 사업단 구성원 유형의 ‘등록된 구성원 계정 활성화’를 진행해야 한다.
- 같은 날 `/recover` 요청의 HTTP 200은 메일 발송 증거가 아니다. 계정 존재 여부를 노출하지 않도록 미가입 주소에도 동일한 응답을 보낸다. 활성화 전 구성원에게는 복구 대신 계정 활성화 흐름을 안내한다.
- 운영 Supabase의 SMTP 발신 주소는 `noreply@u-live.org`이고 Resend의 `u-live.org` 도메인은 Verified였다. 이름이 `UC-LIFE Supabase SMTP Production`이던 Resend 키의 허용 도메인은 `uc-life.org`였다. 승인 후 해당 키의 허용 도메인을 `u-live.org`로 바꾸고 이름을 `U-LiVE Supabase SMTP Production`으로 갱신했다. 키 값과 Supabase SMTP 비밀번호는 변경하거나 문서화하지 않았다. 이 키가 운영 Supabase에서 실제 사용 중인지는 당시 확인되지 않았으므로, 도메인 제한을 미발송의 원인으로 단정한 초기 판단은 잘못됐다.
- 이후 한 사업단 구성원의 Auth 계정이 생성됐고 `email_confirmed_at`은 비어 있으며 명부 연결 claim은 대기 상태인 것을 확인했다. Resend에는 `noreply@u-live.org`에서 보낸 `[U-LiVE] 회원가입 이메일 확인`과 비밀번호 재설정 메일이 모두 `Delivered`로 기록됐다. 두 메일은 위에서 이름을 바꾼 키의 발송 목록에는 없다. 따라서 메일 서버 전달까지는 확인됐지만 수신자의 받은편지함 도착이나 링크 클릭은 확인되지 않았다.
- 해당 구성원은 가입 확인 메일의 링크로 이메일 소유권을 확인해야 기존 명부에 연결되고 로그인할 수 있다. 화면의 ‘이메일 인증 여부를 확인’ 문구는 모든 Supabase 비밀번호 로그인 오류에 공통으로 표시되지만, 이 계정은 실제로 미인증 상태다. 메일이 보이지 않으면 스팸함·기관 메일 격리함을 확인한다.

## 주의할 주소

- `https://u-live.org/auth/callback`은 앱 복귀 경로다. Google, Kakao, Naver의 운영 제공자 callback은 별도 Supabase 주소를 사용한다.
- `https://u-live.org/api/auth/naver/userinfo`는 Naver custom OAuth 설정에 쓰는 사용자 정보 URL이다. 제공자 callback으로 등록하지 않는다.
- 실제 이용자에게 발송되는 메일 템플릿과 약관/개인정보처리방침 링크도 새 주소를 확인한다.
