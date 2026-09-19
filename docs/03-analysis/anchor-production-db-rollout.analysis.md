# 운영 보고서 DB 적용 분석: 통과

2026-09-19 15:14 KST · `anchor-production-db-rollout` · 설계 사후 검증 5/5 완료

## 적용

- 운영 DB: `uoebygejgglgiivzgyks`.
- 기준 코드: `aed73b9`, canonical SQL SHA-256 `a77f8360260942e0010f59a9c2a469426e3a7417c35b4c4b68b0be2957e2fe43`.
- 적용 파일: `20260919043637_anchor_course_reports.sql`.
- 재확인한 사전 상태: migration 24개, 보고서 객체 없음, 기존 Auth 1명·과정 0개·조직 1개.
- 0600 스키마 덤프 지문이 준비 당시 값과 일치했고 관리형 일일 백업 2개가 COMPLETED였다. 최신 2026-09-18T22:26:40.832Z, PITR 비활성.
- 공식 CLI `supabase db push --project-ref uoebygejgglgiivzgyks --include-all --skip-vault --yes` 실행. 보고서 파일 1개 적용, exit 0. seed/role/Vault 변경 없음.

## 사후 검증

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| 이력·필수 객체 | 통과 | migration 25개, 대상 applied=true, 테이블 2개·함수 11개·정책 2개·MFA 트리거 2개 |
| Preview 정의 일치 | 통과 | 보고서 함수 11개 정의 MD5, 컬럼 15개, 제약 13개, 인덱스 4개가 Preview와 동일 |
| 적용 완료·기존 상태 | 통과 | 후속 dry-run upToDate=true, migrations=[]; 의존 함수 4개 정의와 Auth/과정/조직 계수 유지 |
| 익명 접근 거부 | 통과 | RPC 4개와 테이블 직접 조회 2개 모두 HTTP 401 / PostgreSQL 42501 |
| 보안·운영 사이트 | 통과 | Security Advisor 새 WARN/ERROR 0. 홈·로그인·health·version 200, health=healthy |

## 권한과 무결성

- 테이블 2개 모두 RLS 활성, anon/authenticated 직접 SELECT 권한 없음.
- 함수 11개 모두 anon 실행 불가, 고정된 빈 search_path.
- public RPC 4개는 SECURITY INVOKER이며 authenticated 실행 가능.
- private 검증 함수 3개는 authenticated 직접 실행 불가. 업무 함수 4개는 auth.uid 및 과정 관리자 범위를 확인한다.
- SELECT 정책 2개는 `life_private.manages(offering_id)`, 쓰기 트리거 2개는 활성 `life_private.recent_mfa_write_guard()`를 사용한다.
- 기존 관리 함수 `manages`, `person_id`, `completion_board`, `recent_mfa_write_guard` 정의는 적용 전과 동일하다.
- 익명 검사: `life_course_report`, `life_save_course_report`, `life_save_report_file`, `life_report_file`, `life_course_reports`, `life_report_files`. 모든 요청이 거부됐고 보고서/첨부 행은 각각 0개다.
- 기존 데이터 계수: Auth 1→1, 과정 0→0, 조직 1→1. 신규 사용자·과정·운영 보고서를 만들지 않았다.
- Advisor의 기존 `rls_enabled_no_policy` INFO 65건은 유지됐다. [설명](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## 검증 범위와 후속

운영 앱은 계속 `e7d3c8ea7492bcea8bb9c40077477bd903f7819f`, environment=production, managed-cloud-v1이다.
이번 단계에서는 main 병합이나 앱 재배포를 하지 않았다. 운영의 실제 사용자 로그인·MFA 동작·보고서 저장 전체 흐름을 완료했다고 주장하지 않는다.
MFA는 DB 트리거 구성과 Preview와의 정의 일치를 검증했고, 실제 인증 업무 흐름은 앞선 Preview 통합 검증에서 확인했다.

다음은 검증된 Preview를 main에 통합하고 Production 설정으로 새로 빌드하는 단계다.
배포 후 운영 로그인·역할별 업무·보고서 기능을 별도로 확인한다.
