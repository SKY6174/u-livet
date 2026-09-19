# Production 앱 배포 검증

2026-09-19 · `anchor-production-app-release`

설계: [Production 앱 배포 설계](../02-design/features/anchor-production-app-release.design.md)

## 판정

배포 범위의 인수 항목 10/10 충족. 운영 계정으로 수행하는 실제 업무 인수는 다음 단계다.

| 인수 항목 | 결과 및 근거 |
| --- | --- |
| main/preview 충돌 확인 | `git merge-tree` 성공. 병합 결과와 Preview tree 모두 `5932268b45945f14c22a9df43de39fe6ce7bb961` |
| 검증한 앱 코드 유지 | Preview 통합 시험 이후 제품 코드 변경 없음. 최종 head `ea462708`의 추가 변경은 계획·설계 문서 2개 |
| 회귀·정적 검증 | 회귀 189개, lint, 격리 checkout의 Next.js 빌드와 TypeScript 검사 통과 |
| PR 및 일반 병합 | [PR #2](https://github.com/SKY6174/uc-life/pull/2). 3개 검사 성공·CLEAN 확인 후 head SHA를 고정해 merge |
| Production 새 빌드 | `404b43c26388ab7ec6faeb369e0718461f778138`로 `dpl_9CskrD5SsBqv5kMegLrD9y4G1AsE` READY, 운영 도메인 연결 |
| 환경과 DB 구분 | 빌드 `CONFIG_VALID`, `/api/version` production/managed-cloud-v1/reviewOnly=false. 실제 카카오 로그인 이동의 callback은 운영 Supabase ref |
| 운영 응답 및 접근 제한 | version/health/홈/login/courses 200, health=healthy. 관리자·보고서·출력 경로는 로그인으로 307. 비로그인 첨부 POST 401, 파일 GET 404 |
| 브라우저 기본 화면 | 홈·로그인 시각 확인, 오류 없음. 모바일 390px에서 가로 넘침 없음. 카카오 계정 로그인 페이지 도착 확인 |
| 배포 후 로그 및 설정 | 새 배포의 검증 구간 5xx 없음. 운영 자동 migration 성공·미적용 없음. 운영/Preview Auth 설정 해시 전후 동일 |
| staging 유지·복구·문서 | 기존 Preview의 Git 연결 복구 및 persistent 설정. 운영/Preview 모두 ACTIVE_HEALTHY. 이전 Production 배포 복구 후보 기록 |

## 해결한 차이와 검증 한계

- 첫 PR 검사에서 `Failed to provision branch project`가 발생했다. 기존 Preview는 Git 브랜치 연결이 없고 ephemeral이었다. 기존 DB를 `preview`에 연결하고 persistent로 변경한 뒤 문서 커밋으로 다시 실행한 검사는 성공했다. 새 DB 생성·이력 조작·검사 우회는 없었다.
- GitHub 검사 직접 재실행 API는 404를 반환했다. 다음 정상 커밋으로 Supabase 앱의 검사를 다시 실행했다.
- 작업 폴더의 직접 `tsc`는 기존 `.next` 및 `tmp`의 생성된 중복 타입 파일 때문에 실패했다. 해당 파일은 유지하고 격리 checkout 및 실제 Vercel Production 빌드에서 타입 검사를 통과했다.
- Vercel MCP 빌드 로그 메서드가 제공되지 않아 인증된 Vercel CLI로 동일 배포의 빌드 로그를 확인했다.
- 로그인 화면은 Server Actions를 사용하므로 브라우저 정적 JS에서 Supabase 주소를 추출하는 방법으로는 확인할 수 없었다. 실제 카카오 로그인 이동에서 운영 callback `https://uoebygejgglgiivzgyks.supabase.co/auth/v1/callback`을 확인했다. 계정 입력·동의·회원가입은 수행하지 않았다.
- staging의 비인증 HTTP 요청은 기존 Vercel SSO로 302 이동한다. 이를 앱 장애로 보지 않는다. Supabase Preview의 설정·상태·검사 성공으로 환경 유지 여부를 확인했다.
- 운영 공개 과정은 아직 0개다. 관리자용 14개 편성표 반영과 실제 수강신청용 개설·공개는 별도다.

## 다음 단계

운영 계정의 역할·MFA와 관리자 편성표를 확인하고, 실제 개설 과정의 일정·정원·모집 여부를 확정한 후 보고서 저장·첨부·출력을 운영 절차에 따라 인수한다.
