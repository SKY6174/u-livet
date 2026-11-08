# U-LiVET 폴더 정리 검증

2026-11-08 · [설계](u-livet-folder-cleanup.design.md)

## 로컬 구조 검증: 8/8

| 검증 항목 | 결과 |
| --- | --- |
| Documents의 프로젝트 항목 통합 | `u-livet`만 유지, 이전 이름 3개 및 백업·워크트리 별도 항목 제거 |
| 변경 보존 | 기본 checkout 포함 압축본 18개, 일반 파일 34,791개 SHA-256 대조 통과 |
| 커밋 보존 | 전체 Git bundle 검증 및 모든 워크트리 브랜치·기존 main·변경 보존 참조 존재 확인 |
| 완료 워크트리 정리 | 17개 보관 후 제거, 사라진 임시 경로 등록 2개 prune |
| 진행 중인 작업 유지 | PR #204·#205의 HEAD와 깨끗한 작업 상태 유지 |
| 느슨한 자료와 백업 | 기존 백업 3묶음 및 워크트리 모음의 나머지 자료를 `.local/backups`에 이동 |
| 기본 checkout 정리 | 로컬 변경 보존 후 원격 main 기준의 새 main 생성, 기존 main 브랜치 유지 |
| 비공개 파일 제외 | `.local/` Git 제외 규칙과 가상 SQL·환경 파일 경로 검사 통과 |

압축본은 `.git`, `.local`, `node_modules`, `.next*`를 제외했다. Git 이력은 bundle에 별도 보존하고 진행 중인 워크트리는 유지했다. 각 압축본 파일 수·해시·원래 HEAD·상태는 비공개 manifest에 기록했다.

Docker 컨테이너 34개의 마운트를 검사했으며 이동 대상 경로를 사용하는 컨테이너가 없었다. 컨테이너와 데이터베이스는 변경하지 않았다.

## 저장소 검사

- `git diff --check` 통과.
- `npm run test:release`: 111개 통과.
- `npm run test:production-origins`: 15개 통과.
- 앱 소스·의존성·데이터베이스 변경 없음.

## 릴리스 검증

[PR #209](https://github.com/SKY6174/u-livet/pull/209)는 UC1973 승인과 필수 CI 통과 후 병합했다. 기본 checkout은 병합 커밋 `967e01f3c324dbbbd173d56f1434a72d237066e9`로 동기화했다. 해당 커밋의 Git 연동 운영 배포가 `READY`가 된 뒤 홈·로그인·버전 API의 HTTP 200과 운영 revision 일치를 확인했다. 배포 후 15분 범위의 error·fatal 로그 조회 결과는 0건이었다. 최종 검증값은 로컬 백업의 `release-verification.json`과 [보관 상태 기록](u-livet-folder-cleanup.status.json)에 기록했다.
