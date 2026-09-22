# Google 운영 로그인 개방 설계

- 기준 설계: anchor-google-data-minimization.design.md 및 docs/operations/google-login-rollout.md.
- 승인된 account-privacy-v3.txt에서 초안 표시만 제거하고 파일 본문과 DB 본문의 SHA-256을 비교한다.
- 각 DB에서 현재 가입 정책/조직/실제 SYSTEM_ADMIN 승인자를 검증한 트랜잭션으로 새 APPROVED 정책을 삽입하고 가입 포인터만 교체한다.
- 기존 승인 정책 동결, 기존 동의 이벤트 및 개인 연락처 정책 참조를 보존한다. 마이그레이션/권한 완화는 필요 없다.
- 운영 AUTH_GOOGLE_ENABLED만 true로 변경한 뒤 main 기반 코드를 push한다. Preview 배포의 운영 승격은 하지 않는다.
- staging과 production의 /privacy, 가입 문안, 로그인 대상별 버튼, OAuth scope(openid email), callback/복귀 주소를 검증한다.
- 실제 이용자의 새 동의가 필요한 가입 완료 단계는 본인이 수행한다. 테스트 명목으로 동의를 대신하지 않는다.
- 오류 시 운영 Google 플래그를 false로 새 배포하여 닫고 기존 인증/계정/동의는 보존한다.
