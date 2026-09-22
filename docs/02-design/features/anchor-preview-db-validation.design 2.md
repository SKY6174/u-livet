# anchor-preview-db-validation 설계

2026-09-19. 계획: `docs/01-plan/features/anchor-preview-db-validation.plan.md`.

## 대상과 적용 경계

부모 ref `uoebygejgglgiivzgyks`, Preview ref `bfqwntulxabfrimcypvx`. 매 실행 전 branch API에서 부모·이름·비기본 브랜치·데이터 미복사·ACTIVE_HEALTHY를 확인한다. 001~008 이력과 회원/프로필/수강신청/Storage 0건을 전제로 한다.

## 마이그레이션 실행

1. 전용 임시 작업 디렉터리에 최소 config와 001부터 `20260918174631_anchor_instructor_development.sql`까지의 기존 파일 사본을 준비한다. 각 파일 SHA-256을 원본과 대조한다. 본 작업 폴더/환경 파일을 변경하지 않는다.
2. CLI `db push --linked --project-ref <preview> --skip-vault --dry-run`으로 대상 11개만 나오는지 확인한다. seed/custom roles/vault를 적용하지 않는다. 파일/대상/원격 이력이 바뀌면 중단한다.
3. 동일 디렉터리에서 실제 push한다. 공식 CLI의 migration 버전 기록을 사용하고 수동 migration repair를 하지 않는다.
4. 실패하면 적용 이력과 실제 오류를 확인한다. 무조건 재실행·reset하지 않는다.
5. 최종 이력이 원래 19개 버전과 일치하는지, 3개 Auth migration이 없는지 확인한다.

## 검증

- public life_ 테이블 전체 RLS 활성, 새 private 테이블 RLS 및 스키마 권한 확인.
- 기존 non-life 테이블의 anon/authenticated SELECT/쓰기 권한과 기존 privileged RPC 실행 권한 회수 확인.
- 브라우저용 life_ 공개 RPC는 invoker, 권한이 필요한 내부 함수는 private schema와 고정 search_path인지 확인. 기존 증명서 서버 작업용 public definer 3개(claim/fail/finish)는 고정 search_path 및 service_role 전용 실행 권한을 확인한다.
- 현재 회원/학습자/승인 개인정보 정책 0건 유지, 기본 조직/사업연차 외 시험 자료 없음 확인.
- 익명 공개 조회는 빈 결과, 인증 없는 업무 RPC는 거부되는지 확인한다. 최초 SQL transaction 방식은 Management API의 SET ROLE 제한으로 실행할 수 없어 실제 공개 anon 키를 사용하는 REST 시험으로 대체했다. 인증된 사용자 세션 시험은 별도 인수 범위로 남긴다. API 토큰을 위조하거나 기존 로컬 테스트의 보호 조건을 제거하지 않는다.
- main migration 이력은 001~008 유지 확인. Advisor 결과는 실제 관측대로 기록한다.

## 인증 서버 운영 설계

사용자가 별도 인증 서버 방향을 선택했다. 운영 리소스를 만들지 않고 다음을 설계한다: 배치와 신뢰 경계, native 비밀번호 조건, 세션/감사/MFA DB의 위치, HTTPS/CORS/redirect, 비밀 관리, SMTP/CAPTCHA, 백업·복구·업데이트·장애 대응, Cloud 업무 DB 유지 시 필요한 어댑터/이관 범위. 공급자 문서의 현재 지원 범위를 확인한다.

현재 구현은 auth.users FK, auth.sessions/AMR 참조, password audit와 MFA factor 트리거를 사용하므로 Cloud Auth만 별도 서버로 바꾸는 것을 설정 변경 수준으로 설명하지 않는다. 별도 서버 비용이나 실제 배포는 이 설계 완료에 포함하지 않는다.
