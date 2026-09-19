# Production 앱 배포 결과

2026-09-19 · `anchor-production-app-release`

## 완료 결과

2026 교육과정 편성표와 결과보고서·첨부·6종 출력 기능을 `main`에 통합하고 [운영 사이트](https://uc-life.org)에 배포했다.

- PR: [#2 — 운영 배포: 2026 교육과정 편성표와 결과보고서](https://github.com/SKY6174/uc-life/pull/2)
- 병합 시각: 2026-09-19 15:23:47 KST
- 운영 revision: `404b43c26388ab7ec6faeb369e0718461f778138`
- 배포: `dpl_9CskrD5SsBqv5kMegLrD9y4G1AsE` · Production · READY · hnd1
- READY 시각: 2026-09-19 15:24:32 KST
- 이전 운영 배포(복구 후보): `dpl_7eEzNbUWdeDrvDee1HSqekLEbkXw`

Preview 빌드를 promote하지 않고 Production 환경변수로 새로 빌드했다. 제품 소스는 이전 Preview 통합 검증 대상과 같으며 이번 단계의 저장소 변경은 배포 문서다.

## 검증

| 항목 | 결과 |
| --- | --- |
| 과정 계획 / DB 성능 / MFA 회귀 | 14 / 13 / 23개 통과 |
| managed-cloud / release 회귀 | 28 / 111개 통과, 합계 189개 |
| lint / 빌드·타입 | lint 성공, 격리 checkout 및 Vercel Production 빌드·타입 검사 성공 |
| PR 검사 | Supabase Preview, Vercel, Vercel Preview Comments 모두 성공 후 일반 병합 |
| Production 빌드 설정 | CONFIG_VALID, 미충족 0개, 환경 분리 검사 통과 |
| `/api/version` | 200, 위 merge SHA, production, managed-cloud-v1, reviewOnly=false |
| `/api/health` | 200, healthy |
| 홈·로그인·교육과정 | 200, 홈과 로그인 실제 브라우저 시각 확인 |
| 관리자 편성표·보고서·출력 | 비로그인 요청은 로그인으로 307 이동 |
| 보고서 첨부 API | 비로그인 POST 401, 파일 GET 404, 응답 내용 없음 |
| 카카오 연결 | 계정 로그인 페이지 도착, 운영 Supabase callback 확인, 계정 제출 없음 |
| 모바일 | 390px 로그인 화면, 가로 넘침 없음 |
| 오류 | 앱 브라우저 오류 없음, 배포 후 검증 구간의 Vercel 5xx 조회 결과 없음 |

## Supabase 자동화 연결 복구

첫 PR의 자동 Preview 준비는 `Failed to provision branch project`로 실패했다. 수동 생성했던 기존 Preview가 Git `preview`에 연결되지 않은 상태를 확인했다.

기존 브랜치 `bfqwntulxabfrimcypvx`의 `git_branch=preview`, `persistent=true`를 설정했다. 새 DB를 만들지 않았고 staging의 기존 데이터·설정을 유지했다. 정상 문서 커밋 이후 자동 검사가 성공했으며 PR을 병합해도 이 staging은 유지된다.

운영 merge 자동화도 성공했다. Supabase action `4cdc03e3b0ff40718a8fc3a1d0310ba5`의 로그에서 모든 migration 적용 완료 상태와 protected branch의 설정·seed 건너뛰기를 확인했다. 운영/Preview 모두 `FUNCTIONS_DEPLOYED`, `ACTIVE_HEALTHY`다. 배포 전후 양쪽 Auth 설정의 SHA-256 해시도 동일하다.

공식 동작 근거: [영구 브랜치 및 설정 적용](https://supabase.com/docs/guides/deployment/branching/configuration), [GitHub 운영 배포](https://supabase.com/docs/guides/deployment/branching/github-integration).

## 범위와 후속 인수

- 배포 및 인증 전 smoke 검증을 완료했다. 실제 운영 계정의 로그인·MFA·권한별 업무 저장·메일 발송은 이번 단계에서 실행하지 않았다.
- 현재 공개 개설 과정은 0개다. PDF 기반 관리자 편성표 14개가 모집 과정으로 자동 공개되는 것은 아니다. 다음 단계에서 실제 일정·정원·모집 설정을 확인해야 한다.
- `tmp/production-app-release/`에 홈·로그인·모바일 화면과 인증 설정 비교용 비밀값 없는 요약을 보관했다. 이 로컬 검증 자료는 Git에서 제외한다.
- 기존 작업 폴더의 생성된 중복 타입 파일 때문에 직접 `tsc`가 실패한 내용과 대체 검증 근거는 [검증 분석](../../03-analysis/anchor-production-app-release.analysis.md)에 기록했다.

PDCA: Plan → Design → Do → Check → Report 완료. 후속 단계는 실제 운영 계정과 교육과정 공개 상태 인수다.
