# 필수 검사 기반 자동 병합·배포 설정

2026-11-22 · `u-livet-auto-merge-release`

## 반영 내용

저장소 자동 병합을 허용하고 기존 승인 요구 0건과 필수 `PR quality gate`, strict 검사·관리자 보호를 유지한다. 성공한 PR 품질 검사 완료 후 기본 브랜치의 `Automatic PR merge`가 최신 PR 메타데이터와 검사 SHA를 대조해 병합하거나 자동 병합을 예약한다.

초안·닫힌 PR·다른 base·오래된 SHA는 건너뛰며, 실패한 검사나 충돌을 관리자 권한으로 우회하지 않는다. 자동화는 PR 코드·산출물을 실행하지 않고 별도 PAT·공급자 비밀을 저장하지 않는다.

AGENTS.md와 README에 검토 승인 재요청 없이 처리하는 범위, 기존 Git 운영 배포 재사용, 문서 빌드 생략 및 로컬 동기화 방침을 반영했다. 상시 staging/Preview 사용 중단 상태는 유지한다.

## 검증 근거

- 구현 대조 10/10, YAML·Python 구문 및 11개 상태·SHA·인자 경계 시나리오 통과.
- 설치 PR의 필수 CI와 GitHub 자동 병합 결과는 해당 PR Checks·병합 기록에서 확인한다.
- 설치 후 기본 브랜치의 이벤트 수신은 [Automatic PR merge 실행 기록](https://github.com/SKY6174/u-livet/actions/workflows/auto-merge.yml)에서 확인한다.
- 배포·생략 근거는 [Vercel 운영 프로젝트](https://vercel.com/ucsky6174/u-livet), 실제 상태는 [운영 health](https://u-livet.org/api/health)를 확인한다.

설치 전의 품질 실행에는 새 워크플로가 없으므로 설치 PR의 예약은 인증된 CLI에서 수행한다. 이후에는 기본 브랜치 워크플로가 성공한 품질 실행마다 동작한다.

관련 문서: [계획](../../01-plan/features/u-livet-auto-merge-release.plan.md), [설계](../../02-design/features/u-livet-auto-merge-release.design.md), [대조](../../03-analysis/u-livet-auto-merge-release.analysis.md).
