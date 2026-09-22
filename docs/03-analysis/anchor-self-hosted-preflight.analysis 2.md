# anchor-self-hosted-preflight 설계 대조

2026-09-19 · [설계](../02-design/features/anchor-self-hosted-preflight.design.md)

## 이번 범위의 완료 기준

| 요구 | 구현·검증 | 판정 |
|---|---|---|
| Cloud 유지·명시 self-hosted 모드 | 기존 111개 배포 검사 통과, 알 수 없는 모드·혼용 거부 | 완료 |
| 환경 분리 | 사이트/백엔드/스택 각각의 운영 기준 재사용 거부 | 완료 |
| 키·공개 변수 경계 | opaque/legacy 역할 검사, Cloud ref 거부, 기존 공개 allowlist/비밀 비출력 유지 | 완료 |
| 정확한 native 정책 템플릿 | 단일 문자 집합 상수 공유, 12자·메일·감사·MFA·CAPTCHA override | 완료 |
| Compose 문자 보존 | 실제 Compose 2.24.5 파싱 결과의 재이스케이프 표현 대조 | 완료 |
| 비밀 없는 설정 증거 | 필드 allowlist·128 KiB·정규화 digest·원문 비출력 | 완료 |
| 인수 기록 연결 | self-hosted 버전 2, 환경/이미지/설정 지문 대조, 전체 검사에 runtime 파일 필수 | 완료 |
| 배포 산출물 추적 | 고정된 템플릿 4개를 소스 지문에 포함, 실제 파일 제외, 부모 symlink 차단 | 완료 |
| 빈 양식·가입 기본값 | 빈 값/pending은 실패, Compose 가입 기본 닫힘 | 완료 |
| 실제 동작과 한계 구분 | 가이드·결과 메시지에서 config-only/실제 서버/게시 승인 분리 | 완료 |

한정된 사전 검사 범위 10/10 충족. 운영 서버·인증 인수 완료율은 아니다. 자동 gap 도구는 대조 양식을 제공했고 실제 판정은 소스 검토 및 아래 시험 결과에 근거한다.

## 실행 결과

- `npm run test:release`: 111건 통과.
- `npm run test:hosted-auth`: 70건 통과.
- `npm run test:self-hosted`: 111건 통과.
- `git diff --check`, 변경 검사 모듈의 Node 구문 검사 통과.

새 시험은 합성 자료와 임시 폴더만 사용한다. Docker는 `compose config`로 파싱하며 컨테이너를 만들거나 실행하지 않는다. 실제 프로젝트의 `.env.local`은 읽지 않았다.

초기 Compose 시험에서 두 문제를 구분했다. 먼저 최소 환경에서 HOME을 제외해 설치된 Compose plugin을 찾지 못했으며, Docker plugin 검색에만 기존 HOME을 그대로 전달하도록 수정했다. 이어 실제 config 출력은 달러를 재이스케이프한다는 것을 해당 버전 공식 소스로 확인하고 내보낸 표현을 대조했다. 이를 실제 컨테이너 값 검증으로 과장하지 않았다. [Compose v2.24.5 출력 코드](https://github.com/docker/compose/blob/v2.24.5/cmd/compose/config.go)

## 남은 운영 인수

서버·DB 위치·도메인·예산·담당자, 전체 스택의 고정 이미지, TLS/비공개 포트/백업, 실제 키·SMTP·CAPTCHA, 승인 정책과 최신 Auth 버전의 비밀번호·복구·DB 감사·MFA는 미확인이다. Vercel build는 여전히 앱 환경 형식 검사만 수행한다. runtime JSON과 지문은 제공된 설정의 일관성만 증명하며 운영자가 원격 실측 증거를 연결해야 한다.

전체 앱 UI나 DB SQL은 이번에 변경하지 않았으므로 이전 업무 회귀·브라우저 검사를 반복하지 않았다. 검사기와 배포 템플릿의 영향 범위에 맞춘 회귀를 실행했다.
