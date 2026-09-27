# 신원 확인 DB 지연 개선 계획

2026-09-27 · anchor-identity-db-latency · Dynamic

## 목표와 근거

운영 DB와 `/api/health`는 정상이다. 운영 `pg_stat_statements`에서 자주 호출되는 `life_identity()`는 누적 1,312회, 평균 102.07ms다. 이전 점검 이후 42회 추가 호출의 누적 실행시간 차이는 약 2.34초이며, 최근 호출당 약 56ms로 추정된다. 이 수치는 PostgreSQL 실행시간이지 전체 로그인 화면 응답시간은 아니다.

`life_private.person_id()`가 동일한 `life_private.auth_status()`를 `active`와 `needs_reset` 검사에 각각 호출한다. 이 신원 확인은 여러 인증 RPC에서 쓰이므로 한 요청 안의 중복 계산만 없애는 범위에서 개선한다.

## 범위와 완료 조건

- 기존 활성 계정·비활성 계정·재설정 필요·MFA 필요·만료된 세션의 인가 결과를 유지한다.
- `person_id()` 반환형, 보안 속성, 권한, 공개 RPC 계약을 변경하지 않는다.
- 로컬 합성 계정에서 이전/변경 함수의 결과를 비교하고 반복 실행시간을 기록한다.
- 운영 DB에는 로컬 대비 정확히 1개 마이그레이션만 적용하고, 권한·보안 Advisor·헬스 상태를 사후 확인한다.
- 변경을 최신 `main`에 push하고 배포 revision을 확인한다.

인증 데이터를 캐시하거나 MFA·세션 유효성 검사를 생략하지 않는다. 운영 사용자 계정으로 로그인하거나 운영 개인정보를 조회하지 않는다.

## 위험과 검증

공유 인증 함수의 조건식 변화는 권한 누출로 이어질 수 있다. 원문 조건식을 보존한 채 두 번 호출하는 JSON 결과만 한 번 계산하도록 설계한다. 로컬 트랜잭션에서 원본 함수와 수정 함수를 동일한 JWT claims로 비교하고 롤백한다. 개선이 측정되지 않거나 동등성이 깨지면 배포하지 않는다.

[기존 인증 설계](../features/anchor-core-flow.plan.md) · [PostgreSQL 17 WITH 문서](https://www.postgresql.org/docs/17/queries-with.html) · [Supabase RLS 가이드](https://supabase.com/docs/guides/database/postgres/row-level-security)
