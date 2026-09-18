# 메인 도메인 전환 및 메일 연결 진행 기록

2026-09-19 · `anchor-primary-domain-mail` · 메인 주소 완료 / SMTP 연동 진행 중

## 완료

- 메인 주소 `https://uc-life.org`: HTTPS 200, 홈페이지 canonical 일치.
- `www.uc-life.org`, `uc-life.vercel.app`: 메인으로 308 이동, `/courses?source=domain-check`의 경로·query 보존 확인.
- Production AUTH_SITE_ORIGIN/CERTIFICATE_VERIFY_ORIGIN 및 양 환경 RELEASE_PRODUCTION_SITE_ORIGIN 변경. Preview 실제 origin/ref 유지.
- Supabase Production site_url이 배포 후에도 `https://uc-life.org`로 유지됨 확인. Vercel 연동이 기존 팀 주소를 추가 redirect 목록에 자동 보충하는 동작은 남아 있다.
- 기능 소스 `cf6072850fa462b23775637da3c99ce37cdb18cb`를 main/preview에 동일하게 push. 두 Vercel 배포 Ready. 운영 health 200 및 canonical 확인, Preview 별도 origin 유지.
- 관리 파일만 추출한 체크아웃에서 lint 및 Node 24 빌드 통과. 기존 미추적 ` 2` 복사본은 변경하거나 커밋하지 않았다.

후속 문서 배포 중 Vercel의 Supabase 연동이 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 다시 등록하여 기존 allowlist가 Production 빌드를 차단했다. 기존 정상 배포는 유지됐다. 자동 연동을 고려하여 관리형 Cloud에서만 해당 공개 변수의 정확한 이름과 publishable 형식을 허용하도록 보완했다. 서버 비밀키·빈 값·잘못된 형식과 다른 프로필에서는 계속 거부한다.

## 메일 연결의 현재 위치

사용자가 발신 주소 `noreply@uc-life.org`, 공급자 Resend를 선택했다. CLI에서 제공되는 무료 플랜(`free`, 0.00), 발신 리전 `ap-northeast-1`, 리소스 이름 `uc-life-auth`, 도메인 `uc-life.org`로 준비했다. 실제 리소스 생성은 아직 완료되지 않았다.

Vercel이 `integration_terms_acceptance_required`로 설치를 중단했다. 사용자가 동의 완료라고 답한 뒤 재시도했지만 같은 응답이며, `integration installations --integration resend --scope ucsky6174 --json`은 빈 설치 목록을 반환했다. 따라서 메일 연동 완료로 표시하지 않는다. [약관 페이지](https://vercel.com/ucsky6174/~/integrations/accept-terms/resend?source=cli)에서 해당 팀의 실제 동의 절차를 마쳐야 한다.

동의 반영 후 다음 명령을 한 번 재시도한다. CLI 59.23.2는 이 명령의 `--yes`를 지원하지 않으므로 `--non-interactive`를 사용한다.

```sh
npx --yes vercel@59.23.2 integration add resend/resend-email --non-interactive --no-claim --no-env-pull --plan free --name uc-life-auth --metadata domain=uc-life.org --metadata region=ap-northeast-1 --environment production --scope ucsky6174 --format json
```

이후 Resend가 발급하는 실제 DNS 레코드로 도메인 검증, SMTP 비밀값의 안전한 연결, 지정 수신함 발송 검증을 수행한다. 현재 SMTP·메일용 DNS·AUTH_EMAIL_ENABLED는 활성화 완료 상태가 아니다. 승인 개인정보 문안 없이 공개 가입을 열지 않는다. `.env.local`은 덮어쓰지 않았다.
