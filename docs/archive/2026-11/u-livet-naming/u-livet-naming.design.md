# U-LiVET 실행 이름과 경로 통일 설계

2026-11-01 · [계획](u-livet-naming.plan.md)

## 저장소 변경

- `package.json`, lockfile의 루트 이름과 `/api/version.application`은 `u-livet`이다.
- 로컬 `supabase/config.toml.project_id`는 `u-livet-core`다. 관련 스크립트의 컨테이너·네트워크·레이블·임시 파일 이름도 같은 접두사를 사용한다.
- 이슈용 스크립트는 `u-livet-issues`를 사용한다. 현재 실행 문서의 작업 경로, 저장소 링크와 예제 호스트도 새 이름을 사용한다.
- favicon 경로를 `public/images/u-livet-favicon.png`으로 변경하고 참조를 갱신한다. 이미지 내용은 보존한다.
- `U-LIFE`, `U-LiVE` 등 과거 TOTP factor 식별은 기존 계정 호환성 때문에 보존한다. 이전 도메인 redirect, 과거 PDCA 문서, 이미 적용된 SQL migration, 발행 매뉴얼은 이력으로 유지한다.

## Docker 이전

- 먼저 로컬 Docker UNIX socket, 정확한 두 프로젝트만 대상으로 확인한다. 전체 inspect 결과와 DB dump는 Git 외부의 접근 제한된 백업 폴더에 보관한다.
- 서비스의 기존 Config, HostConfig, 이미지 파일 변경, 네트워크 별칭, 포트, 인증 환경변수, 실행 상태를 보존한다. 이름과 관련 경로만 변환한다.
- 그룹별 컨테이너를 정지한 뒤 이미지를 snapshot하고 DB/Storage 볼륨을 새 이름의 볼륨으로 복사한다. 원본 볼륨은 롤백용으로 남긴다.
- 새 네트워크와 컨테이너는 `u-livet-core`/`u-livet-issues` 레이블로 생성한다. DB를 먼저 시작하고 건강 상태를 확인한 다음 이전에 실행 중이던 나머지 서비스를 시작한다.
- 사라진 `/tmp` bind 파일은 컨테이너 내부 사본을 새 canonical 경로로 복원한다. 원래 중지된 Kong/Storage는 그대로 중지 상태를 유지한다.
- SQL 전체 logical dump 해시, 데이터베이스 목록, 실행 상태와 API health를 비교한 뒤 원본 컨테이너를 제거한다. 검증 실패 시 새 컨테이너를 정지하고 원본을 복원한다.
- 네트워크/볼륨 삭제, DB 초기화 및 운영 DB 변경은 수행하지 않는다.

## 배포와 검증

- Vercel의 고정 project ID와 team ID를 확인해 이름만 변경하며 도메인·환경변수·Git 연결을 보존한다.
- 소스 검증 후 작업 브랜치를 push하고 PR을 생성한다. 검사 결과를 확인한 후 정확한 PR head SHA를 지정해 병합한다.
- 운영 Git 배포가 READY인지 확인하고 `/api/version`의 새 이름과 병합 SHA, 홈페이지·인증 화면·favicon 응답을 검증한다.
- 변경량이 200줄을 넘으므로 설계 대비 gap analysis와 완료 보고를 기록한다.
