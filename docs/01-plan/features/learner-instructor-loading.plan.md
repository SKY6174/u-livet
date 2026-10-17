# 수강생·강사 조회 속도 점검 계획

2026-10-17 · learner-instructor-loading

## 목적과 기준선

수강생 홈·내 학습·강의실·출석·시험과 강사 My Room·담당 강의실·출석·실적의 데이터 경로를 점검한다. 운영 pg_stat_statements에서 my_learning 86회 평균 91.40ms, completion_history 56회 59.33ms, teaching_attendance 40회 55.79ms, qr_checkins 40회 53.39ms가 관찰됐다. 누적 통계는 과거 배포와 역할이 섞인 진단 자료이며 전후 효과 수치로 사용하지 않는다. DB 연결 22개, 잠금 대기·무효 인덱스는 0이다.

## 범위

- 강의실 질문과 출석/QR의 독립 조회를 병렬화하고, 시험 화면에서 사용하지 않는 QR 조회를 생략한다.
- 수료 이력과 강사 요약의 반복 신원·기관 역할 확인을 호출 안에서 한 번 계산한다. 운영 데이터 분류와 본인/기관 범위, 역할·배정 유효기간, 기존 반환 필드를 보존한다.
- 실제 운영 역할 세션을 확보하면 화면 본문 표시까지 동일 브라우저에서 반복 측정한다. 현재 세션은 관리자이며 수강생·강사 화면 검증을 대신할 수 없다. 계정 전환은 사용자에게 요청했고 DB·로컬 검증을 계속한다.

## 성공 조건

이전/새 SQL의 동일 결과·오류를 실제 로컬 역할/RLS와 합성 이력으로 대조한다. 교차 실행 첫 쌍 제외 중앙값을 측정하고 fixture는 전부 ROLLBACK 한다. 실제 Supabase query builder와 제어된 지연/동기화 테스트로 병렬 시작, 호출 수 감소, 오류·무권한 처리를 검증한다. 시간 임계값은 테스트 통과 조건으로 사용하지 않는다.

원본 이력·함수 권한·RLS를 보존하고 lint/빌드·관련 회귀 및 설계 대조를 통과한다. 독립 Preview 전체 migration, PR 검사, 정확한 head 병합, 운영 migration·자동 배포의 revision/health를 확인한다. 운영 화면 검증이 불가능한 역할은 제한을 보고한다.

## 참고

기존 learner-instructor-summary, anchor-learner-home-focus, operational-academic-records 및 admin-loading-optimization 설계를 따른다. Supabase/PostgreSQL 성능 지침에 따라 행과 무관한 신원 조회만 1회 계산하며 사용자별 데이터를 공유 캐시에 넣지 않는다.
