# DB 연결 및 응답 개선 설계

2026-10-07 · db-connectivity-response-oct07

## Auth 조회

실제 Next production RSC 측정에서 기존 Auth HTTP 읽기가 요청당 1회였다. 이 경로에는 코드 변경을 적용하지 않으며 현재 서버 인증 검증, 오류 처리, middleware 갱신과 요청별 격리를 유지한다.

## 원서 등록 현황 일괄 조회

- 기존 my/admin base 함수가 반환한 문서 ID만 입력으로 받는 private batch helper를 추가한다.
- 대상 문서를 materialized CTE로 한 번 읽고 수강생/기수별 상태를 계산한다. 관리자 기수 권한은 기수별 한 번, MFA 확인은 요청당 한 번 계산한다.
- 기존 단건 helper와 모든 registration JSON 필드, null/false 값, 목록 순서를 동일하게 유지한다.
- my/admin wrapper는 기존 권한 검사·필터·건수 제한·events/PDF/처리자 필드를 그대로 사용하고 registration만 batch 결과로 확장한다.
- 기존 관리 가능한 기수 목록의 표시 조건은 유지한다.
- helper는 SECURITY DEFINER와 빈 search_path를 쓰며 public/anon/authenticated/service_role의 직접 실행을 모두 revoke한다. 공개 RPC와 기존 함수 권한은 변경하지 않는다.

## 검증

- 전용 uc-life-issues DB, synthetic native Auth JWT로 이전/개선 registration과 전체 my/admin 응답을 비교한다. 여러 기수/기관/등록·원서 상태/빈 값과 다른 사용자 접근을 포함한다.
- 합성 문서 반복 상황에서 SQL 실행 순서를 번갈아 측정하고 첫 실행을 제외한다. 시험 자료는 트랜잭션에서 롤백한다.
- 실제 Next production 브라우저에서 로그인 후 원서 및 등록 현황을 확인한다.
- 기존 원서 경계와 실제 PDF 접수 회귀, lint/build를 확인한다.
- 운영 orphan/FK와 상태 연결 검사, advisors, DB dry-run을 거쳐 migration을 적용하고 함수 정의/권한 및 배포 revision/health를 확인한다.

공식 참고: [React cache](https://react.dev/reference/react/cache), [Supabase RLS 성능](https://supabase.com/docs/guides/database/postgres/row-level-security-performance), [DB 통계](https://supabase.com/docs/guides/observability/inspect).
