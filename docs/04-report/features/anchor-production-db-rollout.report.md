# 운영 보고서 DB 적용 완료

2026-09-19 15:14 KST · `anchor-production-db-rollout`

운영 Supabase `uoebygejgglgiivzgyks`에 보고서 migration `20260919043637_anchor_course_reports` 1개를 적용했다.
이력은 24→25개가 됐고, 후속 dry-run에서 추가 적용할 항목이 없음을 확인했다.

- 보고서·첨부 테이블 2개와 관련 함수 11개, 정책 2개, MFA 쓰기 트리거 2개 확인.
- 함수·컬럼·제약·인덱스 정의가 검증된 Preview와 동일.
- 익명 RPC/테이블 접근 6건 모두 거부. 기존 RLS·역할 제한과 MFA 보호 구성 확인.
- Security Advisor 새 WARN/ERROR 0. 운영 홈·로그인·health·version 정상.
- 기존 Auth 1명·과정 0개·조직 1개 유지, 신규 보고서/첨부는 각 0개.

기존 운영 앱 `e7d3c8e`는 유지했다. 실제 운영 사용자 로그인과 보고서 저장 전체 검증은 앱 배포 후에 진행한다.

다음은 **4단계: preview→main 통합과 Production 앱 배포**다.

[분석 근거](../../03-analysis/anchor-production-db-rollout.analysis.md) · [실행·복구 절차](../../operations/production-course-reports-migration.md)
