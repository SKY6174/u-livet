# 검토용 Preview 설계

2026-09-19 · [계획](../../01-plan/features/anchor-review-preview-deploy.plan.md)

## 실행 경계

서버 변수 `PREVIEW_REVIEW_ONLY=true`로 명시한다. 런타임은 true이면 잠그고 빌드 검사는 Vercel preview 환경에만 허용한다. production에서 설정하면 빌드 실패한다. 기존 일반 배포 검사와 보안 조건은 유지한다.

검토용 사전 검사는 실제 Preview Supabase URL/공개키, 운영과 다른 DB ref·HTTPS 사이트, 운영 기준 ref/site, 공개 변수 허용 목록, 로컬 시험 변수 없음, 서비스 키/HMAC/CAPTCHA 설정 없음, self-hosted 설정 혼용 없음을 검사한다. 검토용 모드는 전체 운영 인수 기록을 통과할 수 없다. 형식 검사와 실제 HTTP 검증을 구분한다.

middleware에서 GET/HEAD 외 요청을 403으로 거부한다. 검토 모드에서는 사용자 세션 갱신을 하지 않는다. 서버 Supabase client는 cookie를 읽거나 쓰지 않으므로 업무 요청에는 공개 역할만 사용한다. 로그인 상태 조회는 null로 고정한다. 인증·회원 폼은 설명과 함께 제출을 비활성화하고 공통 배너를 제공한다. 검색 색인은 막는다. 이는 권한을 부여하는 데모 계정이나 관리자 우회가 아니다.

## 배포

Git `preview` 브랜치를 만들며 main에 push하지 않는다. 소스·글꼴·scripts·migration/templates·명시된 설정/문서만 스테이징한다. `.env.local`, 브라우저 프로필, output/tmp, 실제 증거/개인 자료는 제외한다. staged 비밀 패턴과 경로·의존성을 검사한다.

기존 Vercel 프로젝트 `prj_h5sjV2a5VUNpxFMEa1dPYwoFMAz0`, 팀 `team_4YIBigc2M47U1IrndTo6xlfF`의 preview 브랜치에만 공개 연결 값과 검토 변수를 등록한다. 알려진 운영 기준은 https://uc-life.vercel.app 및 uoebygejgglgiivzgyks. Preview 고정 주소는 Vercel이 실제 부여한 브랜치 alias를 확인하여 사용한다. Supabase Preview 공개키는 메모리에서만 다루고 출력하지 않는다. 인증/DB 정책이나 운영 설정은 변경하지 않는다.

## 검증

설정 검사: Preview만 허용, 운영 ref/site 재사용·서비스 키·시험 CAPTCHA·전체 release 승인 차단, 일반 배포 회귀.
소스: lint, 격리 checkout build(기존 env 파일 미포함).
원격: READY 및 SHA 일치, 홈페이지/로그인/가입 안내·보안 헤더, health DB 조회, POST 403, 보호 업무 페이지 접근 불가, 클라이언트에 Preview ref만 포함, Production 배포 ID 유지.

별도 인증 서버·로그인 후 LMS/행정 업무·실제 메일/SMS/금융·기관 운영 정책 승인은 범위 밖이다. 공개 과정이 없으면 정상적인 빈 목록을 표시하고 가짜 운영 데이터를 넣지 않는다.
