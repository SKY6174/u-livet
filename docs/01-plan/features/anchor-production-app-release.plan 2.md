# Production 앱 배포 계획

2026-09-19 · `anchor-production-app-release`

사용자가 다음 단계 진행을 요청했다. DB 반영을 마친 Preview를 main에 통합하고 운영 환경으로 빌드·배포한다.

- 기준 main: `e7d3c8e`; 검증 완료 Preview: `b558db2`.
- 목표: 2026 교육과정 편성표와 보고서·첨부·6종 출력 기능의 운영 앱 반영.
- 운영 DB 보고서 migration 적용/사후 검증은 완료됐다. 이력 25개, 미적용 0개.
- 충돌과 코드 차이를 검토하고 관련 회귀·lint·TypeScript 검사를 수행한다.
- preview→main PR을 생성·병합하고 Vercel Production 환경의 새 빌드를 확인한다.
- 운영 주소·버전·환경/DB 분리·인증 전 접근·브라우저 기본 화면·오류 로그를 점검한다.
- 실제 사용자 업무 입력·메일 발송·추가 DB 변경은 하지 않는다. 인증된 운영 전체 흐름은 후속 인수 범위다.

기존 운영 앱 `dpl_7eEzNbUWdeDrvDee1HSqekLEbkXw`는 복구 후보이며, 추가된 보고서 DB 객체와 호환된다.
Preview 산출물을 운영으로 그대로 promote하지 않고 main에서 Production 설정으로 새로 빌드한다.
