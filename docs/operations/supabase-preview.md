# Supabase Preview 준비 기록

2026-09-19 · `anchor-preview-environment` / `anchor-preview-db-validation` · 현재 상태: 생성 및 업무 DB 적용 완료, 서비스 ACTIVE_HEALTHY. 전체 앱/인증 인수는 미완료.

## 생성한 대상

| 항목 | 값 |
|---|---|
| 조직 | ANCHOR / `wdwiynwiumzuzjmsdisf` / Pro |
| 부모 프로젝트 | uc-life / `uoebygejgglgiivzgyks` |
| 부모 리전 | ap-northeast-1 |
| 새 브랜치 이름 | preview |
| 구성 | 기본 Micro, 운영 데이터 복사 없음 |
| 새 project ref | `bfqwntulxabfrimcypvx` |
| Branch ID | `b5c758c4-f87b-4749-8815-2b4d3b7e82fb` |
| 생성 시각 | 2026-09-19 07:21:18 KST |
| 생성 응답 | CREATING_PROJECT, is_default=false, persistent=false, with_data=false |
| 최종 확인 | FUNCTIONS_DEPLOYED / ACTIVE_HEALTHY |
| 프런트엔드 Preview URL | 별도 Vercel 배포 전이므로 없음 |

생성 전 브랜치 목록에는 main 하나만 있었다. 비용 확인 후 create_branch를 한 번 실행했고, 다른 project ref와 올바른 부모 관계·with_data=false를 확인했다. 부모는 ACTIVE_HEALTHY이고 main branch action은 기존 MIGRATIONS_FAILED 상태다. 새 브랜치 생성은 부모의 실패 이력 또는 로컬 수정본 적용 여부를 자동으로 해결하지 않는다.

## 비용 확인

사용자가 Preview 브랜치 생성을 요청했다. Supabase get_cost는 해당 조직 기준 `amount=0.01344`, `recurrence=hourly`, `type=branch`를 반환했다. Micro 720시간 연속 실행 시 compute 약 USD 9.68이며 추가 사용량 비용은 별도다. 생성 전 비용 이해 확인은 도구 요구사항에 따른다. [공식 Branching 비용](https://supabase.com/docs/guides/platform/manage-your-usage/branching)

사용자가 `비용 확인 — 생성 진행`을 선택했고 confirm_cost 기록 후 생성했다. 추가 비용 확인을 다시 요청하지 않는다.

## 업무 DB 적용 후 확인 결과

| 항목 | 결과 |
|---|---|
| 대상 분리 | 새 ref와 부모 ref가 다르고 부모 관계 일치 |
| migration 이력 | 기존 001~008 + 후속 11개, 총 19개 |
| 업무 테이블 | public life_ 73개 / life_private 11개, 모두 RLS 활성 |
| 회원 / 학습자 / 수강신청 / Storage 파일 수 | 모두 0 |
| 업무 기초 자료 | 기본 조직 1개·사업연차 1개. 승인된 개인정보 정책 0개 |
| 기존 API 접근 | non-life 테이블/뷰 및 legacy definer 함수의 anon/authenticated 접근 권한 없음 |
| 인증 의존 컬럼 | 19개 존재 |
| life_ 복구·MFA 트리거 | 4개 미설치 |
| 최소 비밀번호 길이 | Preview만 6 → 12로 변경, GET 재조회 확인 |
| 확정 문자 조합 | 정확한 설정 PATCH는 HTTP 400, 현재 null. 미충족 |
| 부모 Auth 비교 | 최소 6자 / 문자 조합 null 유지 |

Supabase `get_project`는 새 branch ref에 NotFound를 반환했으나 branch 목록·migration 조회·SQL·Auth API는 정상 동작했다. 단일 프로젝트 조회 오류를 브랜치 생성 실패로 판정하지 않았다.

생성 직후에는 001~008만 있었고 Security Advisor가 search_path 미고정 8건, anon definer 실행 6건, authenticated definer 실행 6건을 보고했다. 이후 공식 CLI로 수정된 009·010과 업무용 life_ migration 9개를 적용했다. 적용 후 이 경고는 없어졌고, 현재 Advisor 결과는 WARN/ERROR 0건, `rls_enabled_no_policy` INFO 61건이다. 직접 접근을 기본 거부하고 검증된 RPC를 사용하는 테이블들이며, 경고 수를 줄이려고 허용 정책을 추가하지 않았다. [RLS 정책 없음 안내](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)

실제 익명 REST 검사 3건도 통과했다: 공개 개설과정 조회 HTTP 200/빈 배열, 인증 없는 신청 RPC HTTP 401/42501, 기존 프로필 직접 조회 HTTP 401/42501. public definer 3개는 증명서 서버 작업 전용으로 anon/authenticated 실행이 거부되고 service_role만 실행할 수 있다. 인증 사용자·역할별 전체 업무 시험은 아직 수행하지 않았다.

Auth 복구·MFA·남용 방지 3개 migration은 적용하지 않았다. 메일 발송·시험 계정 생성·사용자/파일 복사·main 병합·Git push·운영 Auth 변경은 하지 않았다. main 이력은 001~008 그대로다. `.env.local`도 읽거나 수정하지 않았다. [적용 및 검증 보고서](../04-report/features/anchor-preview-db-validation.report.md)

## 다음 작업

1. 사용자가 선택한 [별도 인증 서버 운영 설계](self-hosted-auth-design.md)에 따라 DB 위치·운영 담당자·서버/백업 예산·도메인을 확정한다. 최소 길이만 적용된 현재 Cloud Preview를 인증 완료로 표시하지 않는다.
2. 분리된 self-hosted 인수 스택에서 native 비밀번호 정책과 전체 migration을 검증한다. Cloud Preview는 업무 DB 검증용이다.
3. 해당 시험 스택에 SMTP/CAPTCHA와 Vercel 시험 앱을 연결하고 역할별 업무·인증 행동 시험을 수행한다.

[Preview 대시보드](https://supabase.com/dashboard/project/bfqwntulxabfrimcypvx)

참조: [인증 결정안](auth-deployment-decision.md), [마이그레이션 재시도](supabase-migration-retry.md).
