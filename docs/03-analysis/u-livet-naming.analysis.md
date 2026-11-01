# U-LiVET 실행 이름 통일 검증

2026-11-02 · [설계](../02-design/features/u-livet-naming.design.md)

## 구현 및 로컬 이전: 8/8 일치

| 설계 항목 | 결과 |
| --- | --- |
| 패키지·버전 API | `u-livet`, lockfile 일치 |
| 기본/이슈 DB 식별자와 검증 스크립트 | `u-livet-core` / `u-livet-issues` |
| favicon 파일과 참조 | `u-livet-favicon.png`, 원본 바이트 동일 |
| 내부 문서 복귀 헤더 | middleware와 layout 모두 `x-u-livet-document-return-to` |
| Docker 프로젝트·컨테이너·네트워크·볼륨 | 새 이름으로 생성, 기존 실행 상태 보존 |
| 로컬 DB 보존 | 두 DB의 전체 logical dump가 이전/이후 동일, `select 1` 정상 |
| Vercel 및 로컬 연결 정보 | 고정 project/team ID 유지, 이름은 `u-livet` |
| 현재 운영 안내와 호환성 | 현재 로컬 식별자 갱신, 과거 migration·factor·도메인 이력 보존 |

Docker 검증값(SHA-256, 무작위 psql restrict key만 제외):

- issues: `2a608e0570ad529c093f15aef24705297130b01f929dcbee10048686d63032af`
- core: `85cbc3874b69ac5b76c62e1a91e2a6507a2c2a55adbd4831216bc0cca48c95f1`

issues는 5개 서비스가 실행 중이다. core는 기존과 같이 4개 실행, Kong/Storage 2개는 시작하지 않았다. 이전 이름의 컨테이너는 남지 않았다. 원본 볼륨과 snapshot 이미지는 로컬 롤백 자료로 보존한다.

## 검증 결과와 한계

- `npm ci --ignore-scripts`, `npm run lint`, `npx tsc --noEmit`, `npm run build` 통과. 변경한 모든 `.mjs`의 `node --check` 통과.
- 배포 준비 검증 111개 통과, 발행 매뉴얼 5개 버전 검사 통과.
- 빌드한 로컬 서버에서 `/api/version`, `/auth/login`, `/favicon.ico`, `/images/u-livet-favicon.png` HTTP 200. 두 favicon 응답은 원본 바이트와 일치.
- 이슈 프로젝트는 Supabase CLI에서도 새 이름으로 인식되며 API는 기존 56321 포트를 사용한다. 인증 API health도 정상이다.
- 문서 경계, NAVER, Kakao, social routing의 기존 검증 스크립트 4개는 mock 의존성 누락으로 실패한다. Git HEAD의 변경 전 소스를 메모리에서 로드해도 같은 실패를 재현했다. 이번 이름 변경으로 발생한 실패가 아니다.
- 첫 Docker 이전은 UNIX socket HTTP Host 헤더 오류로 자동 복구됐다. 재시도에서는 Kong 파일의 UID/GID 보존을 보완했다. 최종 데이터와 서비스 상태 검증은 통과했다.
- 운영 Supabase 프로젝트 이름은 기존부터 `u-livet`이었다. 운영 DB와 인증 설정은 이번 작업에서 변경하지 않았다.

운영 배포 검증은 PR 검사와 병합 후 `u-livet.org/api/version`의 application·revision, 홈페이지·로그인·favicon 응답으로 수행한다.
