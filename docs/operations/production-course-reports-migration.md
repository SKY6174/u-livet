# 운영 보고서 DB 적용 절차

2026-09-19 · 운영 적용 및 사후 검증 완료 · `anchor-production-db-rollout`

현재 운영 이력은 25개이며 보고서 migration이 적용됐다. 아래 사전 상태와 명령은 적용 기록 및 복구 참고용이다.
이미 적용된 SQL을 직접 재실행하지 않는다. [적용 결과](../04-report/features/anchor-production-db-rollout.report.md).

## 확정 대상

| 항목 | 값 |
| --- | --- |
| 운영 DB | `uoebygejgglgiivzgyks` |
| Preview DB | `bfqwntulxabfrimcypvx` |
| 운영 앱 기준 | `e7d3c8ea7492bcea8bb9c40077477bd903f7819f` |
| 통합 검증한 Preview 앱 | `367070512043f9fdc2a53fb7956799f4c4a4380a` |
| 추가할 파일 | `supabase/migrations/20260919043637_anchor_course_reports.sql` |
| 파일 SHA-256 | `a77f8360260942e0010f59a9c2a469426e3a7417c35b4c4b68b0be2957e2fe43` |
| 적용 전 이력 | 운영 24개 / Preview 25개 |
| 적용 전 운영 계수 | Auth 1명 / 과정 0개 / 조직 1개 |

운영에 없는 변경은 위 파일 1개다. 공통 24개 migration의 이름·저장 SQL 지문은 모두 같고,
보고서에서 사용하는 `manages`, `person_id`, `completion_board`, `recent_mfa_write_guard` 정의도 같다.
Preview의 저장 SQL MD5 `f7ad6dd29545bae3642d2eadce6c87c6`는 원본 파일 MD5와 일치한다.

보고서/첨부 테이블 2개, public invoker RPC 4개, private 함수 7개, RLS 정책 2개 및 MFA 쓰기 트리거 2개를 추가한다.
기존 테이블 구조/행과 기존 함수를 바꾸는 최상위 SQL은 없다. 함수 안의 저장·삭제 SQL은 RPC 호출 시 실행된다.
기존 운영 앱은 이 새 객체에 의존하지 않아 DB를 먼저 적용할 수 있다.

## 실행 직전 확인

아래 명령은 저장소 루트에서 실행한다. 검증한 CLI는 2.115.0이다.

```sh
shasum -a 256 supabase/migrations/20260919043637_anchor_course_reports.sql
supabase db query --linked --project-ref uoebygejgglgiivzgyks --file ops/production-course-reports-check.sql --output json
supabase db push --project-ref uoebygejgglgiivzgyks --dry-run --include-all --skip-vault
```

점검 SQL은 읽기 전용 transaction이다. 적용 전 기대값은 migration 24개, `migration_applied=false`, 보고서 테이블 2개와 함수 11개 모두 `exists=false`다.
부분 객체가 있거나 이력이 달라졌다면 먼저 원인을 대조한다. 예상 목록은 정확히 다음 1개다.

```text
20260919043637_anchor_course_reports.sql
```

`20260919053031_anchor_kakao_signup`이 이미 운영에 있으므로 더 이른 시각의 누락 파일을 포함하려면 `--include-all`이 필요하다.
같은 버전의 ` 2.sql` 사본 10개를 제거한 상태에서 실행한다. 정리 전에는 이미 적용된 10개까지 재실행 목록에 포함됐다.
원격 이력을 repair하거나 원본 파일을 재작성하지 않는다. Vault·seed·role 배포를 포함하지 않는다.

## 백업 확인

