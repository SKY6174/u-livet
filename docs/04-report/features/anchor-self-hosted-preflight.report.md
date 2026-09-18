# 별도 인증 서버용 배포 설정·사전 검사 완료

2026-09-19 · `anchor-self-hosted-preflight`

기존 Cloud 배포 검사를 유지하면서 자체 운영 Supabase용 설정과 검사를 추가했다. 실제 서버 구매·배포·DB 이관은 하지 않았다.

## 변경 결과

- Cloud/self-hosted 모드 혼용을 거부하고 Preview가 운영 사이트·백엔드·스택을 재사용하면 차단한다.
- Auth 이미지 버전/digest와 비밀 없는 설정 지문을 앱 환경·인수 기록에 연결한다. 설정이 바뀌면 과거 기록으로 전체 검사를 통과할 수 없다.
- 12자 이상, 영문 대소문자 한 집합·숫자·특수문자 정책을 담은 Compose override를 추가했다. DB 감사 저장·메일 확인·복구 유효기간·CAPTCHA·TOTP도 명시한다.
- 자체 운영용 환경·runtime·인수 기록 양식을 제공했다. 실제 비밀값은 없으며 빈 양식은 실패한다. 가입은 기본 닫힘이다.
- 전체 release 검사에 `--self-hosted-config`를 필수로 연결했다. Vercel 빌드의 config-only 검사는 실제 서버 인수와 구분한다.

## 검증

기존 배포 111건 + hosted Auth 70건 + 신규 자체 운영 111건, **총 292건 통과**. 합성 입력과 실제 Compose 파싱을 사용했으며 실제 Auth 컨테이너나 Cloud DB는 변경하지 않았다. 변경 모듈 구문 검사와 `git diff --check`도 통과했다.

Compose 출력의 달러 재이스케이프를 공식 소스로 확인해 검증에 반영했다. 이 결과는 실제 서버의 비밀번호 허용·거부나 복구/MFA 시험 완료를 뜻하지 않는다.

## 사용 자료와 다음 단계

- [설정 및 실행 가이드](../../operations/self-hosted-preflight.md)
- [Auth 정책 override](../../../ops/self-hosted/compose.auth-policy.json)
- [설계 대조](../../03-analysis/anchor-self-hosted-preflight.analysis.md)
- [기존 운영 구조 설계](../../operations/self-hosted-auth-design.md)

다음은 서버/DB 배치·도메인·예산·담당자를 확정하고 분리된 인수 스택에서 실제 native 비밀번호, 메일/CAPTCHA, 감사·복구·MFA, 역할별 업무와 복원을 시험하는 단계다. 설정 검사는 원격 구성이나 기록의 진위를 보증하지 않는다. 기존 `.env.local`은 읽거나 수정하지 않았고 추가 유료 리소스·실제 메일·Git push·운영 배포는 수행하지 않았다.
