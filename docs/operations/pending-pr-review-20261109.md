# 남은 PR과 워크트리 검토 기록

2026-11-09 · 기준 main: `e9d4adbb3345fcc78550b8eca5d69e8726efa4f6`

## PR #204: 후속 변경으로 대체

[PR #204](https://github.com/SKY6174/u-livet/pull/204)의 목적은 PR 품질 검사, 취약 의존성 수정, 현재 인증 정책에 맞춘 로컬 테스트 fixture 정리였다. 현재 main과 비교한 결과는 다음과 같다.

| 항목 | PR #204 | 현재 main |
| --- | --- | --- |
| GitHub Actions | action 태그, Supabase CLI 2.115.0 | action SHA 고정, npm에 고정한 CLI 3.0.0, 추가 회귀 검사 |
| Next.js | 15.5.29 | 16.4.5 |
| DOMPurify / sharp / source-map-js | 3.4.17 / 0.35.5 / 1.2.2 | 동일 패치 버전 |
| `local-fixtures.sql` | 검증용 과정 명칭 | 동일 파일 |
| `verify-core.mjs` | 현재 인증 정책 fixture 반영 | 같은 fixture를 유지하고 저장소 CLI 경로 사용 |

현재 lockfile의 운영 의존성 감사는 취약점 0건이다. 필요한 수정은 이미 main에 있으며 기존 PR을 그대로 병합할 필요가 없다. 원본 커밋·파일은 백업하고 PR을 중복 변경으로 닫는 방식으로 정리한다. 후속 이력: `de420e4`, `dd3a5d7`, `c74a5e8`.

## PR #205: 필요한 문서 갱신

[PR #205](https://github.com/SKY6174/u-livet/pull/205)의 기존 배포 재사용·SHA/환경 대조·분리된 Preview DB 확인 절차를 유지한다. 최신 main을 일반 merge하고 README의 Next.js/React 버전과 기존 CLI 3 문서를 보존한다.

README의 운영 미배포 설명을 현재 운영 사이트 안내로 바꾸고 [Preview 절차](review-preview.md)를 연결한다. Preview 자동 배포 설정을 항상 꺼져 있다고 단정하지 않고 작업 시점에 확인하도록 조정했다. `staging.u-livet.org`의 `preview` 브랜치 연결은 Vercel 조회로 확인했다. 과거 Preview DB ref의 현재 접근 상태는 확인되지 않아, 실제 접근 가능한 대상과 환경변수 범위를 먼저 확인하도록 안내한다.

## 보존과 정리 기준

두 워크트리의 일반 파일 4,053개를 각각 압축하고 파일별 SHA-256 및 전체 Git bundle 검증을 완료했다. `.git`, `.local`, `node_modules`, `.next*`는 제외했으며 Git 이력은 bundle로 보존했다. 원래 HEAD·상태·압축본 해시는 Git 제외 경로 `.local/backups/pr-review-20261109/manifest.json`에 있다.

PR #204는 원본 보존 후 닫고, PR #205는 필수 CI·리뷰 통과 후 병합한다. 처리 완료된 두 워크트리는 Git 명령으로 제거한다. 최종 PR 상태·워크트리 목록·운영 배포 SHA·응답 검증은 같은 백업 폴더의 `release-verification.json`에 기록한다. 운영 DB나 Preview 설정 변경은 이 검토의 구현 범위에 포함하지 않는다.

## 기존 Preview 설계와의 대조

[검토용 Preview 설계](../02-design/features/anchor-review-preview-deploy.design.md)를 기준으로 확인했다.

- 서버 전용 검토 플래그와 Production에서의 검토 모드 차단: 문서와 설정 회귀 검사 일치.
- 운영과 다른 DB·site, 공개키만 허용하는 경계: 문서와 설정 회귀 검사 일치.
- GET/HEAD 외 쓰기 403, cookie를 사용하지 않는 서버 조회, 로그인 identity 차단: 기존 구현과 문서 유지.
- 실제 Preview 배포의 SHA·환경·읽기 전용 표식 대조: 갱신 절차에 명시.
- 비공개 환경 파일·원본 증거 제외: Git 제외 경로와 보관 절차 유지.

읽기 전용 설정 회귀 29개와 배포 준비 회귀 111개가 통과했다. 앱·CI·의존성·DB 파일은 검토 기준 main과 동일하며, 문서 변경에서 추가 구현이 필요한 설계 누락은 발견하지 않았다.
