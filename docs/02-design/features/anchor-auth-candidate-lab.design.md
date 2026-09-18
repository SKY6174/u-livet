# anchor-auth-candidate-lab 설계

2026-09-19 · [계획](../../01-plan/features/anchor-auth-candidate-lab.plan.md)

## 격리된 실동작 시험

`scripts/verify-auth-candidate.mjs`와 전용 helper를 추가한다. 고정 후보 이미지 태그를 로컬 image ID로 해석한 후 그 ID로만 실행한다. 외부 서버 주소나 이미지 override를 입력받지 않는다. 로컬 Unix Docker socket만 허용하며 기존 컨테이너/볼륨/네트워크를 재사용하지 않는다.

새 무작위 이름과 전용 실행 라벨을 가진 내부 네트워크에 PostgreSQL 17, Auth 2.196.0, PostgREST, Mailpit을 배치한다. DB는 host port 없이 tmpfs 저장소를 사용하고 Auth/REST/Mailpit도 host port를 열지 않는다. 아래 relay만 127.0.0.1 임시 포트를 연다. 생성 ID를 추적하고 삭제 직전 라벨을 재확인한다. 성공/실패/SIGINT/SIGTERM에서 자기 자원만 정리하며 기존 컨테이너 ID와 실행 상태가 보존되는지 확인한다.

현재 Docker Desktop은 internal 네트워크의 직접 port publish를 제공하지 않아, 전용 시험 HTTP relay를 추가한다. relay만 별도 ingress 네트워크와 내부망 양쪽에 연결하고 127.0.0.1의 임시 포트 하나를 연다. 고정된 auth/rest/mail 경로만 전달한다. Auth/DB/Mailpit/REST는 내부망에만 연결되며 외부로 메일을 전송하지 않는다. relay는 기존 로컬 Kong 이미지에 포함된 nginx만 사용하며 실제 운영 Gateway 인수가 아니다.

DB bootstrap은 테스트용 최소 Supabase 역할·auth schema·auth.uid/auth.jwt를 만들고 native Auth가 자체 schema migration을 실행한다. 이어 현재 앱 migration 22개를 파일별 transaction으로 적용한다. 업무 정책은 새 임시 DB에만 가상 승인자/가입 정책을 추가한다. 실제 기관 정책이나 기존 개발 fixture 파일을 복사하지 않는다.

## 검증 흐름

1. 22개 SQL 적용, 실제 Auth 정책·감사 옵션 확인.
2. 직접 가입 API에서 11자·영문/숫자/특수문자 누락 거부. 소문자만·대문자만, 콜론·역슬래시·달러·작은따옴표·큰따옴표 포함 12자 허용.
3. 이메일 확인 전 로그인 거부, 격리 Mailpit 수신 후 확인·로그인 성공.
4. 비밀번호 복구 proof 검증·약한 변경 거부·정책 상태 기록·기존/복구 JWT 업무 접근 거부·새 로그인 후 동일 person 복원. proof 재사용/만료 거부.
5. metadata로 정책/권한 승격 거부. 단순 hash 변경은 정책 증명으로 인정하지 않음.
6. 관리자 AAL1 접근 거부, 승인 없이 native factor 등록 거부, 승인+TOTP 검증 성공, 마지막 factor 제거 거부, 오래된 MFA 재인증 요구.
7. 실제 서버 로그·JWT·비밀번호·MFA secret·메일 본문은 출력하지 않는다. 검사명/이미지 ID/합격 여부만 보고한다.

## 차이와 보고 범위

인터넷이 없는 네트워크에서 CAPTCHA는 로컬 시험에 한해 비활성화하고 SMTP는 Mailpit을 사용한다. 홈페이지 HTTPS·Vercel/Envoy gateway·정식 SMTP·Turnstile·한국어 메일 호스팅·전체 업무 UI·백업 복구를 완료했다고 보고하지 않는다. 기존 Cloud/self-hosted 사전 검사는 계속 운영 조건을 요구하며 시험 예외를 추가하지 않는다.

최대 대기와 요청 시간 제한을 둔다. 준비 실패 시 일반화된 단계/SQLSTATE만 보고하고 자격 증명 원문을 출력하지 않는다. 실행 중 임시 비밀은 메모리와 임시 컨테이너 설정에만 존재하며 파일에 저장하지 않는다.
