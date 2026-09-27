# DB 연결·상태 확인 경량화 검증

2026-09-27 · anchor-db-health-latency

## 설계 일치: 6/6 (100%)

| 확인 항목 | 결과 |
| --- | --- |
| 운영·스테이징 DB read-only SQL 연결 | 양쪽 정상 |
| 쿼리 변경을 공개 `life_course_guides`의 `id` 1건으로 제한 | 코드 diff 확인 |
| 기존 200/503 JSON과 `no-store` 유지 | 코드 diff·로컬 실행 확인 |
| 공개 RLS·권한 유지 | 익명 REST 조회 6/6 HTTP 200, migration의 공개 SELECT 정책 확인 |
| 스키마·RLS·데이터 수정 없음 | 마이그레이션 없음 |
| 정적 검사·실행 | lint·TypeScript·Next 빌드 통과, 로컬 프로덕션 서버 health 7/7 HTTP 200 |

## 측정

운영 공개 REST에서 같은 클라이언트로 6쌍 교차 실행: 기존 `life_catalog` 중앙값 224.8ms, 대안 `life_course_guides` 135.0ms. 운영 누적 SQL 평균은 각각 34.1ms(1106회), 0.5ms(461회)다. 이 통계는 과거 실행을 포함하며 사용자 화면의 개선율이 아니다. 로컬 프로덕션 서버에서 새 health 조회 7회 모두 200, 첫 요청 제외 중앙값 약 72.4ms다. 네트워크·지역·캐시 조건이 달라 이 로컬 수치를 운영의 기존 288.7ms와 직접 비교하지 않는다.

## 범위와 잔여 사항

운영 공개 경로 7회씩 측정한 기존 중앙값은 health 288.7ms, 과정 283.0ms, 로그인 110.0ms이며 21/21 성공했다. 인증 후 화면은 계정 세션 없이 측정하지 않았다. DB는 작은 규모(최대 140여 행)이며 인덱스·RLS 정책 일괄 변경은 이번 병목과 직접 연관성이 입증되지 않았다. 성능 advisor의 [RLS 함수 재평가](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan) 및 [중복 허용 정책](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies) 경고는 별도 권한 검증 후 다루어야 한다.
