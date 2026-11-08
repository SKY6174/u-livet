# U-LiVET 실행 이름과 로컬 경로

2026-11-08 · 프로젝트의 현재 실행 기준이다. 이전 배포 기록과 SQL migration의 이름은 당시 이력을 나타낸다.

| 대상 | 현재 값 |
| --- | --- |
| 저장소 | `https://github.com/SKY6174/u-livet` |
| 기본 checkout | `/Users/thomas/Documents/u-livet` |
| 진행 중인 worktree | `/Users/thomas/Documents/u-livet/.local/worktrees` |
| 로컬 백업·완료 작업 보관 | `/Users/thomas/Documents/u-livet/.local/backups` |
| 패키지·버전 API application | `u-livet` |
| Vercel 프로젝트 | `u-livet` |
| 운영·Preview | `https://u-livet.org` · `https://staging.u-livet.org` |
| 기본 로컬 Supabase | `u-livet-core` · API 55321 · DB 55322 · Mailpit 55324 |
| 이슈 검증용 Supabase | `u-livet-issues` · API 56321 · DB 56322 · Mailpit 56324 |
| 이슈 DB workdir | `/tmp/u-livet-issues-db` |
| favicon | `/images/u-livet-favicon.png` |

기본 DB 컨테이너는 `supabase_db_u-livet-core`, 이슈 검증용은 `supabase_db_u-livet-issues`다. 로컬 스크립트도 새 이름을 사용한다. 기존 포트와 데이터는 보존한다.

기본 checkout, 백업, 진행 중인 worktree는 모두 `u-livet` 아래에 둔다. Documents의 이전 `u-live`, `uc-life`, `uc-life 2` 링크와 별도 `u-livet-backups`, `u-livet-worktrees` 항목은 정리했다. Finder에서 숨김 항목은 `⌘⇧.`으로 표시한다.

```text
~/Documents/u-livet/
  .local/
    worktrees/
      ci-cost-controls/       # 열린 PR #204
      deployment-dedup/       # 열린 PR #205
    backups/
      naming-20261102/
      naming-20261102-v2/
      worktree-cleanup-20261102-132006/
      folder-cleanup-20261108/
        repository.bundle
        manifest.json
        snapshots/
        legacy-links/
        loose-files/
```

완료된 worktree는 재생성 가능한 `node_modules`, `.next*`와 Git 메타데이터를 제외한 파일 압축본, 파일별 해시 대조, 전체 Git bundle 보관을 마친 후 제거했다. 고유 커밋의 로컬 브랜치는 유지한다. 이전 기본 checkout은 `archive/legacy-main-20261108` 브랜치와 `refs/archive/folder-cleanup-20261108/main-worktree` 변경 참조로 복구할 수 있다. 각 원래 경로·HEAD·상태·압축본 해시는 비공개 `manifest.json`에 있다.

복원할 때는 bundle을 별도 폴더에 clone하고 manifest의 HEAD를 checkout한 뒤 해당 압축본을 해제한다. 기본 checkout의 미커밋 변경은 복구용 브랜치에서 보존 참조를 `git stash apply`하여 확인한다. 원래 checkout에 바로 덮어쓰지 않는다. 보관된 이전 이름 링크는 `legacy-links`에서 프로젝트 루트를 가리킨다.

새 작업은 `.local/worktrees/<작업명>`에 만들고 `git worktree list`로 등록을 확인한다. 종료 시 PR 상태와 미커밋·무시 파일을 확인하고, 보존이 필요한 자료를 `.local/backups`에 저장·검증한 후 `git worktree remove`를 사용한다. 이동은 `git worktree move`로 수행한다. `.local/`은 Git에서 제외하며 Git 연동 배포에도 포함되지 않는다. 백업을 외부에 복사하거나 업로드하지 않는다.

이전 설치의 Docker 그룹을 옮길 때는 먼저 `ops/rename-local-projects.py`를 `--apply` 없이 실행해 범위를 확인한다. 이 스크립트는 정확한 두 로컬 프로젝트만 대상으로 하며, `--source-root`와 Git 외부의 새 `--backup-dir`를 명시해야 한다. `--apply`는 서비스를 정지한 뒤 이미지 snapshot, 데이터 볼륨 복사, 이름·레이블·경로 변환과 logical DB dump 비교를 수행한다. 실패하면 기존 컨테이너를 재시작한다.

완료한 프로젝트에는 다시 실행하지 않는다. 원본 볼륨과 로컬 snapshot 이미지는 롤백 자료이며 일반 실행에서 사용하지 않는다. 백업 폴더의 inspect 및 SQL 파일에는 인증 설정과 테스트 데이터가 포함될 수 있으므로 Git에 넣지 않는다.

기존에 중지되어 있던 기본 로컬 Kong/Storage는 이전 후에도 중지 상태를 유지한다. 해당 서비스의 기존 실행 문제를 해결하려면 별도로 상태와 설정을 점검한다. 과거 도메인의 redirect와 이전 TOTP factor 이름은 기존 사용자 호환성을 위해 유지한다.
