# 간편 로그인 가입 여부 자동 분기 설계

2026-09-21 · [계획](../../01-plan/features/anchor-social-auto-routing.plan.md)

## 인증과 화면
1. 기존 `/auth/callback`의 PKCE 코드 교환 후 `socialDestination`이 서버 RPC `life_registration_status`로 상태를 판단한다.
2. COMPLETE는 보안 상태, 로그인 대상, identity를 확인하고 원래 `next`로 이동한다. MFA가 필요한 경우 보안 화면을 거친다.
3. PENDING은 `/auth/complete-signup?next=...`에서 바로 ‘새 회원가입’ 양식을 표시한다. 기존 `step` 쿼리는 화면에 영향을 주지 않는다.
4. 페이지 직접 접근도 세션과 가입 상태를 재확인한다. COMPLETE에게 가입 양식을 표시하지 않는다.
5. 회원가입/로그인 선택 화면, 선택 화면 복귀 링크, 전용 `returnToExistingLogin` 액션을 제거한다. 이름·전화번호·동의 및 정책 검증은 유지한다.

## DB 가입 완료 판단
현재 `registration_status`와 `auth_status`는 `learner_contacts.signup_source`가 KAKAO/SOCIAL일 때만 OAuth 가입 완료를 인정한다. EMAIL도 포함해, 동일 `auth.uid()`에 기존 가입 연락처 및 `life_auth_links`가 있는 경우 COMPLETE와 활성 OAuth 세션을 일관되게 인정한다. 모든 현재 signup_source 값은 검증된 가입 트리거/완료 RPC가 기록한다.

기존 함수 두 개의 조건만 확장하며 함수 권한, RLS, 서명은 그대로 유지한다. `native_session_valid`, 활동 상태, `kakao_learner_session`의 제공자·역할 제약, MFA 검사를 보존한다. 이름·전화번호·user_metadata나 임의 이메일 비교로 사용자를 연결하지 않는다. Auth의 연결 결과인 현재 사용자 ID만 사용한다. 연결되지 않은 다른 카카오 계정은 별개 계정이다.

## 검증
- 실제 서버 컴포넌트와 callback을 로드한 회귀 검사: 미가입 양식 직접 표시, 기존 회원 이동, 안전한 next, 무세션/실패/닫힌 가입/MFA.
- 로컬 DB 트랜잭션에서 기존 SQL 회귀 및 이메일 가입 후 Kakao·Google·custom:naver identity가 연결된 사용자 검사. 완료 판단·identity·재가입 무변경·신규 미가입 권한 없음·정지/MFA/업무 역할 제한. 모든 fixture는 ROLLBACK.
- 기존 JS 로그인 대상/카카오 검사, lint, 타입 검사 포함 build.
- preview 배포와 운영 버전/상태 확인. 실계정 인증 결과와 합성 fixture 검증은 구분해 보고한다.

## 참조
- [Supabase identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking): Auth가 동일 이메일 연결을 처리하며 앱은 이름·전화번호로 임의 병합하지 않는다.
- Supabase 2026-09-21 changelog 확인: 이 변경에 적용할 Auth breaking change 없음.

2026-09-21 후속 요청: 세 제공자 모두 공통 가입 판별을 적용하고 callback·DB 검사를 제공자별로 실행한다. 제공자 활성화와 실제 연결 자격 증명은 기존 설정을 따른다.
