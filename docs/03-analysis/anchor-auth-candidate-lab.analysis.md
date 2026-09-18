# Gap Analysis: anchor-auth-candidate-lab

2026-09-19 · [설계](../02-design/features/anchor-auth-candidate-lab.design.md)

## 범위 내 일치율: 10/10, 100%

이 수치는 격리된 로컬 인증 시험 도구의 설계 충족률이며 홈페이지나 운영 준비율이 아니다.

| 설계 항목 | 구현·근거 |
|---|---|
| 새 로컬 자원만 사용 | 무작위 이름, 실행 라벨, Unix socket 강제, 외부 target 인자 미지원 |
| 내부망·최소 공개 | backend 단일 내부망, 직접 host port 없음, relay의 loopback 임시 port 검사 |
| 실제 이미지 확인 | 로컬 ID로 생성·실행 ID 비교, 결과 JSON 기록 |
| DB bootstrap·22개 migration | 새 tmpfs Postgres + native Auth migration 후 파일별 적용 성공 |
| 비밀번호 조건 | 거부 4종, 허용 5종을 실제 Auth signup에서 검증 |
| 이메일 확인 | Mailpit 수신·verifyOtp, 미확인 로그인 거부 |
| 복구·정책·세션 | native Auth와 실제 DB/RPC를 연결한 감사·위조·만료·재사용·JWT/refresh 회수 검사 |
| MFA 경계 | TOTP 실제 검증, 직접 native API 우회·마지막 factor·오래된 증명 차단 |
| 비밀 비출력·제한 시간 | generic 오류, 허용된 결과만 출력, 요청/startup 제한; 임시 원인 진단 출력 제거 |
| 정리·보고 한계 | cleaned/existingContainersPreserved 모두 true, 잔여 라벨 자원 0, 운영 예외 문서화 |

## 실제 검사

- 최종 `test:auth-candidate`: 28 passed, exit 0. [실행 기록](../validation/auth-candidate-20260919.json).
- 신규 두 스크립트 `node --check`와 `git diff --check`: 통과.
- 실행 후 해당 라벨의 컨테이너·네트워크 조회: 0개.
- 기존 앱 코드, Cloud DB, `.env.local`, Vercel 배포 변경 없음. 기존 292개 사전 검사 결과를 이번 실행으로 재보고하지 않는다.

## 수정된 차이

Docker Desktop의 내부망에서 직접 port publish가 되지 않아 고정 경로 relay를 추가하고 설계에 반영했다. ingress에서 시작한 뒤 내부망을 연결해야 port binding이 유지됐다. 새 일반 PostgreSQL에서 Auth의 search_path를 지정하지 않으면 public schema 생성 권한 오류가 발생하므로 테스트 bootstrap에 `search_path=auth`를 명시했다. 앱 migration이나 운영 권한을 완화하지 않았다.

공식 전체 Supabase 배포, HTTPS·SMTP·CAPTCHA·브라우저 업무·백업 인수는 계획상 후속이다. SIGKILL/호스트 장애 후 자동 정리는 보장하지 않는다. 테스트 중 기존 컨테이너의 상태가 외부 작업으로 바뀌어도 보존 검사 실패로 보고한다.
