# 신원 확인 DB 지연 개선 검증

2026-09-27 · [설계](../02-design/features/anchor-identity-db-latency.design.md)

## 설계 대비

구현 8/8: 기존 함수 반환형·보안 속성·빈 검색 경로, 원본 계정·MFA 조건, 상태 함수의 단일 계산, 공개 RPC 계약 유지, 합성 인증 프로필 비교, 로컬 롤백, 반복시간 비교, 빌드 및 원격 마이그레이션 dry-run. 변경은 `life_private.person_id()` 본문뿐이다. 테이블·RLS·앱 코드는 바뀌지 않았다.

## 연결과 성능 근거

운영 Supabase `uoebygejgglgiivzgyks`는 ACTIVE_HEALTHY, 운영 `/api/health`는 healthy였다. 운영의 현재 `person_id()` 함수 MD5는 로컬 원본과 같은 `d94dbd8164144b73ebb9ea1330a75100`. 지난번 최적화한 운영 목록 함수도 기존 적용 MD5 `595b91cbc06210fb6c36ca884b2f51e1`로 유지됐다. 운영 `life_identity()`는 누적 1,312회 평균 102.07ms이며, 9월 25일 관측치와의 누적 실행시간 차이로 추정한 최근 42회 평균은 약 56ms다. `pg_stat_statements`는 호출별 최신 분포를 제공하지 않으므로 이 값은 참고용이다.

로컬 Docker DB에서 관리자, 강사, 학습자, AAL1 관리자, 세션 불일치, 비로그인 총 6개 claims의 기존/개선 `person_id()` 및 `life_identity()` 결과가 완전히 같았다. 유효한 3개 프로필은 신원이 존재하고 나머지 3개는 없음을 따로 검증했다. 교차 순서 10쌍(첫 쌍 제외)의 관리자 DB 실행시간 중앙값은 **2.07 → 1.23ms**로 약 40.6% 감소했다. 시험은 전부 롤백됐다. 이는 운영의 실제 로그인 화면 또는 HTTP 지연 개선율이 아니다.

`npm run build`의 설명서 검증, lint, TypeScript, Next 빌드가 통과했다. 기존 `verify-kakao-signup.sql` + `verify-login-audiences.sql` 회귀는 `automatically linked email uses its completed signup`에서 중단됐다. **같은 로컬 DB에서 새 마이그레이션 없이 재실행해도 동일한 22번째 이후 실패가 재현돼**, 이번 변경으로 인한 실패로 보지 않았다. 원인은 이번 범위 밖이며 성공한 회귀로 계산하지 않는다.

운영 CLI dry-run에서 적용 예정 파일은 `20260927014948_optimize_identity_status_lookup.sql` 1개이고 seed/roles는 없었다. 적용 전 보안 Advisor에는 기존 INFO `rls_enabled_no_policy` 102건만 있었고 ERROR/WARN은 없었다. 해당 안내: [RLS 정책 없음](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). 성능 Advisor의 [RLS initPlan](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan) WARN 33건과 [다중 허용 정책](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies) WARN 234건은 기존 별도 검토 대상이다.
