# Supabase 인증 사전 검증 결과

2026-09-19 · `anchor-hosted-auth-preflight`

**ANCHOR → uc-life를 확인했고 읽기 전용 구조 점검 및 인증 설정 검사 도구를 준비했다. 실제 Preview 인증 인수 검증은 아직 미완료다.** MCP에는 SKY6174만, CLI에는 ANCHOR까지 보여 초기 목록이 달랐다.

## 실제 uc-life 확인

- Project ref: `uoebygejgglgiivzgyks`, ACTIVE_HEALTHY.
- 별도 Preview 없이 main만 있음. 브랜치 메타데이터에 MIGRATIONS_FAILED 표시; 원인 미확인.
- migration 001~008만 적용됨. 저장소 22개 중 14개는 아직 원격 이력에 없음.
- 인증 의존 컬럼19개 모두 존재. 새 복구·MFA 트리거4개는 없음.
- postgres의 대상 테이블 SELECT/TRIGGER 권한은 true. 실제 생성·동작이나 공급자 지원을 보장하는 결과는 아님.

사용자·세션·비밀번호 해시·감사 로그의 데이터 행을 조회하지 않았다. 원격 앱 데이터/schema/Auth 설정을 변경하거나 실제 메일을 보내지 않았다.

## 준비한 결과물

`check:hosted-auth`는 비밀을 출력하지 않는 설정 비교 도구다. 오프라인 설정 파일 또는 명시한 별도 Preview에 대한 Management API GET을 사용한다. API 응답 크기/시간/redirect를 제한하고 현재 확정 비밀번호 조건을 완화하지 않는다. 설정 비교 성공도 실제 동작 검증이 남은 상태로 표시한다.

`inspect-hosted-auth.sql`은 의존 컬럼/타입·권한·트리거 메타데이터만 읽는다. 이번에 로컬과 원격 uc-life에서 실행했다. [사용법과 실제 인수 절차](../../operations/supabase-auth-compatibility.md)에 명령, 공급자 확인 사항, 직접 API 검증 행렬을 정리했다.

검증: 신규 **70개** + 기존 배포 준비 **111개** 통과. lint·문법·변경 공백 검사 통과. [설계 대조 및 증거 링크](../../03-analysis/anchor-hosted-auth-preflight.analysis.md).

## 운영 적용 전 필요한 결정

1. 현재 공개 Management API 프리셋에는 확정한 ‘대소문자를 구분하지 않는 영문+숫자+특수문자’ 조합이 없다. native 강제를 위한 지원 방식 확인 또는 인증 구성 재설계가 필요하다. [공식 API](https://supabase.com/docs/reference/api/v1-update-auth-service-config)
2. 현재 복구 구현은 DB 감사 이벤트에 의존한다. DB 저장 활성 및 동일 transaction 이벤트 처리를 실제로 검증해야 한다. [공식 감사 로그 안내](https://supabase.com/docs/guides/auth/audit-logs)
3. 실제 Auth 설정 조회는 이번에 하지 못했다. 브라우저는 로그인 필요 상태이며 검사 도구용 프로세스 토큰이 없다. 비밀값을 채팅에 제공할 필요는 없다.
4. 별도 Preview를 준비하고 branch migration 실패 원인·관리형 MFA 트리거 지원·native 인증 행동을 검증한 후 승인된 migration을 적용해야 한다. 기존 main에 미적용 migration을 무조건 적용하지 않았다.

**bkit:** 사전 검사 도구 `anchor-hosted-auth-preflight` Report 완료. 실제 hosted 인수는 대기. 다음 단계는 uc-life의 실패한 migration 원인 확인과 확정 비밀번호 기준을 지키는 운영 인증 방식 결정이다.
