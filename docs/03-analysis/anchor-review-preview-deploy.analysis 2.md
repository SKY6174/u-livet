# Gap Analysis: anchor-review-preview-deploy

2026-09-19 · [설계](../02-design/features/anchor-review-preview-deploy.design.md)

## 검토용 배포 범위: 15/15 충족

이 평가는 로그인·쓰기 기능을 잠근 검토용 Preview에 한정한다. 전체 서비스의 운영 인수율을 뜻하지 않는다.

| 설계 항목 | 확인 결과 |
| --- | --- |
| Preview 전용 모드 | production 대상/운영 DB·사이트 재사용을 검사에서 차단 |
| 공개 키만 사용 | 별도 Preview 환경변수 8개, 서버 키·인증 실행 설정 미등록 |
| 쓰기 차단 | 실제 POST /auth/login, POST /api/verify, DELETE /api/health 모두 403 PREVIEW_READ_ONLY |
| 사용자 권한 차단 | 세션 null·cookie 무시 구현 확인; /admin, /instructor는 로그인으로 307 |
| 인증 폼 차단 | 실제 로그인·가입·복구 HTML의 submit 버튼 disabled 확인 |
| 복구 token 교환 차단 | review 분기에서 RecoveryForm 대신 안내 표시 |
| 공통 안내 | 실제 홈페이지·과정·인증 화면의 검토용 배너 확인 |
| 색인·캐시 제한 | 실제 응답에서 noindex, nofollow 및 no-store 확인 |
| Git 업로드 경계 | env/프로필/실제 증거 제외, 스테이징 비밀 패턴 검사 완료 |
| Preview Git push | origin/preview 소스 커밋 86261dc350a56912b42b9cc4c7997af0d9a958cf |
| 원격 빌드 | dpl_BLG7seiXeJfx9xUbxgpYiecvdJBU Ready; 위 SHA 일치 |
| 공개 DB 연결 | 실제 /api/health 200 healthy; 홈페이지·과정 200, 정상 빈 과정 목록 |
| 운영 보존 | main SHA 1a4bf135113778ff701a31b4ad7fbac6e60dadd6; production ID dpl_5oUNkKzXTdcc1bdkrEeSjmGPCjQa 유지 |
| DB 변경 방지 | 기존 Preview 19개 migration 유지; 새 Supabase 브랜치 없음 |
| 공개 응답 검사 | 가입 화면과 참조 JS 9개에 운영 ref·sb_secret 패턴 없음 |

## 검사 및 차이

설정 테스트 29개, 기존 release 검사 111개, self-hosted 검사 111개 통과. lint 및 env 파일 없는 checkout의 Node 24 npm ci/build:vercel 통과. 원격 빌드에서도 설정 검사·Next 빌드 완료.

최초 원격 실패는 Vercel 자동 공개 메타데이터 허용 목록 누락이었다. 실제 변수 이름과 build-utils의 prefix 생성 로직을 확인해 명시적으로 추가했다. 접두사 전체 허용이나 운영 검사 완화는 하지 않았다.

가입 화면의 공개 JS에는 Supabase ref 자체가 포함되지 않았다. 이 검사는 해당 화면이 참조한 9개 JS에 대한 검사이며, 모든 보호 화면의 번들에 대한 완전한 보안 검사는 아니다.

브라우저는 Vercel 로그인 화면으로 이동하여 기존 접근 보호를 확인했다. 보호를 해제하지 않았고, 실제 서비스 응답은 인증된 Vercel CLI 요청으로 검증했다. 원격 브라우저의 비밀번호 토글 등 상호작용은 이번 검사에 포함하지 않았다.

## 남은 전체 서비스 작업

별도 인증 서버 연결, 인증 migration 3개, SMTP/Turnstile/MFA, 기관 정책 승인 및 역할별 업무 인수는 검토용 배포 범위 밖이다. 검토 플래그 해제만으로 운영 전환할 수 없다.
