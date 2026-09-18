# 후보 인증 서버 격리 시험

2026-09-19 · `anchor-auth-candidate-lab`

**Auth v2.196.0과 현재 앱 migration 22개의 호환성을 새 로컬 DB에서 검증했으며 28개 검사를 통과했다.** [실행 증거 JSON](../validation/auth-candidate-20260919.json)에 UTC 검사 시각, 실제 로컬 이미지 ID, migration 목록, 검사별 결과와 정리 여부를 기록했다.

## 확인한 동작

| 범위 | 실제 결과 |
|---|---|
| DB 호환성 | 22개 파일 적용, 인증 guard trigger 4개, life 업무/비공개 테이블 RLS 활성 확인 |
| 직접 가입 | 11자와 각 문자군 누락 거부. 대소문자 동시 요구 없이 12자 허용 |
| 특수문자 | 콜론, 역슬래시, 달러, 작은따옴표, 큰따옴표를 각각 포함한 가입·이메일 확인 성공 |
| 이메일 확인 | 확인 전 비밀번호 로그인 거부, 내부 Mailpit 수신·확인 성공 |
| 자격 증명 | metadata 권한·정책 위조 차단, 단순 저장 hash 변경으로 정책 승인되지 않음 |
| 비밀번호 복구 | 실제 native proof·변경·DB 감사 승인, 약한 변경·만료·재사용·위조 proof 거부 |
| 세션 | 변경 전 JWT 업무 접근 차단, 전역 로그아웃 후 이전 refresh token 거부, 재로그인 시 동일 학습자 연결 |
| 관리자 MFA | AAL1 업무 접근 차단, 무승인 factor 등록 거부, 승인 등록·실제 TOTP 성공, 마지막 factor 제거·오래된 인증 거부 |
| 익명 접근 | 직접 업무 변경 거부 |
| 자원 정리 | 생성 컨테이너·네트워크 정리, 기존 컨테이너 ID와 실행 상태 보존 |

## 실행

저장소 의존성이 설치된 Node.js 22 이상 환경과 로컬 Unix socket의 Docker가 필요하다. 다음 이미지가 로컬에 준비되어 있어야 한다. 검사기는 이미지를 자동 다운로드하거나 기존 서비스 설정을 변경하지 않는다.

- `postgres:17-alpine`
- `public.ecr.aws/supabase/gotrue:v2.196.0`
- `public.ecr.aws/supabase/postgrest:v16.1`
- `public.ecr.aws/supabase/mailpit:v1.30.2`
- `ghcr.io/supabase/kong:2.8.1` — 로컬 접속 relay의 nginx 실행에만 사용

```sh
npm run test:auth-candidate
```

호스트·DB URL·비밀 입력 인자를 받지 않는다. 기존 `.env.local`과 인증 fixture를 읽지 않는다. 로컬 태그를 image ID로 해석하고 실행 컨테이너가 같은 ID인지 검사한다. 이 ID는 해당 로컬 이미지 식별자이며 운영 배포에 필요한 registry manifest digest와 혼동하지 않는다.

매번 임의 이름과 `uc-life.auth-candidate-run` 라벨로 컨테이너 5개와 네트워크 2개를 생성한다. DB는 tmpfs에 저장하고 host port를 열지 않는다. Auth/REST/Mailpit도 내부망에만 연결한다. relay만 127.0.0.1 임시 포트 하나를 열어 고정 경로를 전달한다. 실제 비밀·토큰·메일 본문·MFA secret을 출력하거나 파일에 저장하지 않는다.

DB bootstrap의 Auth 역할은 `search_path=auth`로 설정한다. Docker Desktop의 port binding을 위해 relay는 ingress에서 시작한 다음 내부망을 연결한다. 예전 개발 스택·Cloud main/Preview DB에는 SQL을 실행하지 않는다.

성공·예외·SIGINT/SIGTERM에서 생성 ID와 라벨을 대조한 뒤 이번 실행의 자원만 삭제한다. 강제 프로세스 종료나 Docker 중단은 자동 정리를 보장하지 않으므로 잔여 자원은 해당 실행 라벨로 확인한다. 기존 프로젝트 컨테이너를 일괄 삭제하지 않는다.

## 인수 범위

이 검사는 HTTP, 임시 JWT 키, 내부 Mailpit, 기본 native 메일 템플릿을 사용한다. 외부 통신을 차단한 시험이므로 native CAPTCHA를 끈다. 운영용 `AUTH_POLICY`와 self-hosted 사전 검사의 CAPTCHA/HTTPS/SMTP 조건은 그대로 유지한다.

정식 SMTP 배송, Turnstile, 한국어 메일 템플릿의 공개 호스팅, Vercel·HTTPS·Envoy, 소셜 로그인/PASS, 전체 역할별 업무 UI, 성능·백업 복원은 이 결과의 범위가 아니다. 운영 release 기록을 승인하거나 후보 이미지를 운영 배포한 결과가 아니다.

## 다음 배포 입력

사용자가 제공한 홈페이지 주소는 **https://uc-life.vercel.app**이다. 별도 인증 서버의 호스팅 서비스·Linux 환경·백엔드 HTTPS 주소는 아직 확인되지 않았다. 홈페이지 URL만으로 지속 실행하는 Auth·Postgres 서버의 위치를 정할 수 없다.

서버 정보가 확인되면 [운영 설계](self-hosted-auth-design.md)와 [사전 검사](self-hosted-preflight.md)를 기준으로 공식 전체 스택의 시험 배치를 맞춘다. Auth와 업무 DB의 공동 운영 여부, 운영/시험 분리, SMTP·Turnstile, 백업 담당과 저장 위치를 확정한다. Cloud DB 이관이나 홈페이지의 실제 backend 전환은 아직 실행하지 않았다.
