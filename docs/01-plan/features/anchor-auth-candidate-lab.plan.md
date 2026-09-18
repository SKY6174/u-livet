# anchor-auth-candidate-lab 계획

2026-09-19. 요청: 배포 설정 준비 이후 다음 단계. 홈페이지 주소: https://uc-life.vercel.app. 별도 인증 서버 정보는 확인 중이다.

## 목표

기존 개발·Cloud DB를 복사하거나 변경하지 않고 임시 로컬 스택에서 후보 Auth v2.196.0과 현재 22개 migration의 호환성을 실제 시험한다. 가입의 native 비밀번호 조건, 이메일 확인, 비밀번호 복구·감사 기록·구세션 회수, MFA 변경 승인 경계를 검증한다.

## 범위와 격리

전용 무작위 Docker 이름·라벨·내부 네트워크, 새 PostgreSQL·Auth·PostgREST·수신 전용 Mailpit을 사용한다. 기존 컨테이너에 SQL을 실행하지 않는다. 호스트 공개는 127.0.0.1 임시 포트만 허용하고 데이터는 임시 저장소에 둔다. 가상 계정과 정책만 생성하며 종료 시 자신이 만든 자원만 삭제한다.

실제 인터넷 메일·Cloud·운영 서버·Vercel 배포는 범위 밖이다. 로컬 시험에서는 HTTP/수신함을 사용하고 native CAPTCHA를 끈다. 이는 외부 통신을 차단한 시험 스택에만 적용되며 운영 preflight를 통과시키지 않는다. 실제 CAPTCHA/SMTP/TLS·공식 전체 스택·전체 업무 UI 인수는 별도로 남긴다.

## 완료 기준

실제 후보 Auth의 비밀번호 허용·거부, 22개 migration 적용, 복구 및 MFA 핵심 동작의 결과와 정확한 한계를 기록한다. 사용한 이미지 ID를 남기고 기존 컨테이너 유지 및 자원 정리를 확인한다. 기존 .env.local·인증 fixture·Cloud main/preview는 읽거나 수정하지 않는다.
