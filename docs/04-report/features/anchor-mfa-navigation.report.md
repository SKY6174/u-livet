# 인증 완료 후 화면 이동 보고서

2026-09-19 · anchor-mfa-navigation

## 결과

인증 완료 이후에도 6자리 코드 입력 폼이 남아 다시 인증해야 하는 것처럼 보이던 동작을 수정했다. 작업 중 추가 인증을 요청한 경우 검증 성공 후 해당 화면으로 바로 돌아간다. 유효한 최근 MFA 상태로 같은 인증 URL을 방문해도 서버가 안전한 복귀 주소로 이동시킨다. 계정 보안 화면을 직접 연 경우 인증 앱 관리 기능은 유지한다.

서버에서 native 검증과 실제 MFA 상태를 모두 확인한 뒤 성공을 반환한다. DB 인증·권한, SSR 쿠키, 관리자 저장·승인의 최근 15분 조건, 다른 창의 미저장 입력은 유지한다. 화면 이동 자체로 추가 인증을 요청하는 규칙은 추가하지 않는다.

## 검증

- `node scripts/verify-mfa-navigation.mjs`: 23개 통과(main·Preview).
- `node scripts/verify-initial-account.mjs`: 21개 통과.
- `node scripts/verify-db-performance.mjs`: main 13개 통과.
- 전체 린트와 main·Preview 각각의 Next.js production build 통과.
- 실제 Chromium + React 컴포넌트: 인증 완료 폼 숨김, 잘못된 코드 시 머무름, 성공 후 작업 화면 복귀, 직접 관리 화면 유지, 브라우저 오류 없음.

브라우저 검증의 인증 경계는 합성 응답이다. 실제 회원의 비밀번호·TOTP를 사용하거나 DB 인증 조건을 변경하지 않았다. `main`·`preview` 각각의 기존 내용에 같은 수정만 반영하며, 원래 작업 디렉터리의 다른 미완료 변경은 포함하지 않는다.

참조: [설계](../../02-design/features/anchor-mfa-navigation.design.md), [설계 대비 검증](../../03-analysis/anchor-mfa-navigation.analysis.md).
