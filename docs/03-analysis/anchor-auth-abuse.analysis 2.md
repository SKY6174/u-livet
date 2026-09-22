# 인증 반복 요청·봇 방어 검증

2026-09-19 / `anchor-auth-abuse` / 설계 대비 로컬 구현 검토

## 구현 항목

| 설계 항목 | 결과 | 근거 |
|---|---|---|
| DB 공유 제한·동시성 | 충족 | 동시 24건 중 8건만 허용, 네트워크·계정 상한 |
| 권한 및 입력 경계 | 충족 | service_role 전용 실행, RLS, 원문 거절 |
| 개인정보 최소화 | 충족 | HMAC+scope+count+expiry만 저장, 원문 로그 없음 |
| 네 경로의 서버 적용 | 충족 | login/signup/recovery/reset 실제 HTTP 검사 |
| 대기시간·입력 보존 | 충족 | 서버 retryAfter, 모바일 실제 DOM 값 보존 |
| 복구 존재 여부 보호 | 충족 | 존재·부재·제한 동일 응답·60초 안내 |
| 위조 IP 방어·IPv6 | 충족 | 기본 공유 버킷, XFF 변경에도 제한, /64·mapped IP 정규화 |
| 장애 시 차단 | 충족 | 비밀 누락·DB API 거부 시 올바른 비밀번호도 차단 |
| CAPTCHA 서버 연계 | 충족 | native 토큰 누락 3경로·거부·공개 dummy 성공 |
| CAPTCHA UI | 충족 | 한국어 상태, compact 위젯, 제출 비활성, 응답 후 초기화 |
| 정리 경계 | 충족 | 제한된 기회 정리·service 전용 정리 RPC, 활성 행 보존 |
| 운영 경계 문서화 | 충족 | 실제 키·native 설정·프록시·정리 스케줄·공용망·정책 |

12/12 로컬 구현 항목 충족. 운영 보안 인증이나 대규모 공격 방어 성능의 수치가 아니다.

## 검사

- 신규 DB/정책 29개: `evidence/abuse-checks.txt`.
- 실제 홈페이지 액션 11개: `evidence/abuse-http.txt`.
- 장애 및 native CAPTCHA 9개: `evidence/abuse-guards.txt`.
- 기존 접근성 인증 21개 + 복구 18개 + MFA 32개 = 71개.
- 이번 실행 합계 120개. 이전 전체 업무 검사 341개를 이번에 모두 재실행한 것으로 합산하지 않는다.
- lint·TypeScript 포함 production build 통과. 로컬 DB 보안 advisor 경고/오류 없음.
- 22개 migration 이력 일치. `db pull --local`의 shadow migration 재생 후 `No schema changes found`로 스키마 일치 확인. 기존 local 자료를 reset하지 않았다.
- 320px 모바일 화면에서 scrollWidth=innerWidth=320, 이메일/비밀번호 유지 확인.

## 발견 및 정리

- Next.js 공개 환경변수의 빌드 시 고정 특성 때문에 전용 로컬 빌드 명령을 추가했다. 최종 산출물은 local 55321 값으로 빌드하고 local 설정으로 검증했다.
- 현재 Supabase CLI db query는 여러 SQL 문을 단일 prepared statement로 처리하지 못하므로 전용 local 컨테이너 psql로 적용했다. migration은 이후 이력 등록하고 shadow 재생·diff로 확인했다.
- 실제 메일 재발송 간격도 native Auth에 60초로 적용했다. CLI local 메일 서버의 발송량 상한은 실제 운영 SMTP 한도와 다르다.
- 대기 안내의 위/아래 방향 지칭을 제거해 화면 배치와 일치시켰다.

## 운영 시 남는 사항

실제 Turnstile 키·허용 도메인/native 설정 동기화, 승인된 공급자 개인정보 문안, 프록시 헤더 덮어쓰기 및 원점 접근 제한, 일일 정리 스케줄/알림, 실제 공용망 부하·실패율 측정, 인증 외 API/WAF 정책. 기본 local CAPTCHA는 테스트 후 미사용으로 복원한다. 실제 봇 분류·분산 공격 차단 성능은 시험하지 않았다.
