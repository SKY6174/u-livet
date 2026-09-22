# 운영 DB 마이그레이션 준비 완료

2026-09-19 · `anchor-production-db-preparation`

운영 DB에 필요한 추가 migration은 `20260919043637_anchor_course_reports.sql` 1개다.
운영과 Preview의 공통 적용 이력 24개 및 의존 함수 정의가 일치하며, 운영에는 보고서 객체가 아직 없다.

## 변경과 확인

- 동일한 migration 사본 10개를 제거했다. 이로 인해 발생한 기존 migration 재실행 대상 표시를 해결했다.
- 원본 SQL 25개와 원격 이력은 유지했다. 운영 대상 dry-run은 이제 보고서 migration 1개만 표시한다.
- 적용 전/후에 사용할 읽기 전용 점검 SQL을 작성하고 두 DB에서 실행했다.
- Preview의 보고서 RLS, RPC 실행 권한, 최근 MFA 쓰기 트리거를 확인했다.
- 릴리스 검사 111개 통과. 보안 Advisor WARN/ERROR 0건.
- 관리형 백업 완료 상태와 현재 스키마 덤프를 확보했다. 실제 전체 데이터 복원 리허설은 하지 않았다.

운영 DB에 실제 SQL을 적용하거나 Production 앱을 재배포하지 않았다.

다음 작업은 준비한 보고서 migration 1개를 운영 DB에 적용하고 사후 점검하는 것이다.

- [적용·복구 절차](../../operations/production-course-reports-migration.md)
- [읽기 전용 점검 SQL](../../../ops/production-course-reports-check.sql)
- [분석 근거](../../03-analysis/anchor-production-db-preparation.analysis.md)
