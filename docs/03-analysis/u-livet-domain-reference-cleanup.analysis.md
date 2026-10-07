# u-livet.org 잔여 주소 정리 — Gap Analysis

2026-10-07 · [설계](../02-design/features/u-livet-domain-reference-cleanup.design.md)

## 일치율: 100% (설계 항목 8/8)

1. `robots.txt`와 현재 소셜 로그인 안내가 새 주소를 사용한다.
2. `staging.u-livet.org`가 `preview` 브랜치의 Ready 배포를 가리키며 기존 Vercel 배포 보호가 유지된다.
3. Preview의 브랜치 전용 및 일반 `AUTH_SITE_ORIGIN`·`CERTIFICATE_VERIFY_ORIGIN`이 새 주소를 사용한다.
4. Supabase Preview의 Site URL과 복귀 허용 URL, Google Staging OAuth의 JavaScript origin과 브랜딩 주소를 갱신했다.
5. 제공자 callback은 Supabase 주소로 유지했다.
6. 두 옛 스테이징 주소와 두 옛 운영 주소의 경로·쿼리 보존 이동을 HTTP 응답으로 확인했다.
7. Google OAuth 시작 요청은 새 `redirect_to`를 수락하고 Google 인증 페이지로 이동한다.
8. 빌드와 PR 검사 통과, 병합, 운영 및 스테이징 Ready 배포, 운영 robots·사이트맵을 확인했다.

실제 사용자 로그인 완료는 계정 인증을 요구하므로 자동 HTTP 검증 범위 밖이다. 역사적 도메인 전환 문서와 이전 주소의 직접 이동 설정은 기존 링크를 위해 유지한다.
