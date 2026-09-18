# uc-life.org 및 인증 메일 설계

2026-09-19 · [계획](../../01-plan/features/anchor-primary-domain-mail.plan.md)

## 주소 전환

Vercel 프로젝트의 기존 apex→www 308을 먼저 해제한다. www와 `uc-life.vercel.app`은 apex로 308 이동시킨다. 운영 AUTH_SITE_ORIGIN/CERTIFICATE_VERIFY_ORIGIN 및 양 환경 RELEASE_PRODUCTION_SITE_ORIGIN을 apex로 바꾼다. Preview 실제 origin/ref/키는 유지한다. root metadataBase는 환경별 AUTH_SITE_ORIGIN을 사용하고 홈 canonical은 해당 환경 루트로 지정한다. 하위 모든 페이지를 홈 canonical로 묶지 않는다.

Supabase Production site_url은 apex, redirect allowlist는 필요한 인증 경로만 유지한다. 기존 연동의 자동 URL 갱신 가능성을 점검한다. 배포 후 값이 되돌아가면 원인 설정을 확인하고 올바른 값을 적용한 뒤 다시 검사한다. 사용자 정의 이메일 템플릿은 운영에서 apex 링크를 사용하도록 준비한다. API/DB custom domain 구매는 범위에 포함하지 않는다.

## 메일

SMTP 공급자, 발신 주소, 자격 증명을 확인한다. 키는 공급자/Supabase 보안 설정 또는 사용자가 지정한 비공개 로컬 파일에서만 읽는다. 현재 Vercel과 Supabase에 SMTP 키/host가 없고 DNS에 메일 레코드가 없는 상태를 확인했다. 공급자가 알려지기 전 임의의 유료 서비스 가입·DNS 값 추측은 하지 않는다.

SMTP의 SPF/DKIM 및 발신 도메인 상태, 포트/사용자, 승인 수신함을 통한 발송 확인 후 AUTH_EMAIL_ENABLED를 켠다. 이메일 인증은 유지하고 복구 링크 15분, 1회 사용 정책을 유지한다. 승인 개인정보 문안이 없으면 공개 가입을 열지 않는다. 메일 서비스 준비만으로 개인정보 승인이나 관리자 계정 생성을 대체하지 않는다.

## 검증

Vercel의 Supabase 연동이 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 자동 재등록하는 것을 확인했다. 관리형 Cloud 프로필에서만 이 정확한 이름을 공개 변수 목록에 추가하고 `sb_publishable_` 형식 검사 및 기존 비밀값 유출 검사를 유지한다. 같은 이름의 서버 secret/service-role 값은 거부한다. 검토 전용·자체 서버·미등록 변수 허용 범위는 넓히지 않는다.

신규 도메인 HTTPS 200, 이전 두 호스트 308→apex이며 경로/query 보존 및 순환 없음. 운영/Preview 동일 SHA, 각 DB health 정상. 브라우저의 메인 주소, 메타 canonical과 인증·증명 링크 origin을 확인한다. SMTP 미제공 시 그 제한을 정확히 기록하고 주소 전환 완료와 구분한다.
