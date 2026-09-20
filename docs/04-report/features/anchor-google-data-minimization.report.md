# Google 정보 최소화 결과

2026-09-20. 사용자가 원하지 않은 프로필 사진을 Google 요청 범위에서 제외하고 과거 사진 메타데이터도 로그인 시 정리하도록 구현했다.

- Preview 반영 코드: `49bc2d077b07642580ba094cd133806294eb548e` (최소 scope 변경 `0ece30c` 포함).
- 코드 검증 배포: `dpl_FGtzhWVVYihrf16PU2LXC3NyQaPS`, https://staging.uc-life.org, READY.
- 실제 수강생·교외 강사 재로그인 성공. 사진 identity 키 0건, 사용자 메타데이터 키 0건. 역할·사람 연결·휴대폰 미인증 상태 보존.
- 자동 검사 78개, 타입·lint·Vercel 빌드 통과. 설계 대비 7개 항목 확인.
- Google을 반영한 `docs/operations/account-privacy-v3.txt` 검토안 작성. 파일 SHA-256: `aac1d8ef312869ce5928c0dd0602e257171f496addf1677e6e434a99d2c21341` (초안 표시 포함 파일 기준).
- 적용 순서와 근거는 `docs/operations/google-login-rollout.md`에 기록했다.

운영 홈페이지 Google 버튼은 아직 준비 중이다. 새 문안 승인 후 양쪽 DB에 v3를 등록하고 운영에 동일한 최소화 코드를 배포한다. 이번 작업에서 기관 승인이나 기존 이용자의 새 동의를 대신 기록하지 않았다.
SQL 직접 정리는 읽기 전용 연결로 실행되지 않았으며, 공식 Auth 사용자 수정 API로 본인 로그인 시 두 사진 키만 제거했다. 과거 백업·이미 발급된 토큰의 즉시 전체 파기를 주장하지 않는다.
