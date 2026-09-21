# 간편 인증 후 회원가입·로그인 선택 설계

> 2026-09-21 후속 사용자 결정으로 선택 화면을 제거했다. 현재 설계는 [가입 여부 자동 분기](anchor-social-auto-routing.design.md)를 따른다. 아래는 이전 설계 기록이다.

2026-09-21 · [계획](../../01-plan/features/anchor-social-entry-choice.plan.md)

## 상태와 화면
기존 `socialDestination` 및 DB `life_registration_status` 분기는 유지한다. COMPLETE는 기존 목적지 또는 MFA로, PENDING만 `/auth/complete-signup`으로 이동한다.

- `/auth/complete-signup?next=...`: 기본 선택 화면. 제목은 ‘회원가입 또는 로그인’, 설명은 ‘간편 인증이 완료되었습니다’. 기존 이메일 회원을 미가입자로 단정하지 않는다. ‘새 회원가입’과 ‘기존 계정으로 로그인’을 표시하고 이름·휴대폰·동의 양식은 표시하지 않는다.
- `step=signup`을 명시적으로 선택하면 기존 가입 양식을 표시한다. 그 외 step 값은 기본 선택 화면이다. 제목은 ‘새 회원가입’, 가입·동의 제출 RPC는 유지한다.
- 가입 양식에는 선택 화면으로 돌아가는 링크와 기존 계정 로그인 버튼을 제공한다. 동의는 기본 미선택이며 입력 검증을 유지한다.
- 모든 단계에서 서버가 세션과 PENDING을 재확인한다. 익명은 로그인, COMPLETE 등은 기존 상태별 경로로 이동한다.
- 가입 문안/개방 상태가 준비되지 않으면 새 가입을 제한하면서 기존 계정 로그인은 제공한다.

## 기존 계정 로그인 액션
`returnToExistingLogin` Server Action은 현재 클라이언트의 `auth.signOut({ scope: 'local' })`을 호출한다. 다른 기기 세션·회원정보·동의 기록을 변경하지 않는다. 오류·예외는 ActionForm에서 안내하고 이동하지 않는다. 성공 시 레이아웃을 재검증하고 `socialReturnTo`로 검사한 `next`를 보존한 `/auth/login`으로 이동한다. 기존 가입 방법을 선택하도록 대상 선택 화면을 사용한다.

로그아웃은 POST Server Action과 Next.js 동일 출처 검증을 이용하며, GET 링크의 프리페치로 세션이 종료되지 않게 한다. 새 화면만으로 계정이 연결되거나 권한이 부여되지 않는다.

## 변경 파일과 검증
- `src/app/auth/complete-signup/page.tsx`: 선택/가입 두 단계 및 안내 문구.
- `src/app/auth/social-actions.ts`: 실패를 표시하는 현재 세션 종료·로그인 이동 액션.
- 상태별 서버 컴포넌트 렌더링, COMPLETE 자동 이동/MFA, 익명 차단, 실패 시 이동 금지, 안전한 복귀 주소, 가입 문안 미준비와 필수 동의의 회귀 검사를 작성한다.
- 기존 로그인·카카오 가입 검사, lint/build를 실행한다. 합성 상태로 렌더링한 실제 화면을 데스크톱/모바일에서 확인하고 실계정 OAuth 검증과 구분하여 기록한다.

## 근거
- [Supabase signOut](https://supabase.com/docs/reference/javascript/auth-signout): local scope는 현재 세션 종료.
- [Next.js redirect](https://nextjs.org/docs/app/api-reference/functions/redirect): redirect를 오류 처리 블록 밖에서 실행.
- Supabase 2026-09-21 changelog 확인: 이 변경에 해당하는 Auth 동작 변경 없음.
