# 필수 검사 기반 자동 병합·배포 설계

2026-11-22 · [계획](../../01-plan/features/u-livet-auto-merge-release.plan.md)

## 처리 흐름

`.github/workflows/auto-merge.yml`은 `Pull request quality`의 `workflow_run.completed` 이벤트를 받는다. 성공한 `pull_request` 실행에 대해서만 기본 브랜치의 자동화가 동작한다. 공개 저장소의 `pull_request_target` 기본 정책 변경에 의존하지 않는다.

이벤트의 연결 PR 번호를 읽고, 비어 있으면 검사한 commit의 연결 PR을 GitHub API로 조회한다. 매 PR의 최신 메타데이터를 다시 조회하여 열린 상태, 비초안, 대상 저장소 `SKY6174/u-livet`, base `main`, 현재 head SHA와 검사 SHA의 일치를 확인한다. 오래된 검사·초안·닫힌 PR·다른 base는 건너뛴다.

대상에는 `gh pr merge --merge --auto --match-head-commit <검사한 SHA>`를 실행한다. 현재 모든 보호 조건이 충족되면 병합하고, 다른 필수 조건이 남아 있으면 GitHub 자동 병합을 예약한다. 실패·충돌·최신 base 미충족은 우회하지 않는다.

## 권한과 데이터 경계

- 작업의 `GITHUB_TOKEN`은 `contents: write`, `pull-requests: write`만 가진다.
- checkout, PR 소스 실행, 의존성 설치, 산출물 다운로드 및 저장소 비밀 사용을 하지 않는다.
- Python 표준 라이브러리와 기본 설치된 `gh`만 사용하며, PR 값은 subprocess의 인자 배열로 전달한다.
- 검사 실행 SHA를 병합 명령에 고정하여 메타데이터 조회 후 커밋 변경도 거부한다.
- 저장소 자동 병합만 활성화하고 검토 승인 0건, 필수 `PR quality gate`, strict 검사·관리자 보호는 유지한다.

## 운영 및 규칙

병합 후 기존 Vercel Git 연동만 운영 배포를 담당한다. Supabase의 기존 `main` 운영 연동도 유지한다. Preview는 비활성 상태이며 별도 수동 배포를 중복 실행하지 않는다. 기존 문서 허용 목록과 전체 변경 범위의 빌드 판정을 유지한다.

AGENTS.md와 README에는 위 조건, 승인 재요청 없이 처리하는 기본 방침, 실패 시 원인 수정 및 재검증, 배포 완료·생략 확인과 로컬 동기화를 기록한다.

## 검증

YAML과 내장 Python 구문, 성공·실패 실행, head 변경, 초안·닫힘·다른 base·다른 저장소, 연결 PR 누락의 API 보완 및 subprocess 인자 경계를 검사한다. 설치 PR에서는 CI와 GitHub 자동 병합을 확인한다. 설치 후 같은 품질 실행을 재실행하여 기본 브랜치 워크플로의 실제 실행과 닫힌 PR 건너뛰기를 확인한다. 마지막으로 보호 규칙, 배포 또는 빌드 생략, 운영 health 및 로컬 동기화를 확인한다.

## 공식 근거

- [GitHub 자동 병합](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/automatically-merging-a-pull-request)
- [workflow_run 이벤트](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run)
- [GitHub CLI 병합](https://cli.github.com/manual/gh_pr_merge)
