# 검토용 Vercel Preview 배포 계획

2026-09-19 · 사용자 요청: 최근 개발 기능의 Vercel Preview 배포와 git push. 추가 선택: 별도 인증 서버 확정 전 검토용 Preview 먼저 배포.

최근 소스·migration·운영 문서를 검토해 `preview` Git 브랜치로 커밋·푸시하고 기존 Vercel uc-life 프로젝트의 Preview 환경에 배포한다. 운영 main 브랜치·배포·DB는 유지한다. Supabase Preview `bfqwntulxabfrimcypvx`를 공개 읽기 용도로만 연결한다.

검토용 배포는 홈페이지·공개 과정·안내 화면을 제공하고 회원가입·로그인·업무 저장을 차단한다. 비밀번호·MFA 정책을 완화하거나 미검증 인증 migration을 Cloud에 적용하지 않는다. 화면에 이용 범위를 안내하며 실제 업무 인수 완료로 표시하지 않는다.

완료 기준: 비밀/임시 자료 제외한 Git push 성공, Preview READY, 실제 HTTP·DB 상태·쓰기 차단 확인, 기존 운영 배포 불변 확인, URL/commit/한계 보고. Vercel 기존 배포 보호는 유지한다.
