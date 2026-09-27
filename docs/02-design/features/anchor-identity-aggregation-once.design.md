# 신원 조회 중복 권한 계산 제거 설계

2026-09-27 · [계획](../../01-plan/features/anchor-identity-aggregation-once.plan.md)

## 변경 경계

`life_private.identity()` 내부에서 `life_private.member_entry_orgs()` 결과를 `MATERIALIZED` CTE로 한 번 보관한다. 이 결과에서 정렬된 `member_entry_orgs` JSON 배열과 `is_super_admin` 불리언을 함께 만든다. `life_private.person_id()`와 기존 사람·분류·역할 조회 조건, JSON 키와 자료형, `STABLE SECURITY DEFINER` 및 `search_path=''`를 유지한다. 공개 RPC, 앱 코드, RLS, 함수 실행 권한은 바꾸지 않는다.

## 검증 및 배포

로컬 DB 한 트랜잭션에서 원본 함수를 임시 함수로 복제하고 신규 정의를 적용한다. 합성 인증 fixture로 정상 관리자·강사·학습자와 익명·무효 세션의 JSON 전체를 비교한다. 관리자 요청에 대해 구/신 함수를 교차 실행하고 첫 회를 제외한 중앙값을 비교한다. 트랜잭션을 롤백한 후 dry-run에서 신규 마이그레이션 1건만 보이는지 확인한다. 운영 적용 후 함수 정의, 보안 Advisor, `/api/health`를 확인한다.

결과가 다르거나 중앙값이 개선되지 않으면 신규 정의를 적용하지 않는다.
