# u-livet.org 잔여 주소 정리 — Plan

2026-10-07 · u-livet-domain-reference-cleanup

## 목적

공식 주소는 `https://u-livet.org`인데 운영 `robots.txt`가 여전히 `u-live.org` 사이트맵을 안내하고 Preview는 `staging.u-live.org`에 연결돼 있다. 실제 사용되는 주소를 새 도메인으로 통일한다.

## 범위와 완료 기준

- 운영 robots의 사이트맵 URL을 새 공식 주소로 바꾸고 배포 응답에서 확인한다.
- `staging.u-livet.org`를 Preview 브랜치에 연결하고 Preview 인증 origin·증명서 확인 origin, Supabase 허용 복귀 URL, Google 웹 클라이언트 origin을 일치시킨다. 스테이징의 실제 Google 로그인 시작 요청을 검증한다.
- 이전 `u-live.org`, `www.u-live.org`, `staging.u-live.org` 링크는 경로·쿼리를 보존해 각각 새 운영·스테이징 주소로 직접 이동시킨다.
- 현재 운영에 쓰이는 안내 문서는 새 주소로 갱신한다. 전환 당시의 설계·보고·로그는 역사 기록으로 보존한다.
- PR 빌드 검사, 병합, push, 운영 및 Preview 배포 상태와 HTTP 응답을 확인한다.

## 위험과 대응

- 새 Preview 주소의 TLS/배포 보호가 준비되기 전에 기존 도메인을 이동시키면 접근이 끊긴다. 새 주소의 연결·인증 설정·접속을 먼저 검증한다.
- Google/Supabase 복귀 허용 URL이 빠지면 로그인이 실패한다. 새 URL을 먼저 추가하고 실제 인증 시작 요청을 점검한 뒤 기존 주소를 redirect한다.
- 기존 북마크와 검색 유입을 보호하기 위해 옛 도메인 소유와 direct redirect는 유지한다.
