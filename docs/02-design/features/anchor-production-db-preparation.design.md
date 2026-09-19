# 운영 DB 마이그레이션 준비 설계

- 기능: `anchor-production-db-preparation`
- 운영: `uoebygejgglgiivzgyks`; Preview: `bfqwntulxabfrimcypvx`.

## 검증과 정리

1. 공통 migration 이력의 이름·SQL 지문과 보고서 의존 함수 정의를 비교한다.
2. 운영 보고서 테이블/함수가 아직 없음을 확인한다. 부분 적용이면 진행하지 않는다.
3. 원본과 같은 내용의 `supabase/migrations/* 2.sql` 10개만 제거한다. 나머지 파일과 원격 migration 이력을 바꾸지 않는다.
4. 설치된 CLI 도움말을 기준으로 운영 ref를 명시한 `db push --dry-run --include-all --skip-vault`를 실행한다.
5. 모의 실행 결과가 정확히 `20260919043637_anchor_course_reports.sql` 하나인지 확인한다.
6. 릴리스 지문 생성·관련 회귀 검사와 운영/Preview 보안 Advisor를 확인한다.

## 적용 대상

- 보고서/첨부 테이블 2개, RLS 정책 2개, public invoker RPC 4개와 private 함수 7개, MFA 쓰기 트리거 2개.
- 기존 테이블/함수 변경 또는 기존 행 갱신은 없고, 보고서 기능을 위한 객체를 추가한다.
- 후속 카카오 migration이 이미 운영에 있으므로 시간상 앞선 누락 항목에는 `--include-all`이 필요하다. 최신 이력을 되돌리거나 repair로 건너뛰지 않는다.
- 적용 대상 파일은 `begin`/`commit`으로 묶여 있다. 이미 적용된 파일을 재실행하지 않는다.

## 실행 및 복구 자료

- 데이터 없는 스키마 백업과 관리형 백업 가용성을 확인한다. 실제 사용자 자료는 로컬 개발 DB로 복사하지 않는다.
- 적용 명령은 준비 문서에 기록하고, 이번 단계에서는 dry-run만 실행한다.
- 읽기 전용 점검 SQL은 이력·객체·권한·의존 함수·사용자 계수만 출력한다.
- 적용 중 실패하면 신규 객체와 이력이 없는지 확인한 후 재진단한다. 앱 문제는 이전 앱 유지/복귀를 우선하며 보고서 데이터가 생긴 테이블을 자동 삭제하지 않는다.
- 성공 후 같은 SQL로 이력 25개·RLS·RPC 권한·MFA 트리거를 확인하고, 이어서 Production 환경으로 앱을 다시 빌드한다.
