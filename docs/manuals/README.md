# U-LIFE 운영대상별 매뉴얼

웹 진입점: `/manuals`. 현재 판: **1.1.0 (2026-09-23)**. 제작 상태: 소스 기준 제작본, 실제 운영 검수 전.

## 문서 대장

| 번호 | 대상 | 고정 웹 주소 | 배포 파일 |
|---|---|---|---|
| UL-M01 | 수강생 | `/manuals/learner/1.1.0` | [PDF](../../public/manuals/1.1.0/learner.pdf) |
| UL-M02 | 교내 강사 | `/manuals/internal-instructor/1.1.0` | [PDF](../../public/manuals/1.1.0/internal-instructor.pdf) |
| UL-M03 | 교외·보조강사 | `/manuals/external-instructor/1.1.0` | [PDF](../../public/manuals/1.1.0/external-instructor.pdf) |
| UL-M04 | 과정 운영 | `/manuals/course-operator/1.1.0` | [PDF](../../public/manuals/1.1.0/course-operator.pdf) |
| UL-M05 | 수료·증명 | `/manuals/certification/1.1.0` | [PDF](../../public/manuals/1.1.0/certification.pdf) |
| UL-M06 | 수납·환불 | `/manuals/finance/1.1.0` | [PDF](../../public/manuals/1.1.0/finance.pdf) |
| UL-M07 | 성과·평가 | `/manuals/performance/1.1.0` | [PDF](../../public/manuals/1.1.0/performance.pdf) |
| UL-M08 | 사업단·시스템 관리자 | `/manuals/administrator/1.1.0` | [PDF](../../public/manuals/1.1.0/administrator.pdf) |

[전체 합본 PDF](../../public/manuals/1.1.0/all.pdf). 대상별 Markdown도 같은 폴더의 `.md` 파일로 제공한다. 웹 footer의 **이용 매뉴얼**에서 접근한다. 초판은 `public/manuals/1.0.0`과 버전 고정 웹 주소에서 그대로 보존한다.

## 관리 원칙

- 정본은 `src/content/manuals/{version}.json`이다. 공통 안내·절차·개정 이력까지 버전별로 고정한다.
- 버전은 8종 묶음에 공통 적용한다. 큰 업무/권한 변경 MAJOR, 업무 추가 MINOR, 오탈자/설명 수정 PATCH.
- `/manuals/{대상}`은 현재 판으로 이동한다. 배포 이메일·교육자료에는 `/manuals/{대상}/{버전}` 고정 주소를 적는다.
- 발행한 JSON, PDF, Markdown, manifest를 수정·삭제하지 않는다. 초판의 오탈자도 새 판으로 고친다.
- manifest의 SHA-256은 우발적 변경을 감지한다. 전자서명이나 기관 승인 증명이 아니다. Git 변경 이력과 검토로 manifest 자체의 보존도 확인한다.
- 원문에 실제 계정·비밀번호·개인정보·보안 설정을 넣지 않는다. 사용자 안내는 공개 열람 가능하며 실제 업무 페이지는 기존 인증·권한을 유지한다.
- 문서 검토 담당자는 지정 전이다. 소유자가 업무별 검토자를 지정하고 검수 기록을 새 버전에 반영한다. 승인자·운영 검수 완료를 임의 기재하지 않는다.

## 개정 순서

1. 담당자는 변경 요청에 대상/문서번호, 현재 버전, 변경 이유, 화면·업무 근거, 적용일, 검토 담당자를 기록한다.
2. 기존 JSON을 새 버전 파일로 복사한다. `version`, `releasedOn`, `title`, `status`, `sourceCommit`, `scope`, `changes`와 영향받은 절차를 갱신한다. 변경 이력에는 변경 대상과 절차를 구체적으로 적는다.
3. `releases.json`의 `versions` 뒤에 새 버전을 추가하고 `current`를 새 판으로 바꾼다. `src/lib/manuals/data.ts`에도 새 JSON import와 `MANUAL_RELEASES` 항목을 추가한다. 기존 import를 유지한다. 검증기가 두 목록의 불일치를 감지한다.
4. `npm run manuals:build`로 **아직 발행하지 않은 버전**의 검토용 PDF/Markdown을 `tmp/manuals-draft`에 만든다. PDF를 렌더링하여 제목·목차·쪽수·한글·줄바꿈을 확인하고 실무 검토를 받는다.
5. 수정이 끝나면 `npm run manuals:release`로 로컬 배포 폴더를 확정한다. `public/manuals/{version}`과 `output/pdf/manuals/{version}`이 생성된다. 이 명령은 원격 사이트에 배포하지 않는다.
6. `npm run manuals:check`, `npm run test:manuals`, lint/build와 웹 검색·버전 선택·구판 링크·다운로드를 확인한다.
7. 원문, catalog, loader, 버전별 배포 폴더, 검토 기록을 **같은 Git 변경**으로 보관하고 `manuals-v1.0.0` 같은 버전 태그를 붙인다. 이 프로젝트의 검토·배포 절차로 반영한다. `output/pdf`는 로컬 전달용 복사본이다.
8. 새 PDF·고정 링크를 전달하고 구판 사용 담당자에게 변경 내용을 안내한다. 이전 파일·URL은 유지한다.

## 명령과 실패 대응

```sh
npm run manuals:build
npm run manuals:release
npm run manuals:check
npm run test:manuals
```

이미 발행된 버전은 생성 명령도 재생성하지 않고 해시만 검사한다. 내용 수정이 발견되면 현재 버전을 덮어쓰지 말고 원본을 Git에서 복원한 뒤 새 버전으로 진행한다. 파일이 손실된 경우 해당 발행 커밋의 배포파일을 복원한다. 생성 도구 변경으로 PDF가 달라져도 새 버전 발행이 필요하다.

`npm run build`와 Vercel의 `npm run build:vercel`은 사전 단계에서 매뉴얼 무결성을 검사한다. 발행본이 누락되거나 같은 버전의 내용이 변경되면 배포 빌드를 중단한다.

생성에는 Node.js와 프로젝트의 pdf-lib/fontkit, `assets/fonts/NanumGothic-Regular.ttf`를 사용한다. 네트워크·DB·실제 사용자 자료가 필요 없다. 버전 검증은 무결성과 구조를 확인하며 실제 운영 승인이나 모든 업무 권한 검수를 대신하지 않는다.

## v1.1.0 검토 근거

각 JSON 문서의 `sources`와 배포 Markdown의 작성 근거에 실제 화면/설계 경로를 기록했다. v1.1.0은 `manuals-v1.0.0` 이후 변경을 감사해 수강생 문서 탭, 책임강사 지정, 분리된 계획·결과 목록, 강의날인·QR 출석 증빙, 예산 선확정, PDF·AI 검토 초안, 일정 날짜·시간 분리, 장학금 세부내역, 첨부 1~5, 16:9 사진과 페이지당 8장 출력 기준을 반영했다. 특히 PDF 작성과 접수, QR 입실과 출석 확정, 저장·서명·검토 요청·최종 제출, 원본 근거와 현재 승인 값을 구분한다.
