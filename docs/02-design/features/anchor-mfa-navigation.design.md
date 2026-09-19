# 인증 완료 후 화면 이동 설계

2026-09-19 · [계획](../../01-plan/features/anchor-mfa-navigation.plan.md)

## 서버의 복귀 판단

`/auth/security`는 명시적 `next`가 있는 인증 요청과 사용자가 직접 연 보안 관리 화면을 구분한다. 목적지는 기존 `safeReturnTo`를 통과시키고 인증 경로는 `/mypage`로 정규화한다. 실제 서버 보안 상태가 active, 비밀번호 설정 완료, mfa_verified, recent인 경우에만 명시적 복귀 주소로 redirect한다. 이 판단은 인증 앱 목록 조회 전에 수행한다. 만료·미인증 상태에서는 정상 인증 화면을 유지한다.

## 화면 상태와 이동

`MfaPanel`에는 명시적 복귀 요청 여부를 전달한다. 최근 추가 인증이 완료되었고 새 인증 앱 등록 중이 아니면 6자리 코드 폼을 렌더링하지 않는다. 코드 오류·미인증·최근 인증 만료·새 앱 등록에는 폼을 표시한다. 성공 여부를 클라이언트 저장소의 플래그로 판정하지 않는다.

기존 native challengeAndVerify와 서버 상태 재확인 성공 후, 복귀 요청이 있으면 `router.replace(next)`로 이동한다. 현재 Server Action의 layout 재검증과 응답 쿠키를 통해 갱신된 세션과 캐시를 사용한다. 직접 연 관리 화면은 refresh하여 인증 완료 표시와 앱 관리를 유지한다. 설정 키 복사나 앱 해제 성공은 인증 성공 이동을 일으키지 않는다.

추가 인증 요청이 별도 창에서 시작된 경우 자동 이동은 그 창에서만 수행한다. 원래 창의 입력·저장 상태는 유지하며 자동 저장하지 않는다. 이미 인증된 상태로 같은 `next` URL을 다시 방문하면 서버가 즉시 복귀시킨다.

## 검증

- 실제 React 정적 렌더로 최근 인증 폼 숨김, 미인증·만료 폼 표시, 앱 관리 유지 확인.
- 서버 페이지를 실행해 명시적 next 자동 복귀, 직접 관리 화면 유지, 외부/인증 경로 정규화, 만료·비밀번호 재설정·비로그인 경계 확인.
- 클라이언트 이벤트를 실행해 성공 시 replace, 실패 시 머무름, 관리 모드 refresh, 앱 해제 시 비이동 확인.
- 서버 액션이 잘못된 코드·소유하지 않은 factor·서버 미검증 상태에서 성공을 반환하지 않는지 확인.
- 실제 React 클라이언트 브라우저 회귀로 인증 → 작업 화면 → 인증 URL 재방문 흐름을 확인. 합성 상태를 사용하며 실제 계정 비밀·인증 코드를 읽지 않는다.

참조: [기존 관리자 MFA 설계](anchor-admin-mfa.design.md), [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Next.js useRouter](https://nextjs.org/docs/app/api-reference/functions/use-router).
