# Supabase 인증 사전 검사 설계 대조

2026-09-19 · `anchor-hosted-auth-preflight`

도구 준비 설계 9/9 항목 충족. 이는 실제 hosted 인증의 호환성 통과율이 아니다. **원격 인수 검증은 미완료**다.

| 설계 항목 | 확인 |
|---|---|
| 정확한 비밀번호 설정 비교 | 길이 12 및 로컬 사용자 지정 문자 집합 일치, 공개 API 프리셋 거부 |
| 메일·복구·CAPTCHA·TOTP 비교 | 누락/형식/설정 불일치 거부 |
| 명시적 live 대상 검사 | preview/production ref 구분, HTTPS origin, 토큰 누락 시 요청 없음 |
| GET 전용 네트워크 경계 | 고정 호스트·한 번 GET·redirect 거부·10초·1 MiB 제한, fetch stub 검증 |
| 비밀 출력 방지 | 원문 설정/토큰/공급자 오류/파일 경로 미출력, unknown 키도 출력 안 함 |
| CLI 오프라인 기본 | 모드 미지정/혼합 거부, `.env.local` 자동 로드 없음, 제한된 JSON 파일 |
| 메타데이터 SQL | pg_catalog SELECT만, 로컬과 원격에서 실행, 개인 데이터 행 미조회 |
| 판정 한계 | 설정 통과에도 CONFIG_MATCH_RUNTIME_PENDING과 4개 미검증 영역 표시 |
| 실제 대상·지원 차이 문서화 | ANCHOR/uc-life 식별, 8개 적용/별도 Preview 없음, API enum·감사 DB·트리거 지원 검토 |

## 검증

- 합성 설정·fetch stub·CLI 임시 파일 **70개 통과**: [결과](../04-report/features/evidence/hosted-auth-tests.txt).
- 기존 release-readiness **111개 통과**: [결과](../04-report/features/evidence/hosted-auth-release-regression.txt).
- [빈 설정 예시](../04-report/features/evidence/hosted-auth-example-blocked.json)는 예상대로 종료1 및 CONFIG_BLOCKED.
- [로컬 메타데이터](../04-report/features/evidence/hosted-auth-local-catalog.json): 컬럼19개/연결 함수가 일치하는 활성 트리거4개.
- [uc-life 원격 메타데이터](../04-report/features/evidence/hosted-auth-uc-life-catalog.json): 컬럼19개, 트리거4개 미설치. postgres SELECT/TRIGGER 권한은 true이나 runtime/지원 보장은 아님.
- lint, mjs3개 문법, git diff --check 통과. 앱 UI/업무 schema 변경이 없어 production build 및 기존 업무 E2E는 재실행하지 않았다.

## 발견 및 경계

MCP와 CLI의 조직 접근 범위가 달랐다. 사용자의 ANCHOR/uc-life 지정을 반영해 CLI로 대상 확인 후 SELECT만 실행했다. CLI의 --project-ref 조회에는 --linked가 함께 필요하여 명령 안내를 수정했다. 원격은 001~008 적용이며 main 브랜치에는 MIGRATIONS_FAILED 메타데이터가 있다. 실패 원인을 확인하거나 수정한 것으로 기록하지 않는다.

이번 공개 API 스펙에는 확정 비밀번호 조합이 없고 DB 감사 저장 옵션도 노출되지 않는다. 실제 Auth 설정을 GET한 것은 아니며 브라우저는 로그인 필요 상태였다. 관리형 MFA 트리거의 실제 생성/동작, 감사 이벤트 transaction, native 비밀번호·복구·MFA 행동 시험은 별도 Preview가 준비된 뒤 진행해야 한다. 인증 구조나 사용자 기준을 임의로 바꾸지 않았다.
