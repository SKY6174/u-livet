# u-livet.org 운영 도메인 전환 점검

2026-09-30 · [설계](../02-design/features/u-livet-domain-transition.design.md)

## 설계 일치율: 92% (12개 중 11개 확인)

- 주소 구성: 새 apex, www, 기존 도메인의 직접 이동과 경로·쿼리 보존을 확인했다.
- 인증 구성: Vercel 환경 변수, Supabase Site URL·Redirect URLs, Naver userinfo URL을 저장 후 재조회했다.
- 소셜 로그인: Google OAuth origin과 검증·게시된 브랜딩, Naver 서비스 URL, Kakao 대표 도메인을 확인했다. 세 제공자 모두 Supabase callback을 유지하고 OAuth 시작 302를 확인했다.
- 메일 구성: Resend 도메인 및 DNS Verified, SMTP 발신 주소와 API 키의 도메인 제한을 확인했다.
- 저장소·배포: 사이트맵 fallback, 운영 문서, lint·build 및 PR #113의 운영 배포를 확인했다. 새 주소의 버전·홈·로그인·건강 상태·canonical·사이트맵을 확인했다.

## 남은 확인

- 테스트 계정과 수신 주소가 없어 세 소셜 로그인 완료, 비밀번호 재설정 메일 수신 및 Resend 발송 로그는 확인하지 못했다. 실제 계정으로 재설정 요청과 로그인 완료를 점검한다.

설계와 다른 구현은 없다. 계정 기반 종단 검증은 테스트 계정 준비 후 수행한다.
