# anchor-auth-candidate-lab 완료 보고

2026-09-19

사용자 제공 홈페이지 주소 **https://uc-life.vercel.app**을 운영 문서에 반영했다. 별도 인증 서버의 호스팅/OS/백엔드 주소는 확인 대기이며 원격 설정을 추정해서 채우지 않았다.

후보 Auth **v2.196.0**용 격리 시험 도구를 구현하고 새 PostgreSQL DB에서 **migration 22개·검사 28개**를 통과했다. 요청한 대소문자 구분 없는 12자 영문·숫자·특수문자 조건, 이메일 확인, 복구 정책 감사·구세션 회수와 MFA 변경 보호를 실제 native API/RPC로 확인했다.

실행 후 임시 컨테이너·네트워크를 정리했고 기존 컨테이너 ID/상태가 유지됐다. Node 구문 검사와 diff whitespace 검사도 통과했다. 코드 변경에 대한 설계 대조는 범위 내 10/10이며 PDCA check/act/report 근거로 기록했다.

- [실행 및 운영 가이드](../../operations/auth-candidate-lab.md)
- [기계 판독 실행 증거](../../validation/auth-candidate-20260919.json)
- [설계 대조](../../03-analysis/anchor-auth-candidate-lab.analysis.md)
- [검사 코드](../../../scripts/verify-auth-candidate.mjs)

로컬 HTTP·Mailpit·CAPTCHA 비활성 시험이다. 운영용 인증/DB 서버 배치, 공식 전체 스택, HTTPS·정식 SMTP·Turnstile·전체 업무·백업 인수 및 Vercel 연결 전환은 남아 있다. 운영 정책이나 release 승인 기록을 변경하지 않았다.

다음 단계는 별도 서버 정보에 맞춰 인수 환경을 구성하고 실제 통신·복구·운영 검증을 수행하는 것이다. 현재 Cloud main/Preview의 내용과 기존 `.env.local`은 변경하지 않았다.
