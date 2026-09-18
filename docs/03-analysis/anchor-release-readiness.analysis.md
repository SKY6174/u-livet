# Vercel + Supabase 배포 준비 설계 대조

2026-09-19 · `anchor-release-readiness` · [설계](../02-design/features/anchor-release-readiness.design.md)

설계 항목 12/12 구현 확인. **100%는 이번 사전 검사 도구의 설계 충족률이며 운영 준비율이나 보안 인증 결과가 아니다.** 실제 운영 설정은 미확인이고 예시 전체 검사는 `BLOCKED`다.

| 설계 항목 | 결과 | 근거 |
|---|---|---|
| 순수 환경 검사 | 충족 | `inspectEnvironment`, 고정된 안전한 결과 메시지 |
| 대상·Production 기준·Preview 분리 | 충족 | 사이트와 DB 각각 일치/불일치, VERCEL_ENV 충돌 거부 |
| 공개/서버 키 구분·비밀 노출 | 충족 | allowlist, prefix 또는 legacy role/ref, 중복/포함 검사 |
| CAPTCHA·HMAC·프록시 | 충족 | 시험 키·로컬 모드·잘못된 헤더·legacy trust·기본/재사용 HMAC 거부 |
| 수동 운영 증거 기록 | 충족 | 15개 항목, 상태·담당자·증거 참조·30일 이내 UTC 시각 |
| 기록과 대상 소스 연결 | 충족 | 환경·sourceDigest·migrationDigest 비교 |
| 안전한 snapshot | 충족 | 고정 경로·실제 env 제외·symlink 거부·migration 버전 중복 거부 |
| CLI 경계 | 충족 | 명시 env 파일만 읽기, 상속과 혼합 없음, 크기 제한, 오류/경로/값 비노출 |
| 설정/운영 판정 구분 | 충족 | CONFIG_VALID / READY_FOR_MANUAL_RELEASE_REVIEW / BLOCKED 및 종료값 |
| Vercel build gate | 충족 | 환경파일/잘못된 설정이면 Next 미호출, 정상 시 호출, 실패 코드 전달 |
| 환경 예시·담당자 양식·가이드 | 충족 | 빈 실제 값, pending 기록, README와 운영 절차 연결 |
| 회귀 검사·영향 경계 | 충족 | 합성 입력/임시 디렉터리 111개, 실제 원격·개인 env 미사용 |

## 실행 증거

- [111개 검사 결과](../04-report/features/evidence/release-tests.txt): 환경 오류, 기록 누락/노후화, 키 비노출, CLI 성공/실패, build 선행 차단 및 Next 종료 코드.
- [빈 예시 전체 판정](../04-report/features/evidence/release-example-blocked.json): 33개 체크 중 27개 미충족, 종료 1. 운영 증거 15개 모두 미확인으로 거부.
- [현재 지문](../04-report/features/evidence/release-snapshot.json): 대상 파일 187개, migration 22개. 파일을 실행하거나 migration을 적용하지 않고 내용 지문만 계산.
- `npm run lint`, 4개 mjs `node --check`, `git diff --check` 통과.
- 이번 변경에는 UI/업무 API/DB schema 수정이 없다. 기존 인증 120개 및 전체 업무 검사를 재실행한 것으로 합산하지 않았다. 실제 Vercel build는 실행하지 않았으며 build 호출 여부는 임시 Next stub으로 검증했다.

## 점검 중 보완

1. 현재 Node 실행 환경에서 `--env-file`이 런타임 옵션과 충돌해 입력 경로가 stderr에 나올 수 있었다. npm 명령·테스트·직접 실행 안내에 `node -- scripts/...` 구분자를 추가하고 오류 입력 비노출을 재검증했다.
2. 공개 정적 파일도 배포 결과에 영향을 주므로 `public/`을 snapshot과 설계에 추가했다. `robots.txt` 변경 시 sourceDigest가 바뀌는 검사도 추가했다.

## 남은 운영 검증

hosted Supabase의 정확한 비밀번호 정책, Auth schema 트리거·감사 이벤트/MFA 의존성, 실제 키 유효성, SMTP/CAPTCHA, 대상 런타임, WAF/직접 API, 백업/파일 복원, 정책 승인·보유기간·정리 스케줄, 모니터링과 게시 승인은 수동 인수 항목이다. `confirmed`는 담당자 선언이며 검사기가 증거 진위를 보증하지 않는다. 실제 운영/Preview 프로젝트나 키는 생성·변경하지 않았다.
