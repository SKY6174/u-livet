# 관리자 추가 인증 2시간 설계

2026-09-24 · 계획: `docs/01-plan/features/anchor-mfa-two-hour.plan.md`

기존 [관리자 MFA 설계](anchor-admin-mfa.design.md)의 최근 인증 창 15분만 120분으로 변경한다. 다른 인증 정책은 그대로 둔다.

## DB·화면

- 새 순차 마이그레이션에서 `life_private.mfa_recent()`와 `life_private.security_status()`를 `create or replace`한다. 기존 권한, `security definer`/빈 `search_path`, AAL2·session·TOTP factor 검사를 유지한다.
- `auth.mfa_amr_claims.updated_at`과 JWT `amr`의 TOTP `timestamp`가 모두 `now() - interval '2 hours'` 이상, `now()` 이하일 때만 `recent=true`다. JWT `iat`는 검사하지 않는다.
- `life_security_status()`의 `fresh_minutes`는 `120`이다. `/auth/security`의 관리자 안내는 분 단위 값이 60으로 나누어떨어질 때 시간 단위로 표시해 `최근 2시간`이 보이게 한다.
- `life_private.recent_mfa_write_guard()`와 업무 RPC는 기존 `mfa_recent()`를 호출하므로 별도 권한이나 테이블 변경 없이 같은 창을 사용한다.

## 검증·반영

- 격리된 로컬 Supabase에서 119분 이력 허용, 121분 이력 거부, 갱신 토큰·오래된 JWT의 우회 실패, 재인증 후 복구를 확인한다. 화면의 2시간 문구와 기존 MFA 회귀를 검사한다.
- Preview와 운영 DB에 순서대로 마이그레이션을 적용하고 앱 배포·버전을 확인한다.
