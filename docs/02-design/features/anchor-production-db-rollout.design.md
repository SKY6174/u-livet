# 운영 보고서 DB 적용 설계

2026-09-19 · `anchor-production-db-rollout`

[준비 설계](anchor-production-db-preparation.design.md)와 [실행 절차](../../operations/production-course-reports-migration.md)를 따른다. 원본 SQL은 수정하지 않는다.

## 실행 경계

1. 운영 migration 24개·보고서 객체 없음, canonical SQL/스키마 덤프 지문, 관리형 백업 완료를 확인한다.
2. 명시적 운영 ref로 dry-run 후 정확히 보고서 migration 1개일 때 `db push --include-all --skip-vault --yes`를 실행한다.
3. 실패하면 다시 실행하기 전에 실제 객체와 이력을 대조한다. 기존 데이터나 이력을 임의로 되돌리지 않는다.

## 사후 검증

1. `ops/production-course-reports-check.sql`: 이력 25개, 테이블 2개·함수 11개·정책 2개·MFA 트리거 2개.
2. Preview와 보고서 함수·컬럼·제약·인덱스 정의를 비교한다. 저장 이력의 문자열 형식 차이는 실제 catalog와 구분한다.
3. 추가 적용 목록이 없고 기존 사용자/과정/조직 계수가 유지됨을 확인한다.
4. 실제 익명 REST 요청으로 보고서 조회·쓰기 RPC와 테이블 직접 조회가 거부됨을 확인한다. 사용자 로그인이나 보고서 저장은 수행하지 않는다.
5. Security Advisor의 새 WARN/ERROR가 없고 운영 홈·로그인·health·version이 정상인지 확인한다.

운영 앱의 인증된 전체 업무 검증은 Production 앱 배포 후에 진행한다. 이번 결과를 그 검증까지 완료한 것으로 표시하지 않는다.
