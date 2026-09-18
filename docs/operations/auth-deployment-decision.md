# 운영 인증 구성 결정안

2026-09-19 · 결정 상태: 사용자가 **별도 인증 서버 운영 설계** 선택. [구체적인 운영 설계](self-hosted-auth-design.md) 작성 완료. 실제 서버 구매·DB 이관·운영 인증 변경·외부 문의 발송 없음.

## 유지할 요구사항

강사·관리자 ID는 이메일, 비밀번호는 12자 이상 + 영문·숫자·ASCII 특수문자이며 대문자와 소문자를 각각 요구하지 않는다. 성인 학습자를 위한 표시 전환과 실시간 조건 안내를 유지한다. 관리자 MFA와 복구·세션 회수도 함께 인수한다.

현재 uc-life 원격 설정은 6자 + 조합 없음이다. 단순히 길이를 12로 바꿔도 문자 조합 요구는 충족되지 않는다. 공개 관리 API 프리셋에는 영문 한 집합·숫자·특수문자를 묶은 정확한 조건이 없다. [Management API](https://supabase.com/docs/reference/api/v1-update-auth-service-config), [OpenAPI 명세](https://api.supabase.com/api/v1-json)

독립 Preview `bfqwntulxabfrimcypvx`에서 정확한 사용자 지정 문자 집합을 PATCH한 요청은 HTTP 400으로 거부됐다. 설정이 유지됨을 확인한 뒤 최소 길이만 12자로 변경했다. Preview는 12자 + 조합 없음, main은 6자 + 조합 없음이다. 이 부분 적용으로 문자 조합 문제가 해결됐다고 표시하지 않는다.

Preview 생성 준비 과정에서 ANCHOR 조직이 Pro임을 확인했다. 공개 OpenAPI의 읽기/수정 스키마를 다시 조회했으며 문자 조합 enum의 차이는 동일했다. 공식 Hook 안내는 Password Verification Attempt와 MFA Verification Attempt를 Teams/Enterprise 항목으로 분류한다. Pro에 이 Hook들이 기본 제공된다고 가정하지 않는다. 또한 이 두 Hook의 계약은 원문 비밀번호의 조합을 검사하는 계약이 아니므로 요금제 변경만으로 이번 조건이 해결된다고 판단하지 않는다. [Auth Hooks의 요금제별 지원](https://supabase.com/docs/guides/auth/auth-hooks)

## 선택지

| 방향 | 현재 구현과 관계 | 확정 전에 필요한 근거 |
|---|---|---|
| Vercel + Supabase Cloud 유지, 공급자가 지원하는 사용자 지정 native 정책 확보 | 비교용 대안. 현재 정확한 문자 집합 PATCH 거부 확인 | 정확한 문자 집합 정책, 가입·복구·변경 API 전체 강제, Auth 내부 트리거 지원, DB 감사 이벤트 보장 |
| Vercel + 별도 서버의 self-hosted Supabase | 선택한 설계 방향의 기본안. Auth와 업무 DB 공동 운영 제안 | 패치·백업·복구·모니터링·키 관리 담당자와 서버 비용, DB 운영 위치 확정 및 운영 규모 검증 |
| Vercel + Supabase Cloud DB + 다른 인증 서비스 | 별도 설계가 필요한 후보 | 정확한 정책 지원 공급자 검증, auth.users 외래키·JWT·RLS·복구 기록·MFA 모델 재설계 및 이관 |

사용자는 Cloud 지원 문의를 기다리는 대신 별도 인증 서버 운영 설계를 선택했다. 현재 SQL의 FK·세션·MFA·감사 의존성을 유지하기 위해 Auth와 업무 DB 공동 운영을 기본안으로 제안한다. **업무 DB 이관 실행은 아직 결정되지 않았다.** Cloud DB 유지 시 필요한 모델 변경은 운영 설계에 별도 비교했다. 대소문자 혼용을 강제하거나 프런트엔드 검사만으로 요구사항을 대신하지 않는다.

## Auth Hook만으로 해결된다고 볼 수 없는 이유

Password Verification Hook 입력은 사용자 ID와 비밀번호 검증 성공 여부다. 원문 비밀번호를 받아 문자 조합을 검사하는 가입/재설정 Hook이 아니다. Before User Created Hook은 새 사용자 생성 전 검사이며 기존 사용자의 비밀번호 변경 전체를 다루지 않는다. 따라서 이 두 Hook을 그대로 쓰면 요구사항을 전부 강제할 수 있다는 주장은 현재 문서에서 뒷받침되지 않는다. [Password Verification Hook](https://supabase.com/docs/guides/auth/auth-hooks/password-verification-hook), [Before User Created Hook](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook)

## 공급자 문의 초안 — 발송하지 않음

> Supabase Cloud 프로젝트에서 비밀번호 최소 12자, 영문(A–Z 또는 a–z 중 하나 이상), 숫자, ASCII 특수문자를 각각 포함하도록 강제하려 합니다. 대문자와 소문자를 동시에 요구하면 안 됩니다. 공개 Management API enum 외에 공식 지원되는 사용자 지정 문자 집합 또는 동등한 강제 수단이 있나요? 가입·일반 변경·복구 후 변경·직접 Auth API 호출 모두에서 동일하게 적용되어야 합니다.
>
> 현재 복구와 MFA 구현은 auth.users, auth.audit_log_entries, auth.mfa_factors의 이벤트/트리거 및 세션 참조를 사용합니다. 관리형 서비스에서 허용되는 사용자 트리거 범위, DB 감사 기록 활성화와 비밀번호 변경 transaction 내 이벤트 순서, 업그레이드 시 호환성 지원 범위를 확인 부탁드립니다.

위 문의는 비교용 초안으로 남기며 발송하지 않았다. 다음 단계는 선택한 별도 서버 설계의 배치·운영 책임 확정과 인수 스택 검증이다. 이 문서만으로 서버 비용이나 DB 이관을 승인하거나 릴리스 검사를 통과 처리하지 않는다.
