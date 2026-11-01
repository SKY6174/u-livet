# U-LiVET 실행 이름과 경로 통일

2026-11-01 · 사용자 요청: `uc-life` 관련 용어와 경로를 `u-livet`으로 통일하고 PR, push, merge, 배포까지 진행한다.

## 목표와 범위

- 패키지, 버전 API, 로컬 Supabase 프로젝트, 검증 스크립트와 임시 파일 이름을 `u-livet` 기준으로 맞춘다.
- Docker Desktop의 `uc-life-core`, `uc-life-issues` 그룹을 각각 `u-livet-core`, `u-livet-issues`로 옮긴다.
- 실제 소스와 배포 경로는 `/Users/thomas/Documents/u-livet` 및 GitHub `SKY6174/u-livet`을 기준으로 한다.
- Vercel 프로젝트의 이전 이름도 새 이름으로 맞추고 운영 `https://u-livet.org`에 병합한 커밋을 배포한다.
- 기존 미커밋 변경은 별도 worktree를 사용해 보존한다. 다른 서비스 `uc-anchor`는 이번 변경 대상이 아니다.

## 완료 기준

1. 현재 실행 코드와 설정에 이전 프로젝트 식별자가 남지 않는다.
2. 로컬 DB 및 파일 볼륨을 보존하고 이전/이후 데이터 검증값이 일치한다.
3. 새 Docker 그룹과 로컬 포트가 정상이며 기존에 정지한 서비스는 상태를 보존한다.
4. 구 인증 factor 이름, 구 웹 주소 redirect, 발행된 매뉴얼과 과거 migration/증거 문서는 호환성과 이력을 보존한다.
5. 린트·타입 검사·관련 회귀 검증을 통과하고 운영 버전 API가 `u-livet` 및 병합 커밋을 반환한다.
