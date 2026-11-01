# U-LiVET 실행 이름과 로컬 경로

2026-11-02 · 프로젝트의 현재 실행 기준이다. 이전 배포 기록과 SQL migration의 이름은 당시 이력을 나타낸다.

| 대상 | 현재 값 |
| --- | --- |
| 저장소 | `https://github.com/SKY6174/u-livet` |
| 기본 checkout | `/Users/thomas/Documents/u-livet` |
| 기존 worktree 모음 | `/Users/thomas/Documents/u-livet-worktrees` |
| 패키지·버전 API application | `u-livet` |
| Vercel 프로젝트 | `u-livet` |
| 운영·Preview | `https://u-livet.org` · `https://staging.u-livet.org` |
| 기본 로컬 Supabase | `u-livet-core` · API 55321 · DB 55322 · Mailpit 55324 |
| 이슈 검증용 Supabase | `u-livet-issues` · API 56321 · DB 56322 · Mailpit 56324 |
| 이슈 DB workdir | `/tmp/u-livet-issues-db` |
| favicon | `/images/u-livet-favicon.png` |

기본 DB 컨테이너는 `supabase_db_u-livet-core`, 이슈 검증용은 `supabase_db_u-livet-issues`다. 로컬 스크립트도 새 이름을 사용한다. 기존 포트와 데이터는 보존한다.

기존 `u-live` 작업 폴더는 `u-livet-worktrees`로 옮기고 12개 worktree의 Git 등록 경로를 복구했다. 이전 폴더 이름과 `uc-life` 별칭은 기존 작업의 접근을 위한 호환 심볼릭 링크로 남긴다. 새 경로에서 모든 worktree의 미커밋 상태가 이전과 같음을 확인했다.

이전 설치의 Docker 그룹을 옮길 때는 먼저 `ops/rename-local-projects.py`를 `--apply` 없이 실행해 범위를 확인한다. 이 스크립트는 정확한 두 로컬 프로젝트만 대상으로 하며, `--source-root`와 Git 외부의 새 `--backup-dir`를 명시해야 한다. `--apply`는 서비스를 정지한 뒤 이미지 snapshot, 데이터 볼륨 복사, 이름·레이블·경로 변환과 logical DB dump 비교를 수행한다. 실패하면 기존 컨테이너를 재시작한다.

완료한 프로젝트에는 다시 실행하지 않는다. 원본 볼륨과 로컬 snapshot 이미지는 롤백 자료이며 일반 실행에서 사용하지 않는다. 백업 폴더의 inspect 및 SQL 파일에는 인증 설정과 테스트 데이터가 포함될 수 있으므로 Git에 넣지 않는다.

기존에 중지되어 있던 기본 로컬 Kong/Storage는 이전 후에도 중지 상태를 유지한다. 해당 서비스의 기존 실행 문제를 해결하려면 별도로 상태와 설정을 점검한다. 과거 도메인의 redirect와 이전 TOTP factor 이름은 기존 사용자 호환성을 위해 유지한다.
