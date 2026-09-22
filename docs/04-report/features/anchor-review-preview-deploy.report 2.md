# 검토용 Preview 배포 결과

2026-09-19 · [분석](../../03-analysis/anchor-review-preview-deploy.analysis.md) · [운영 가이드](../../operations/review-preview.md)

최근 개발 소스를 `preview` 브랜치로 push하고 Vercel Preview에 배포했다. 사용자가 승인한 범위에 따라 공개 화면·과정 조회를 제공하고 회원가입·로그인·업무 저장은 차단했다.

## 검증된 배포

- 브랜치 주소: https://uc-life-git-preview-ucsky6174.vercel.app
- 검증한 소스: `86261dc350a56912b42b9cc4c7997af0d9a958cf`
- 고정 배포: https://uc-life-pblkp5wsq-ucsky6174.vercel.app
- 배포 ID: `dpl_BLG7seiXeJfx9xUbxgpYiecvdJBU`, Ready
- 연결 DB: ANCHOR/uc-life의 기존 Preview `bfqwntulxabfrimcypvx`
- Vercel 보호 유지: 프로젝트 접근 권한이 있는 계정 로그인 필요

환경변수는 Vercel Preview의 `preview` Git 브랜치에만 적용했다. GitHub 연동으로 불필요한 Supabase 유료 브랜치가 만들어지지 않도록 PR은 만들지 않았다. 기존 main·운영 배포·원격 DB schema는 변경하지 않았다.

## 결과와 한계

홈페이지·과정·인증 화면 200, DB health 200 healthy, 로그인·가입·복구 버튼 비활성화, POST/DELETE 403, 보호 업무 페이지 307, 증명서 다운로드 401을 확인했다. 응답의 검색 색인 금지와 no-store도 확인했다.

공개 과정 데이터가 없어 정상적인 빈 목록을 표시한다. 로그인 후 LMS·행정 업무는 이 배포에서 사용할 수 없다. 브라우저 상호작용 검증은 Vercel 계정 로그인 전까지 수행하지 않았으며, 응답 검증은 인증된 CLI로 진행했다.

설정·회귀 검사 251개, lint, 깨끗한 Node 24 설치/빌드 및 실제 Vercel 빌드가 통과했다. 최초 실패의 자동 환경변수 호환 문제는 명시적 허용 목록으로 수정했다.

문서만 추가되는 후속 Git 커밋은 위 소스와 같은 앱 구현을 포함한다. 후속 배포의 최신 SHA/Ready 상태와 health·쓰기 차단을 별도로 확인한 뒤 사용자에게 전달한다.

다음 단계는 별도 인증 서버 주소·구성을 연결하고 전체 인증 및 역할별 업무를 인수하는 것이다.
