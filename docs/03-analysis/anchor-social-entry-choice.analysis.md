# 간편 인증 후 선택 화면 검증

2026-09-21 · [설계](../02-design/features/anchor-social-entry-choice.design.md)

## 설계 대조: 10/10 구현
1. PENDING 기본 화면에 새 회원가입/기존 계정 로그인 선택 제공.
2. 선택 전 이름·휴대폰·동의 입력 없음.
3. 명시적인 `step=signup`에서만 기존 가입 양식 표시.
4. 알 수 없는 step은 선택 화면으로 처리.
5. 가입 양식에서 선택 화면 복귀 및 기존 계정 로그인 제공.
6. 양 단계 모두 서버 세션·가입 상태 확인.
7. COMPLETE는 기존 목적지로 이동하며 MFA 유지.
8. 가입 문안 미준비 상태에서는 가입 차단·기존 로그인 제공.
9. 기존 계정 로그인은 local scope로 인증 종료 후 안전한 next를 보존.
10. 인증 종료 오류·예외는 안내하고 성공 리다이렉트하지 않음.

## 실행 결과
- `node scripts/verify-social-entry-choice.mjs`: 29개 통과. 실제 서버 컴포넌트/액션을 불러오고 Auth/RPC/ActionForm 경계는 대체한 테스트다.
- `node scripts/verify-login-audiences.mjs`: 46개 통과.
- `node scripts/verify-kakao-signup.mjs`: 40개 통과.
- `npm run lint`, `npm run build`, `git diff --check`: 통과. 빌드는 타입 검사 포함.
- 브라우저: 실제 서버 컴포넌트와 빌드 CSS를 사용하는 localhost 합성 화면에서 선택 → 새 가입 → 선택 화면 복귀 → 기존 로그인 도착을 확인했다. next=/courses 유지, 동의 기본 미선택, 선택 화면의 개인정보 입력란 0개를 확인했다.
- 360px 모바일에서 선택/가입 두 화면 모두 문서 너비 360px, 가로 넘침 없음. 기본 데스크톱 화면도 시각 확인했다.

## 범위와 한계
운영 사용자·DB·제공자 설정·동의 문안은 변경하지 않았다. 화면 검증의 세션과 RPC 및 폼 전송 경계는 합성이므로 실제 Next Server Action 전송/운영 카카오 callback 성공을 입증하지 않는다. 실제 계정의 최초 가입과 재로그인, 운영 환경의 최종 로그인 완료는 배포 후 본인 인증으로 확인해야 한다.

기존 DB가 이메일 회원을 PENDING으로 판단할 수 있는 구조는 유지했다. 이 변경은 이용자가 기존 로그인 방법으로 돌아갈 수 있게 하며, 서로 다른 계정을 자동 병합하지 않는다.
