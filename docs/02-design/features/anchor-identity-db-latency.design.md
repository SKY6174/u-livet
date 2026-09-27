# 신원 확인 DB 지연 개선 설계

2026-09-27 · [계획](../../01-plan/features/anchor-identity-db-latency.plan.md)

## 변경 경계

`life_private.person_id()`의 `WHERE` 조건을 유지한다. `auth_status()` JSON의 `active`와 `needs_reset`에 대해 함수가 두 번 평가되는 부분만 `WITH auth_state AS MATERIALIZED (SELECT life_private.auth_status() AS value)`로 바꾸고 두 필드를 그 값에서 읽는다. `life_auth_links`, `auth.uid()`, `mfa_required()`, JWT AAL 및 `mfa_verified()` 조건식은 그대로 둔다. `CREATE OR REPLACE FUNCTION`으로 반환형, `STABLE SECURITY DEFINER`, 빈 `search_path`, 소유자 및 기존 실행 권한을 유지한다.

데이터 모델, RLS 정책, 공개 RPC와 앱 코드는 변경하지 않는다. PostgreSQL 17은 `MATERIALIZED` CTE를 별도 계산하므로 같은 문장에서 비싼 함수 평가를 중복하지 않는다. [공식 설명](https://www.postgresql.org/docs/17/queries-with.html).

## 검증

로컬 DB의 기존 함수 정의를 같은 트랜잭션의 임시 함수로 복제한다. 기존 합성 인증 사용자 중 관리자·강사·학습자, 유효/존재하지 않는 세션, MFA 수준별 claims를 선택해 이전/새 `person_id()` 결과와 `life_identity()`의 반환값을 대조한다. 접근 가능한 데이터의 원문은 출력하지 않고 profile별 동등성 및 숫자만 기록한다. 관리자 세션에서 교차 순서 8쌍의 실행시간을 측정하며 첫 쌍은 제외한다. SQL 트랜잭션을 롤백하여 로컬 함수와 데이터가 원래대로 돌아오는지 확인한다.

기존 인증 회귀와 프로덕션 빌드를 실행한다. 배포 전에 공식 CLI dry-run에서 예정 마이그레이션이 정확히 1개인지 확인한다. 적용 후 함수 정의·권한·보안 Advisor 및 운영 API의 revision/health를 확인한다. 로그인한 운영 사용자의 화면 전체 속도는 별도 계측이 필요하다.

이전 함수와 결과가 다르거나 DB 실행시간 중앙값이 개선되지 않으면 변경을 배포하지 않는다.
