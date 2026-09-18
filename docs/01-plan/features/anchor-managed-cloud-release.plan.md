# Supabase Cloud 동일 버전 배포 계획

2026-09-19. 사용자는 자체 인증 서버 대신 Supabase Cloud를 선택했고 비밀번호 조건을 공급자 지원 조건으로 변경하며 Preview/Production 모두 최신 ChatGPT 개발 시스템으로 배포하도록 승인했다. SMTP는 후속 작업으로 명시했다.

현재 production은 이전 main 1a4bf13, 최신 ChatGPT 구현은 preview 51334fa다. 기존 운영 DB에는 Auth 계정이 없다. 업무 DB는 보존하고 additive life_ 모델을 적용한다.

목표: 12자 이상 + 소문자·대문자·숫자·특수문자를 UI/서버/native Auth에 일치시킨다. Supabase 관리형 Auth를 사용하고 지원되지 않는 내부 MFA 테이블 트리거와 감사 로그 저장 의존을 제거한다. Native TOTP와 DB 권한 검증은 유지한다. SMTP·승인 개인정보 문안 미완료 기능은 구체적 안내로 제한한다.

동일 Git SHA를 preview와 main에 fast-forward하고 각자의 Supabase DB·origin 환경으로 별도 빌드한다. Preview 산출물을 운영에 그대로 promote하지 않는다. 실제 두 사이트의 최신 화면·SHA·health·인증 경계 검증 후 완료한다. 기존 운영 배포와 DB 이전 상태를 복구 기준으로 기록한다.

검증: 비밀번호 검사, Supabase Preview 실계정 합성 시험(메일 발송 없음), MFA·역할 격리·업무 저장, migration/RLS advisors, lint/build, HTTP/브라우저 화면. 테스트 계정·합성 데이터는 시험 대상만 정리한다. 운영에 가짜 개인정보 동의·계정·강좌를 만들지 않는다.
