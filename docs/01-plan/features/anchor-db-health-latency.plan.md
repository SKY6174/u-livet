# DB 연결·응답속도 점검과 상태 확인 경량화

2026-09-27 · anchor-db-health-latency

## 목표

운영·스테이징 Supabase 연결과 공개 경로의 응답속도를 확인하고, 측정으로 입증되는 작은 병목을 줄인다. 운영 데이터·권한·스키마는 유지한다.

## 진단 근거

- 두 DB가 읽기 SQL에 응답하며 활성 상태이고, 잠금 대기 0건이다.
- 운영 `/api/health`는 `life_catalog` 복합 뷰를 읽는다. 운영 누적 SQL 평균은 이 뷰 약 34.1ms, 공개 `life_course_guides` 테이블 약 0.5ms다. 같은 클라이언트의 공개 REST 6쌍 중앙값은 각각 224.8ms와 135.0ms다.
- 기존 `life_operation_list` 및 `life_identity` 최적화는 이미 main과 운영·스테이징 DB에 있다. 누적 SQL 통계에는 변경 전 실행도 포함되므로 현재 회귀의 증거로 해석하지 않는다.
- 운영 `/api/health`, `/courses`, `/auth/login`을 7회씩 읽었고 모두 200이었다. 중앙값은 288.7ms, 283.0ms, 110.0ms다. 사용자 인증 후 화면은 이번 익명 측정에 포함되지 않는다.

## 범위와 성공 기준

- `/api/health`의 DB 연결 확인 쿼리를 같은 공개 RLS가 적용된 `life_course_guides`의 `id` 1건 조회로 교체한다.
- 응답 JSON, 200/503, `no-store` 동작을 유지한다.
- 수정 전후 프로덕션 상태 확인 응답을 반복 측정하고, 빌드·회귀 검사를 실행한다.
- Supabase 성능 advisor의 광범위한 RLS·인덱스 권고는 현재 작은 테이블 규모와 권한 영향도를 따져 별도 변경으로 다룬다.
