# u-live.org 도메인 전환 계획

2026-09-27 · 대상: 운영 사이트, 인증, 메일, 소셜 로그인, GitHub 저장소

## 목표

- `https://u-live.org`를 운영 사이트의 기준 주소로 사용한다.
- `uc-life.org`와 `www.uc-life.org`는 새 주소로 경로와 쿼리를 보존해 이동한다.
- 가입, 로그인, 초대, 비밀번호 재설정, 증명서 검증, 메일 발송을 새 주소에서 확인한다.
- GitHub 저장소 `SKY6174/u-live`에 맞춰 로컬 원격과 배포 연결을 확인한다.

## 확인된 현재 상태

- GitHub 저장소는 이미 `SKY6174/u-live`로 이름이 변경됐다. 로컬 `origin`은 이전 주소였다.
- Vercel의 운영 앱 프로젝트는 `uc-life`이고 `uc-life.org`, `www.uc-life.org`, `staging.uc-life.org`가 연결돼 있다.
- `u-live.org`는 별도 Vercel 프로젝트 `u-live-org-redirect`에 연결돼 있으며 현재 `uc-life.org`로 307 이동한다.
- 운영 Supabase 프로젝트 ref는 `uoebygejgglgiivzgyks`, Preview ref는 `bfqwntulxabfrimcypvx`다.
- 현재 제품 소스와 `vercel.json`에는 `uc-life.org` 문자열이 없다. 운영 설정과 문서에는 이전 주소가 있다.
- 작업 디렉터리에 많은 기존 미커밋 변경이 있다. 도메인 전환과 무관한 변경은 보존한다.

## 범위와 순서

1. 새 도메인의 DNS 및 Vercel 프로젝트 연결을 확인한다.
2. Resend 발신 도메인과 Supabase Auth의 새 URL 허용 목록을 준비한다. 기존 URL은 전환 기간에 유지한다.
3. Google, Naver, Kakao의 실제 OAuth callback 구조를 확인하고 필요한 새 주소를 등록한다.
4. Vercel 환경변수, Supabase Site URL, 메일 발신 주소를 새 기준으로 변경한다.
5. 운영 앱 프로젝트로 새 도메인을 이동하고, 이전 도메인의 308 redirect를 설정한다.
6. 새 주소에서 공개 페이지, 인증 및 메일 흐름을 검증한다. 실제 이용자 계정 변경은 하지 않는다.

## 완료 기준

- `u-live.org/api/version`과 `/api/health`가 운영 앱을 직접 응답한다.
- 옛 주소가 경로와 쿼리를 보존해 새 주소로 이동하며 순환하지 않는다.
- 새 주소의 인증 redirect, canonical, 초대/복구 링크, 증명서 검증 origin이 일치한다.
- 세 가지 소셜 로그인의 새 주소 복귀와 Resend 발송이 확인된다.
- GitHub/Vercel 연결이 새 저장소 주소를 인식한다.

## 위험과 대응

- DNS 또는 Vercel 프로젝트 이동 중 잠깐의 접속 중단 가능성: 기존 주소를 유지하고 새 설정을 먼저 준비한다.
- OAuth 허용 목록 누락: 제공자별 실제 callback을 확인해 추가하고 신구 주소를 병행한다.
- 새 발신 도메인 미인증: Resend 인증 완료 전 발신 주소를 전환하지 않는다.
- 기존 작업 디렉터리의 변경과 충돌: 범위를 제한하고 기존 변경을 덮어쓰지 않는다.

## 참고

- [공유 대화](https://chatgpt.com/share/6ab8d959-9adc-83ee-a8d8-821b061de606)
- [기존 도메인 및 인증 메일 설계](../../02-design/features/anchor-primary-domain-mail.design.md)
