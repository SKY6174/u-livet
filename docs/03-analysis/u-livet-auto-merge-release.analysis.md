# 자동 병합·배포 설계 대조

2026-11-22 · `u-livet-auto-merge-release`

| 설계 조건 | 구현·로컬 검증 |
|---|---|
| 저장소 자동 병합 허용 | `allow_auto_merge=true` API 확인 |
| 필수 검사 및 승인 0건 | 기존 `PR quality gate`, strict·관리자 보호 유지 |
| 성공한 PR 품질 실행만 처리 | 워크플로 조건 및 Python 내부 조건에서 확인 |
| 열린 비초안 main PR과 현재 SHA 일치 | API 재조회와 상태·저장소·base·SHA 검사 |
| 메타데이터 누락 보완 | commit 연결 PR API 조회 검사 통과 |
| PR 코드·산출물 실행 금지 | checkout·다운로드·의존성 설치 없이 내장 Python만 실행 |
| 커밋 변경과 셸 인자 경계 | SHA 형식과 PR 번호 검증, subprocess 배열, `--match-head-commit` |
| 보호 조건에 따른 병합·대기 | `gh pr merge --merge --auto`, 관리자 우회 없음 |
| 기존 운영 배포와 문서 생략 | 기존 Vercel Git·Supabase main 및 build-scope 유지 |
| 프로젝트 규칙 | AGENTS.md·README 반영 |

구현 대조 10/10. YAML과 내장 Python 구문, 11개 상태·SHA·인자 경계 시나리오를 검증했다. 기존 품질 검사와 운영 배포는 GitHub/Vercel의 실제 실행 결과로 최종 확인한다. 새 기본 브랜치 워크플로의 초기 설치는 CLI 자동 병합 예약으로 진행하며, 설치 이후 성공 품질 실행의 재실행으로 실제 이벤트 수신과 닫힌 PR 건너뛰기를 확인한다.
