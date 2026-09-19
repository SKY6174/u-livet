# 운영 보고서 DB 적용 계획

2026-09-19 · `anchor-production-db-rollout`

사용자가 준비 완료 후 다음 단계 진행을 요청했다. 확정된 보고서 migration 1개를 운영에 적용하고 사후 검증한다.

- 대상: `uoebygejgglgiivzgyks`.
- 파일: `20260919043637_anchor_course_reports.sql`, SHA-256 `a77f8360260942e0010f59a9c2a469426e3a7417c35b4c4b68b0be2957e2fe43`.
- 적용 전 이력·부분 객체·백업·dry-run 목록을 다시 확인한다.
- 공식 CLI로 확정 파일을 적용하고 이력 25개, 미적용 0개를 확인한다.
- Preview와 객체 정의/권한을 비교하고 운영 RLS·MFA 트리거·익명 접근 제한 및 사이트 상태를 점검한다.
- 실제 사용자 자료를 추가·변경하거나 운영 앱을 배포하는 것은 후속 단계이다.

적용·복구 기준: [확정 절차](../../operations/production-course-reports-migration.md).
