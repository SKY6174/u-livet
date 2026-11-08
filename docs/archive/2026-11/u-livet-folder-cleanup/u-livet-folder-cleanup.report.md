# U-LiVET 로컬 폴더 정리 결과

2026-11-08 · [계획](u-livet-folder-cleanup.plan.md) · [설계](u-livet-folder-cleanup.design.md) · [검증](u-livet-folder-cleanup.analysis.md)

## 변경 결과

프로젝트 진입점은 `~/Documents/u-livet` 하나다. 진행 중인 PR 두 개는 `.local/worktrees`, 백업과 완료 작업은 `.local/backups`에서 관리한다. Finder의 숨김 폴더는 `⌘⇧.`으로 확인한다.

완료된 워크트리 17개와 누락된 임시 워크트리 등록 2개를 정리했다. 열린 PR #204·#205는 병합하지 않고 기존 HEAD와 작업 상태를 유지했다.

기존 기본 checkout은 로컬 변경과 미반영 커밋이 있었으므로, 먼저 일반 파일 34,791개를 포함하는 압축본 18개를 검증하고 전체 Git bundle을 저장했다. 기존 main은 `archive/legacy-main-20261108`에, 미커밋 변경은 `refs/archive/folder-cleanup-20261108/main-worktree`에 보존했다. 이후 기본 checkout을 원격 main 기준으로 갱신했다.

이전 `u-live`, `uc-life`, `uc-life 2` 링크는 백업의 `legacy-links`로 옮겼다. 해당 링크는 현재 프로젝트 루트를 가리키며, 원래 링크 대상은 manifest에 기록했다. 기존 백업 3묶음과 나머지 검증 자료도 함께 보관했다.

## 검증과 복구

- 로컬 구조 검증 8/8, 배포 준비 검사 111개, 운영 도메인 회귀 검사 15개 통과.
- 압축본의 파일별 SHA-256, 압축본 자체 해시 및 bundle 이력 검증 통과.
- `.local/`을 Git에서 제외하고 백업 경로 접근 권한을 제한했다.
- Docker 컨테이너 34개에 이동 대상 마운트가 없음을 확인했다.

복구 경로는 `.local/backups/folder-cleanup-20261108`이다. `manifest.json`으로 원래 경로·HEAD·압축본을 찾고, bundle을 별도 위치에 clone한 뒤 해당 HEAD와 압축본을 복원한다. 백업에는 환경 파일과 데이터가 있으므로 비공개로 유지한다. 상세 운영 규칙은 [로컬 실행 기준](../../../operations/u-livet-local-projects.md)을 따른다.

## 릴리스 완료와 보관

2026-11-09에 [PR #209](https://github.com/SKY6174/u-livet/pull/209)를 UC1973 승인과 필수 CI 통과 후 병합했다. 운영 배포는 `967e01f3c324dbbbd173d56f1434a72d237066e9` 커밋으로 `READY` 상태이며, [운영 사이트](https://u-livet.org)의 홈·로그인·버전 API가 모두 HTTP 200을 반환하고 revision도 일치했다. 당시 배포 후 error·fatal 로그 조회 결과는 0건이었다.

계획·설계·분석·결과 문서와 원래 완료 시각·단계 이력·파일 해시는 2026-11-09에 이 폴더로 보관했다. 최종 PR·병합·배포 검증값은 백업의 `release-verification.json`과 [보관 상태 기록](u-livet-folder-cleanup.status.json)에 있다.
