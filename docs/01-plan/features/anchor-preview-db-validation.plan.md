# anchor-preview-db-validation 계획

2026-09-19. 요청: Preview 생성 이후 진행. 후속 결정: 정확한 비밀번호 기준을 유지하고 별도 인증 서버 운영 설계.

## 목표

- 독립 Supabase Preview `bfqwntulxabfrimcypvx`에 009·010과 업무용 life_ migration 9개를 순서대로 적용한다. 원래 파일 버전으로 이력을 기록한다.
- RLS, 기존 API 권한 회수, 데이터 부재, 브랜치 분리 및 Advisor 결과를 확인한다.
- 인증 전제가 필요한 마지막 3개 migration(복구·MFA·남용 방지)은 Cloud Preview에 영구 적용하지 않는다.
- 별도 인증 서버 운영 설계를 작성한다. 확정 비밀번호 조건과 기존 Auth/DB 의존성을 유지할 배치, 운영 책임, 이관 절차를 구체화한다.

## 완료 기준 및 제한

Preview 업무 DB 적용과 실제 catalog/권한 검증, 원격/로컬 상태 구분, 인증 운영 설계 작성. main 변경·merge·Git push·추가 유료 서버 생성·인증 방식 임의 전환은 수행하지 않는다. .env.local을 읽지 않는다.

Preview는 회원·프로필·수강신청·Storage 객체 0건임을 확인했다. 실제 계정·승인 정책·수납 자료·시험 메일을 생성하지 않는다. 인증 준비 전까지 웹 앱이나 실사용자를 연결하지 않는다. 업무 DB 준비가 운영 인증/업무 인수 완료를 뜻하지 않는다.
