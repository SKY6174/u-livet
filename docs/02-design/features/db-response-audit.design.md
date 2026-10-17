# DB 연결·관리 목록 응답 최적화 설계

2026-10-17 · db-response-audit · [계획](../../01-plan/features/db-response-audit.plan.md)

## 읽기 경로

public life_management_applications / life_management_learners의 기존 인증·입력·상세 기관 검사는 그대로 둔다. 두 RPC가 호출하는 private 읽기 함수 2개만 CREATE OR REPLACE 한다. 서명·출력 열·STABLE SECURITY DEFINER·빈 search_path와 기존 ACL을 유지한다.

management_application_rows의 managed_orgs MATERIALIZED CTE는 `(select life_private.person_id())`를 한 번 평가하고, 현재 유효한 COURSE_MANAGER 역할의 org_id를 DISTINCT로 읽는다. valid_from<=now(), valid_until IS NULL OR >now()는 has_role의 조건과 같다. managed_offerings MATERIALIZED CTE는 operational_offerings와 이 기관 범위를 조인한다.

원서 documents CTE는 기존 APPLICATION/deleted_at/operational_offering 필터 및 person/offering별 상태 우선순위·최신 정렬을 보존한다. 연결된 원서는 managed_offerings에서 존재 여부를 확인하고, 미연결 원서는 managed_orgs에서 d.org_id를 확인한다. 원래의 연결 원서 권한 기준은 d.org_id가 아닌 과정 소속이므로 이를 유지한다. application 본문은 managed_offerings와 조인하며 UNION ALL, 원서 position=1, 기존 신청과 중복 제거를 그대로 둔다. 이름·active·등록 상태·문서 상태는 원래 테이블에서 그대로 반환한다.

management_courses도 같은 managed_orgs CTE를 사용하고 operational_offerings와 조인한다. JSON 키·starts_on desc/name 정렬은 유지한다. 시스템 관리자 단독은 COURSE_MANAGER를 대신할 수 없다. 미래/만료 역할과 비활성 사용자·MFA 상태는 기존 person_id/has_role의 의미와 같다.

## 검증 및 배포

전용 로컬 DB 트랜잭션에서 최신 선행 마이그레이션과 fixture를 적용한다. 기존 두 함수를 pg_temp에 복제하고 변경 전 목록 RPC 결과를 저장한다. 여러 기관/만료/미래 역할, 페이지·검색·상태, 미연결 원서와 거절 이력, 숨김 과정, 일반 사용자·MFA 미충족을 대조한다. 8쌍 교차 실행(첫 쌍 제외)으로 이전/새 읽기 경로를 측정한다. 원본 데이터 해시를 비교하고 ROLLBACK 한다. 시간 임계값을 CI 테스트의 flaky 조건으로 쓰지 않는다.

운영 원본·함수/ACL·보안 Advisor를 기준선으로 보존하고 Preview 전체 마이그레이션을 검증한 뒤 정확한 새 파일만 드리프트 가드와 함께 원자적으로 적용한다. 앱 변경 없이 기존 운영 RPC에서 즉시 사용된다. PR 검사를 통과한 head를 병합하고 자동 운영 배포의 revision/health와 실제 로그인 목록을 검증한다.

참고: [Supabase 쿼리 통계](https://supabase.com/docs/guides/database/extensions/pg_stat_statements), [PostgreSQL CTE materialization](https://www.postgresql.org/docs/17/queries-with.html).

기존 공개 성능·workspace 회귀의 독립 모듈 로더도 현재 TS/TSX 의존 경로를 읽도록 보완한다. 이전 UI 변경으로 생긴 alias/상대 import 누락을 해소하며 assertion과 운영 앱 소스는 변경하지 않는다.
