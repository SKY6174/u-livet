# 운영 DB 준비 분석

2026-09-19 · `anchor-production-db-preparation` · 설계 검증 6/6 완료(범위 충족률 100%)

## 결과

| 설계 항목 | 판정 | 실제 근거 |
| --- | --- | --- |
| 이력/의존 함수 비교 | 통과 | 운영 24개와 Preview 공통 이력의 이름·SQL MD5가 동일. 의존 함수 4개 정의 MD5 동일 |
| 운영 부분 적용 검사 | 통과 | 보고서 migration 이력 없음. 테이블 2개/함수 11개/정책/트리거 모두 없음 |
| 중복 파일 정리 | 통과 | ` 2.sql` 사본 10개와 canonical 원본이 바이트 단위 동일. 사본만 제거, 원본 25개 고유 버전 유지 |
| 실제 CLI dry-run | 통과 | 설치 CLI 2.115.0, 명시적 운영 ref, include-all/skip-vault. 정리 전 11개→정리 후 보고서 migration 1개 |
| 적용 목록/SQL 확정 | 통과 | Preview 저장 SQL MD5가 로컬 보고서 파일과 같음. SHA-256 및 실행/복구 절차 기록 |
| 점검/회귀/보안 | 통과 | 읽기 전용 SQL 양쪽 실행, Preview RLS/RPC/MFA 검증. test:release 111개 통과. 양쪽 Advisor WARN/ERROR 0 |

## 중요한 발견

기존 저장소의 동일 버전 SQL 사본 10개로 인해 CLI가 운영에 이미 적용된 migration을 다시 실행 대상으로 표시했다.
운영 적용 명령을 실행하기 전 dry-run에서 발견했으며, 본문이 동일한 사본만 제거했다.
원격 이력이나 이미 적용된 canonical SQL의 내용을 수정하지 않았다.

누락 파일은 `20260919043637_anchor_course_reports.sql` 하나이고, 기존 최종 이력 `20260919053031_anchor_kakao_signup`보다 이르다.
따라서 `--include-all`을 사용하되 목록이 1개임을 사전에 확인한다.

## DB 증거

- 운영 기준: Auth 사용자 1명 / 과정 0개 / 조직 1개. Preview: Auth 3명 / 과정 0개 / 조직 1개.
- 양쪽 비활성 custom trigger 0개.
- Preview 보고서 테이블 2개는 RLS 활성, anon/authenticated 직접 SELECT 불가.
- public RPC 4개는 invoker이며 authenticated만 실행 가능. private 검증 함수 3개는 authenticated 직접 실행 불가.
- private 업무 함수 4개는 auth.uid 및 과정 관리자 범위를 검사하고, 2개 쓰기 트리거가 최근 MFA를 검사한다.
- 운영/Preview 보안 Advisor: WARN/ERROR 0, `rls_enabled_no_policy` INFO 각 65건. 넓은 허용 정책을 추가하지 않는다.
- 보고서 추가 SQL은 기존 행의 삭제/갱신을 실행하지 않는다. 운영 코드 `e7d3c8e`를 먼저 변경할 필요가 없다.
- 운영 `/api/version`은 production/e7d3c8e, `/api/health`는 healthy 유지.

[정책 없음 INFO 설명](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)

## 백업과 범위

최신 관리형 일일 백업은 2026-09-18T22:26:40.832Z 완료 상태이며 PITR은 비활성이다.
현재 public/life_private 스키마를 0600 파일로 덤프했고, 첫 SSL EOF 이후 재시도 exit 0을 확인했다.
덤프는 623,556 bytes이며 실제 사용자 행은 포함하지 않는다. 이는 전체 데이터 복원 검증이 아니다.

이번 작업은 사본 정리·읽기 전용 점검 SQL·실행 자료 작성이다.
운영 업무 schema migration과 main 병합/Production 재배포는 실행하지 않았다.

## 다음 단계

[확정 실행 절차](../../docs/operations/production-course-reports-migration.md)에 따라 운영 DB에 보고서 migration 1개를 적용하고 사후 검증한다.
그 후 별도 Production 앱 통합/배포 단계를 진행한다.
