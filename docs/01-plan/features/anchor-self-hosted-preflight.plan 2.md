# anchor-self-hosted-preflight 계획

2026-09-19. 요청: 별도 인증 서버 설계 이후 다음 단계 진행.

## 목표와 범위

기존 Cloud 배포 검사를 보존하면서 자체 운영 Supabase의 HTTPS 주소·스택 식별자·운영 기준·키·설정 지문을 검사한다. 정확한 native 비밀번호 조건을 포함한 Auth Compose override, 비밀 없는 설정 증거 양식, 전용 사전 검사, 운영 절차를 제공한다.

Cloud와 self-hosted 설정 혼용, Preview의 운영 DB/사이트/스택 재사용, 정책·이미지 변경 후 과거 인수 기록 재사용을 거부한다. 검사 성공을 실제 인증·배포 승인으로 표현하지 않는다.

## 완료 기준

- 명시적인 self-hosted 모드와 환경 분리 검사, 기존 Cloud 회귀 통과.
- 비밀번호 12자 및 대소문자를 한 집합으로 하는 영문·숫자·특수문자 정책의 Compose 전달을 실제 파서로 검증.
- 고정 Auth 이미지 digest·비밀 없는 설정 지문을 인수 기록에 연결.
- 누락·혼용·잘못된 설정·비밀값 출력·오래된 기록을 거부하는 합성 회귀 검사.
- 빈 양식은 실패하며, 실제 서버와 SMTP/CAPTCHA/복구/MFA 인수는 미완료로 유지.

## 제한

이번 작업은 로컬 코드·템플릿·검사에 한정한다. 기존 `.env.local`은 읽거나 수정하지 않는다. 서버 구매, Cloud main/Preview 변경, DB 이관, 실제 비밀 생성, 메일 발송, Vercel 배포는 범위 밖이다. 기존 작업 변경은 보존한다.

참조: `docs/operations/self-hosted-auth-design.md`.
