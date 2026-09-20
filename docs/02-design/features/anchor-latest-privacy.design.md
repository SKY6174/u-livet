# 개인정보처리 안내 최신 버전 설계

- 공개 `/privacy`는 `getLatestPrivacyPolicy()`가 반환하는 단일 문안만 렌더링한다.
- life_policy_versions에서 ACCOUNT_PRIVACY, APPROVED, effective_from <= 현재 시각, effective_until이 없거나 현재 시각 이후인 행만 조회한다.
- 시행일 내림차순, 승인일 내림차순, id 오름차순으로 정렬한 뒤 limit(1)을 적용한다. 버전 문자열이나 특정 버전 목록에 의존하지 않는다.
- 유효성 필터를 limit보다 먼저 적용하여 미래·만료 문안 때문에 현재 문안이 누락되지 않게 한다.
- 반환값이 없거나 조회 실패 시 기존 준비 안내를 사용한다. 기존 getPolicies와 강사·동의 증적 조회는 그대로 유지한다.
- 페이지는 요청마다 조회하여 이후 승인 문안이 게시되면 자동 반영한다.
- 실제 Supabase query builder 요청의 조건과 유효 문안 선택, 단일 article 렌더링, 빈 상태를 검증한다. lint/build 및 운영·preview 배포를 확인한다.
