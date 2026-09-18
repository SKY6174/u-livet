# 이전 자체 인증 서버 전용 migration

2026-09-19 사용자 선택으로 Supabase Cloud 인증으로 전환했다. 이 두 migration은 Cloud main/preview에 적용된 이력이 없으며 현재 migration 디렉터리에서 제외했다. 새 `anchor_managed_cloud_auth` migration이 같은 앱 인터페이스를 관리형 Auth에 맞게 제공한다.

과거 자체 서버 실험 DB에는 원본이 적용되어 있다. 그 DB에 현재 Cloud migration을 중복 적용하지 않는다. 이전 `auth-candidate`/recovery/MFA 스크립트와 보고서는 이전 설계의 기록이며 현재 Cloud 배포 승인 근거가 아니다. 현재 검사는 `test:managed-cloud` 및 Preview 전용 `verify-managed-cloud-live.mjs`를 사용한다.
