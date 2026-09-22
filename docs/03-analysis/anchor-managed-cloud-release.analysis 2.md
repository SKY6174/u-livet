# Gap Analysis: anchor-managed-cloud-release

2026-09-19 · [설계](../02-design/features/anchor-managed-cloud-release.design.md)

## Match Rate: 100% (이번 배포 설계 10/10)

전체 플랫폼의 실사용 준비율을 의미하지 않는다. 메일·기관 승인 문안·최초 관리자·실제 과정 등록은 후속이다.

| 설계 항목 | 검증 결과 |
|---|---|
| Supabase Cloud native 비밀번호 | 최소 12자와 대문자·소문자·숫자·특수문자 조건 설정/readback, 각 누락 조건 직접 API 거부 |
| 친절한 비밀번호 UI | 대문자/소문자 체크 분리, 운영 브라우저에서 보이기→숨기기 확인 |
| Cloud 호환 migration | 자체 서버 전용 2개 미적용 보관, 지원 auth.users 트리거 사용, 양 DB 23개 일치 |
| 세션·MFA·역할 | 합성 계정 로그인/TOTP/최근 인증/마지막 factor/비밀번호 변경 이전 세션 거부, Preview 실제 검사 20개 |
| 업무 저장·RLS | COURSE_MANAGER 추가 역할을 가진 관리자 저장 성공, 학습자 저장 및 타인 프로필 접근 거부 |
| 메일 후속 처리 | 공개 가입 중지, 홈페이지 가입/복구 폼과 직접 server action 모두 준비 중 안내 |
| 남용 방지 | native 한도 + 홈페이지 HMAC RPC, 양 배포 로그인 action이 native Auth까지 도달함 확인 |
| 환경 분리·비밀 관리 | 환경별 ref/origin/키/독립 HMAC, 공개 변수 제한, 정상 업무 모드 설정 검사 통과 |
| 동일 소스 배포·화면 교체 | preview/main `1688558` Ready, 각 `/api/version` SHA 일치, 운영 최신 hero 및 로그인 화면 확인 |
| DB 보호·확인 | 운영 public schema/data 사전 백업, 테스트 계정/기관 0개 잔존, 양 DB 보안 advisor 경고/오류 0 |

설정 검사 232개(23+111+29+69), lint, 깨끗한 체크아웃 Node 24 빌드 통과. 배포 후 양쪽 `/api/health` 200. 운영 비로그인 `/admin`은 로그인으로 307 이동한다. 메일 API 실제 전달은 미설정으로 시험하지 않았다.

추가 보완: 비밀번호 변경 전 세션이 MFA 관리 RPC에도 진입하지 못하도록 auth_status를 강화했다. native MFA API의 factor 변경 제한을 자체 서버 구현과 동일하다고 주장하지 않는다. 알려진 고유출 비밀번호 거부도 활성화했다.

문서 기록 커밋은 검증된 기능 커밋 `1688558`을 계승하며, 두 브랜치에 동일하게 반영한다. 최종 배포 커밋은 각 사이트 `/api/version`으로 확인한다.
