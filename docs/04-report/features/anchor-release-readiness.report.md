# Vercel + Supabase 배포 준비 결과

2026-09-19 · `anchor-release-readiness`

사용자가 선택한 **Vercel + Supabase** 기준으로 환경 설정 사전 검사, Vercel 빌드 연결, 15개 운영 인수 점검표와 배포·복구 절차를 준비했다. 실제 운영 배포는 하지 않았다.

## 추가한 기능

- 운영·Preview의 사이트와 Supabase DB를 구분하고 잘못된 대상 설정을 차단한다.
- 공개 변수에 서버 비밀값을 넣거나 CAPTCHA 시험 키·로컬 시험 설정을 남긴 경우 거부한다.
- `vercel.json`은 설정 검사 후에만 `next build`를 실행한다. 로컬 env 파일이 배포 폴더에 있으면 거부한다.
- 환경 형식 검사 통과(`CONFIG_VALID`)와 담당자 인수 검토 가능(`READY_FOR_MANUAL_RELEASE_REVIEW`)을 구분한다. 자동 게시 승인 기능은 아니다.
- 15개 항목의 담당자·확인 시각·증거 참조를 현재 사이트/DB·소스/migration 지문에 연결한다. 예시는 모두 `pending`이다.
- CLI는 네트워크를 호출하지 않으며 기존 `.env.local`을 자동으로 읽거나 수정하지 않는다. 출력에는 입력값·키·개인 증거 원문을 담지 않는다.

## 확인 결과

| 검사 | 결과 |
|---|---|
| 합성 입력·임시 디렉터리 회귀 | **111개 통과** |
| lint / mjs 문법 / 변경 공백 오류 | 통과 |
| 빈 예시 전체 검사 | 예상대로 BLOCKED, 종료 1 |
| 예시 담당자 증거 | 15개 모두 미확인으로 차단 |
| snapshot | 대상 파일 187개, migration 22개 |
| 실제 Vercel 배포·원격 Auth/DB 변경 | 수행하지 않음 |

검사 증거: [회귀 결과](evidence/release-tests.txt), [예시 미준비 판정](evidence/release-example-blocked.json), [소스/migration 지문](evidence/release-snapshot.json). [설계 대조](../../03-analysis/anchor-release-readiness.analysis.md)는 12/12 항목 충족이다. 이번에는 앱 화면이나 DB schema를 바꾸지 않았으며 이전 기능 검사 결과를 이번 통과 수에 합산하지 않았다.

## 사용

```sh
npm run test:release
npm run check:release -- --help
npm run check:release -- --target production --env-file .env.example --format json
```

마지막 명령은 실제 값이 없으므로 실패가 정상이다. 실제 작업 순서와 입력 설명은 [운영 인수·배포 가이드](../../operations/vercel-supabase-release.md)에 있다. [점검 양식](../../../ops/release.example.json)은 담당자 확인 후 별도 비공개 파일로 작성한다.

## 실제 운영 전 남은 사항

운영/Preview 도메인·프로젝트·키·담당자가 아직 필요하다. 특히 **12자 이상+영문·숫자·특수문자, 대소문자 혼용 의무 없음**을 hosted Supabase native Auth에서도 정확히 강제할 수 있는지와 기존 Auth schema 의존성의 지원 여부를 먼저 검증해야 한다. 로컬에서 성공한 설정을 관리형 서비스에 그대로 적용할 수 있다고 가정하지 않는다.

SMTP·CAPTCHA·WAF·정리 작업·백업/파일 복원·모니터링, 기관 승인 개인정보/운영 기준과 실제 환경 업무 검증이 끝나기 전까지 운영 준비 상태는 미완료다. 환불·감면·강사 심사 미확정 기준은 기존 제한을 유지한다. 간편 로그인/PASS·은행/PG·실제 문자 공급자 등 미연동 항목도 별도 후속 범위다.

**bkit:** 이 배포 준비 도구의 Plan → Design → Do → Check → Act → Report 완료. 다음 단계는 승인된 Preview 환경에서 Supabase 인증 정책·Auth schema 호환성 검증이다.
