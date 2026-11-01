# U-LiVET 실행 이름 통일 결과

2026-11-02 · [계획](../../01-plan/features/u-livet-naming.plan.md) · [설계](../../02-design/features/u-livet-naming.design.md) · [검증](../../03-analysis/u-livet-naming.analysis.md)

## 변경 결과

패키지, 버전 API, 기본/이슈 로컬 DB 설정, 임시 파일과 검증 도구의 이름을 `u-livet`으로 통일했다. favicon 파일과 참조 경로, 문서 복귀용 내부 헤더도 새 이름을 사용한다. Vercel 프로젝트 이름과 로컬 연결 metadata를 갱신했다.

Docker Desktop의 두 그룹은 `u-livet-core`, `u-livet-issues`로 이전했다. 컨테이너 설정과 이미지 파일 변경, 네트워크 별칭, 포트, 파일 소유권을 보존했다. DB와 Storage는 새 이름의 볼륨으로 복사했고 두 DB의 전체 logical dump가 이전과 일치한다. 기존 실행 여부를 유지했으며 이전 이름의 컨테이너는 제거했다.

현재 실행 기준은 [로컬 운영 안내](../../operations/u-livet-local-projects.md)에 기록했다. 기존 checkout에 있던 미커밋 변경은 별도 worktree를 사용해 보호했다. 기본 checkout에는 로컬 실행에 필요한 Supabase project ID와 Vercel 연결 이름만 동기화했다.

이전 작업 폴더도 `/Users/thomas/Documents/u-livet-worktrees`로 이동하고 13개 Git worktree의 등록 경로를 수정했다. 모든 worktree의 변경 상태를 전후 비교했으며, 기존 경로는 호환 심볼릭 링크로 유지한다.

## 확인 결과

린트, 타입 검사, production build, 배포 준비 검사 111개, 매뉴얼 5개 버전 검사, 변경한 JavaScript 문법 검사와 로컬 HTTP 확인을 통과했다. 이전부터 mock 의존성이 누락된 검증 스크립트 4개의 실패는 변경 전 소스로 재현해 구분했다.

Git 외부의 `/Users/thomas/Documents/u-livet-backups/naming-20261102-v2`에 private inspect/SQL 백업을 저장했다. 원본 데이터 볼륨과 snapshot 이미지도 복구용으로 보존했다. 이 파일은 저장소에 추가하지 않는다.

## 배포 확인 절차

검증한 브랜치를 push하고 PR 검사 후 병합한다. Vercel 운영 배포가 READY가 되면 `https://u-livet.org/api/version`의 `application=u-livet`과 병합 SHA를 확인한다. 운영 홈페이지, 인증 화면 및 새 favicon 응답도 확인하며 최종 PR·배포 결과는 작업 완료 응답에 남긴다.
