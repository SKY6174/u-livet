# u-livet.org 운영 도메인 전환 계획

2026-09-30 · Dynamic · 상태: 진행 중

## 목표

- `https://u-livet.org`를 운영 사이트의 공식 URL, canonical, 인증·증명서 링크 기준으로 사용한다.
- `u-live.org`와 기존 주소를 계속 연결하고 기존 링크와 인증 흐름을 보존한다.
- Vercel, Supabase, Resend 및 Google·Kakao·Naver 콘솔의 도메인 설정을 일치시킨다.
- GitHub PR을 검증·병합하고 운영 배포에서 결과를 확인한다.

## 범위와 순서

1. 새 도메인의 소유권, DNS, TLS, Vercel 연결 상태를 확인한다. 현재 두 호스트는 nameserver 전파 대기이며 apex가 `www`로 이동하도록 설정돼 있다.
2. 운영과 Preview의 환경 변수를 구분하여 새 공식 URL을 적용한다. Preview 자체의 사이트 URL과 Supabase 프로젝트는 유지한다.
3. Supabase 운영 Site URL과 필요한 Redirect URL을 갱신하고 기존 허용 URL을 전환 기간 보존한다.
4. 제공자 로그인 callback은 Supabase URL을 유지하며 각 제공자의 서비스 URL, 홈페이지, 웹 origin 및 Naver userinfo URL을 확인·갱신한다.
5. Resend 발신 도메인을 검증한 뒤 SMTP 발신 주소를 변경한다. 검증 전에는 기존 발신 주소를 유지한다.
6. 소스와 현재 운영 문서의 URL을 정리하고 로그인 시작, 복구 링크, 이전 도메인 이동, canonical을 검증한다.

## 성공 기준

- 새 apex의 DNS/TLS가 정상이고 홈페이지·`/api/version`·인증 화면이 응답한다.
- 로그인 3종의 인가 URL이 새 앱 복귀 URL을 사용하며 기존 사용자의 경로도 동작한다.
- 새 메일 발신 도메인이 Verified이고 Supabase에서 인증 메일을 보낼 수 있다.
- `u-live.org`가 사용 가능하며 새 공식 URL로의 정책이 사용자 결정과 일치한다.
- PR 검사 통과, main 병합, 운영 배포 READY와 버전 일치를 확인한다.

## 위험과 대응

- DNS 전파 중 전환 시 접속/메일이 실패할 수 있으므로 새 호스트와 발신 도메인 검증 후 기준 URL을 바꾼다.
- OAuth 제공자 승인/재검증이 지연될 수 있어 기존 callback과 URL을 보존한다.
- 운영 메일 발신 키의 허용 도메인이 다를 수 있으므로 비밀값을 노출하지 않고 제한만 확인한다.

## 참고

- [이전 도메인 전환 설계](../../02-design/features/u-live-domain-transition.design.md)
- [운영 전환 기록](../../operations/u-live-domain-transition.md)