- 관리 API 조회: 완료된 일일 백업 2개. 최신 `2026-09-18T22:26:40.832Z`(9월 19일 07:26 KST), 이전 `2026-09-18T12:39:07.792Z`. PITR 비활성.
- 적용 준비 시점의 `public,life_private` 스키마 덤프: Git 제외 `tmp/production-db-preparation/schema-before.sql`, 0600, 623,556 bytes.
- 덤프 SHA-256: `38d7b1a47e55d929f1cda7fe249cda46b1ed4983e991e66317ed8b6b15963f5f`.
- 최초 덤프는 SSL EOF로 실패했고, 재시도는 CLI exit 0으로 완료했다. 첫 실패 결과를 백업으로 취급하지 않는다.
- 이 덤프는 구조 기록이며 데이터·Auth·Storage 파일의 전체 백업이 아니다. 관리형 백업의 실제 복원이나 RPO/RTO 리허설은 이번 준비에 포함하지 않았다.
- 적용까지 시간이 지났다면 백업 목록과 아래 스키마 덤프를 다시 확인한다. 전체 DB 복원은 백업 이후의 정상 변경도 되돌리므로 이번 추가 migration의 기본 복구 방법으로 사용하지 않는다.

```sh
umask 077
mkdir -p tmp/production-db-preparation
supabase db dump --project-ref uoebygejgglgiivzgyks --schema public,life_private --file tmp/production-db-preparation/schema-before.sql
```

[운영 백업 화면](https://supabase.com/dashboard/project/uoebygejgglgiivzgyks/database/backups/scheduled) · [Supabase 백업 안내](https://supabase.com/docs/guides/platform/backups)

## 실제 적용과 사후 검증

아래 실제 적용 명령은 준비 단계 후 사용자 진행 요청에 따라 운영에 실행했고 사후 검증을 통과했다.
재점검에는 읽기 전용 SQL과 dry-run을 사용한다. 처음 적용하는 다른 대상에는 사전 목록을 다시 확인한다.

```sh
supabase db push --project-ref uoebygejgglgiivzgyks --include-all --skip-vault
supabase db query --linked --project-ref uoebygejgglgiivzgyks --file ops/production-course-reports-check.sql --output json
supabase db push --project-ref uoebygejgglgiivzgyks --dry-run --include-all --skip-vault
```

사후 기대값:

- migration 이력 25개, `migration_applied=true`, 추가 적용할 목록 없음.
- 테이블 2개 `exists=true`, `rls=true`, anon/authenticated 직접 SELECT=false.
- 함수 11개 존재, 모두 anon 실행=false, 고정된 빈 search_path.
- public 4개는 invoker, authenticated 실행=true. private 검증 함수 3개는 authenticated 실행=false.
- SELECT 정책 2개가 `life_private.manages(offering_id)`를 사용하고, 쓰기 트리거 2개가 활성 상태로 `recent_mfa_write_guard()`를 실행.
- 기존 업무 계수와 운영 `/api/health` 정상. 동시 실제 가입 등으로 계수가 바뀌었다면 실제 원인을 확인하며 임의 복원하지 않는다.
- Security Advisor에 새 WARN/ERROR가 없는지 확인. 기존 RLS 정책 없음 INFO 65건은 RPC 경유 전용 테이블의 직접 접근 차단 상태다.

CLI와 Management API는 migration SQL을 이력에 저장하는 형식이 다를 수 있다. 이력 MD5 하나만으로 실패 판정하지 말고 실제 함수·테이블·권한을 비교한다.

## 실패 시 처리

1. SQL 실행 오류가 COMMIT 전에 발생하면 해당 transaction의 객체 생성은 롤백된다. 원격 이력과 객체가 실제로 없는지 점검한다.
2. 객체 생성은 완료됐으나 이력 기록이 실패한 경우 무조건 재실행하거나 이력만 강제 수정하지 않는다. 객체 정의를 원본과 대조해 복구한다.
3. DB 적용 후 앱 문제가 있으면 기존 운영 앱을 유지하거나 호환되는 이전 앱으로 복귀한다. 새 테이블을 자동 DROP하지 않는다.
4. 보고서·첨부 저장이 시작된 뒤에는 데이터 보존과 후속 수정 migration을 우선한다. 전체 백업 복원은 데이터 손실 범위와 중단 시간을 검토한 별도 작업이다.
5. DB 검증 후 `preview`를 `main`에 통합하고 Production 환경 변수로 새로 빌드한다. Preview 산출물은 Preview DB 설정을 포함하므로 그대로 운영에 promote하지 않는다.

[마이그레이션 공식 안내](https://supabase.com/docs/guides/deployment/database-migrations) · [정책 없음 INFO 설명](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
