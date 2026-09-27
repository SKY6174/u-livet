# 운영 DB 신원 확인 지연 개선

2026-09-27 · anchor-identity-db-latency

운영 DB 연결과 서비스 상태는 정상이다. `life_private.person_id()`가 동일한 인증 상태를 두 번 계산하던 부분을 한 번만 계산하도록 바꿨다. 세션, 계정 활성 상태, 재설정 필요 여부와 MFA 조건, 공개 RPC 및 권한은 유지했다.

로컬 합성 계정 6개 상태(관리자·강사·학습자·AAL1 관리자·없는 세션·비로그인)에서 이전/새 함수의 신원과 `life_identity()` 응답이 일치했다. 관리자 DB 함수 실행시간은 교차 10쌍 중 첫 쌍을 제외한 중앙값 **2.07 → 1.23ms**였다. 운영 로그인 화면이나 HTTP 응답시간의 개선율은 측정하지 않았다.

마이그레이션 `20260927014948_optimize_identity_status_lookup.sql` 1개를 운영 DB에 적용했다. 사후 dry-run에는 추가 항목이 없고, 기존 함수 실행 권한과 DB 업무 계수가 유지됐다. 보안 Advisor에는 기존 INFO인 [RLS 정책 없음](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) 102건만 있다. 변경 커밋 `18071a5`를 `main`에 push했고 Vercel Production READY, `uc-life.org/api/version` revision 일치, `/api/health` healthy를 확인했다.

설명서·lint·TypeScript·Next 빌드와 변경 함수 동등성 검사는 통과했다. 기존 로그인 회귀 SQL은 자동 연결 이메일 시험에서 중단됐으며, 마이그레이션 없이도 같은 지점에서 재현됐다. 이 검사를 통과했다고 주장하지 않는다. [상세 결과](../../03-analysis/anchor-identity-db-latency.analysis.md). 재현: `node scripts/verify-identity-db-latency.mjs` (로컬 DB, 전체 롤백).
