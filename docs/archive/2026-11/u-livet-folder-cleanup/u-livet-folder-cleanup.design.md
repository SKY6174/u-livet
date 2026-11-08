# U-LiVET 로컬 폴더 정리 설계

2026-11-08 · [계획](u-livet-folder-cleanup.plan.md)

## 디렉터리

```text
~/Documents/u-livet/            # 최신 main checkout
  .local/                      # Git 제외, 배포 제외
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
    worktrees/
      ci-cost-controls/        # PR #204
      deployment-dedup/        # PR #205
```

## 실행 순서와 보존

1. 워크트리별 HEAD·브랜치·상태를 목록화한다. 열린 PR 두 개는 유지한다.
2. 기본 checkout과 제거할 각 워크트리를 압축한다. `.git`, `.local`, `node_modules`, `.next*`만 제외한다. 각 파일의 SHA-256을 압축본 내부 파일과 대조한다.
3. 기본 checkout의 변경을 stash에 보관하고 별도 `refs/archive/` 참조를 만든다. 기존 main은 `archive/legacy-main-20261108` 브랜치로 유지한다.
4. 모든 참조를 Git bundle로 저장하고 `git bundle verify`를 실행한다. bundle과 압축본은 로컬 비공개 경로에만 둔다.
5. 검증된 워크트리를 Git 명령으로 제거하고, 남긴 PR 워크트리는 `git worktree move`로 옮긴다. 사라진 임시 워크트리 등록은 prune한다.
6. 외부 백업과 느슨한 검증 자료를 이동한다. 호환 링크는 상대 링크로 보관 위치에 옮겨 접근 가능성을 유지한다.
7. 기본 checkout에서 새 main을 원격 기준으로 만들고, 정리 PR 병합 후 fast-forward한다.

## 검증과 복원

manifest는 원래 경로, HEAD, 브랜치, 상태, 압축본 경로·해시·파일 수, 변경 보존 참조를 기록한다. 압축본과 bundle 검사에 실패하면 제거를 진행하지 않는다. 복원은 bundle을 별도 디렉터리에 clone하고 해당 HEAD를 checkout한 뒤 압축본을 해제한다. main 변경만 되살릴 때는 보존한 stash 참조를 새 복구 브랜치에 적용한다.

최종 검증은 `git worktree list`, 기본 checkout 상태, `git check-ignore`, 상위 폴더 목록, PR 검사와 정확한 병합 커밋의 운영 배포를 확인한다.
