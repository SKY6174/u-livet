# 메인 도메인 전환 및 메일 연결 진행 기록

2026-09-19 · `anchor-primary-domain-mail` · 메인 주소·SMTP 설정 및 진단 발송 검증

## 완료

- 메인 주소 `https://uc-life.org`: HTTPS 200, 홈페이지 canonical 일치.
- `www.uc-life.org`, `uc-life.vercel.app`: 메인으로 308 이동, `/courses?source=domain-check`의 경로·query 보존 확인.
- Production AUTH_SITE_ORIGIN/CERTIFICATE_VERIFY_ORIGIN 및 양 환경 RELEASE_PRODUCTION_SITE_ORIGIN 변경. Preview 실제 origin/ref 유지.
- Supabase Production site_url이 배포 후에도 `https://uc-life.org`로 유지됨 확인. Vercel 연동이 기존 팀 주소를 추가 redirect 목록에 자동 보충하는 동작은 남아 있다.
- 메일 연결 전 소스 `bbafe64bcfd749cd4cf7a807de586a17512b74d6`를 main/preview에 동일하게 push. 두 Vercel 배포 Ready. 운영/Preview의 `/api/version` 일치 및 health 정상, 운영 canonical과 Preview 별도 origin 유지 확인.
- 관리 파일만 추출한 체크아웃에서 lint 및 Node 24 빌드 통과. 기존 미추적 ` 2` 복사본은 변경하거나 커밋하지 않았다.

Vercel의 Supabase 연동이 자동 등록하는 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 관리형 Cloud에서만 정확한 이름과 publishable 형식으로 허용하도록 보완했다. 서버 비밀키·빈 값·잘못된 형식과 다른 프로필에서는 계속 거부한다. 관리형 Cloud 28개, 배포 준비 111개, 검토 Preview 29개 검사(총 168개)를 통과했다.

메인 주소 전환 검증 기록은 `ops/evidence/primary-domain/final-verification.json`에 보관한다. 메일 활성화 배포의 버전·상태는 별도 `smtp-release-verification.json`으로 검증한다.

## Resend 무료 SMTP 연결

사용자가 Resend 직접 무료 연결과 운영·Preview 전용 키 두 개의 발급 및 Supabase 저장을 승인했다. 계정 화면에서 Transactional Free(월 3,000통·하루 100통)와 유료 초과 사용 비활성 상태를 확인했다. 같은 계정의 다른 사업 발송과 무료 한도를 공유한다. Vercel 유료 Marketplace 구독은 생성하지 않았다.

`uc-life.org`는 Resend Verified 상태이고 발신 리전은 도쿄다. 공개 DNS에서 DKIM, `send.uc-life.org`의 SPF와 도쿄 feedback MX를 확인했다. 사용자에 의해 완료된 도메인 등록을 중복 생성하지 않았다.

| 항목 | 운영 | Preview |
|---|---|---|
| Supabase 프로젝트 | `uoebygejgglgiivzgyks` | `bfqwntulxabfrimcypvx` |
| 키 이름 | UC-LIFE Supabase SMTP Production | UC-LIFE Supabase SMTP Preview |
| 키 권한 | uc-life.org Sending access | uc-life.org Sending access |
| SMTP | smtp.resend.com:465 / resend | smtp.resend.com:465 / resend |
| 발신 | U-LIFE / noreply@uc-life.org | U-LIFE / noreply@uc-life.org |
| 시간당 발송 제한 | 10통 | 2통 |
| 사용자별 재발송 간격 | 60초 | 60초 |

키는 Supabase의 암호화된 SMTP 설정에 각각 저장했다. 키 원문은 채팅·코드·파일에 기록하지 않았고 `.env.local`은 변경하지 않았다. Management API 재조회에서 호스트·포트·사용자·발신 주소와 저장된 자격 증명 존재를 확인했다. 한국어 제목 및 `supabase/templates/recovery.html`을 양 환경에 적용했다. 이메일 인증 필수, OTP 900초와 공개 가입 제한은 유지한다.

## 발송 검증 및 활성화

Preview에만 임시 조직·테스트 동의 문안·합성 계정을 만들고, 공식 Resend 진단 주소로 native 비밀번호 복구를 요청했다. Resend 로그에서 SMTP 요청 200과 Preview 전용 키 사용을 확인했다. 메시지 `01a0b708-c7f5-7386-adf5-c16d773e01db`의 Delivered 이벤트, `noreply@uc-life.org` 발신, 한국어 문안, Preview `/auth/reset-password#token_hash=…` 링크를 확인했다. 토큰은 기록하지 않았다. 테스트 사용자와 생성 자료는 정리했다. 운영에 테스트 기관 정책이나 실제 계정을 만들지 않았다.

이 검증은 공급자 진단 주소를 사용한 전달 시험이며 실제 담당자 수신함의 도착·스팸 분류를 확인한 것은 아니다. 운영 SMTP 설정은 확인했으나 운영 계정에서 실제 복구 메일을 발송하지 않았다.

양 Vercel 환경에 `AUTH_EMAIL_ENABLED=true`를 등록했다. 같은 Git commit을 main/preview로 배포하고 버전·health·메인 주소·복구 요청 화면을 확인한다. 배포 후 검증 증빙은 Git 제외 `ops/evidence/primary-domain/smtp-release-verification.json`에 보관한다. 관련 비공개 증빙은 `smtp-settings-verification.json`, `native-mail-verification.json`, `recovery-template-verification.json`이다.

## 운영 개방 전 남은 항목

승인된 기관 개인정보 처리방침·동의 문안을 등록하고 초기 관리자와 업무 역할을 지정해야 한다. Native 공개 가입은 계속 비활성이다. 실제 담당자의 테스트 수신 주소가 제공되면 수신함 검사를 진행한다. 환불·감면·강사 심사 기준은 승인 등록 전 제한을 유지한다.
