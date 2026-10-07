# 과정별 수강신청원서·가입정보 자동 입력 결과

2026-10-07 · 브랜치 `codex/course-application-document` · [설계](../../02-design/features/course-application-document-prefill.design.md) · [검수·화면·합성 PDF](../../03-analysis/course-application-document-prefill.analysis.md)

과정 소개와 모집 안내에서 **수강신청원서 작성**을 누르면 기존 수강생 서류 작성 팝업이 열리고 해당 과정명과 가입 성명·이메일·휴대전화가 입력된다. 기존 신청 화면과 나의 신청 현황에서도 같은 과정으로 연결된다. 비로그인 상태에서는 로그인 후에도 과정 선택을 유지한다. 자동 입력값은 수정할 수 있다.

현재 가입에서 수집하지 않는 주소·성별 등은 비워 두며, 유효한 기존 생년월일이 있는 회원만 생년월일을 채운다. 동의와 서명은 직접 작성한다. 가입 연락처 조회 실패·공개 과정 조회 실패·팝업 차단 시 사용자가 진행할 수 있는 안내를 제공한다.

설계 10개 항목 모두 충족. 실제 원서 팝업·로그인·접수 9개, 입력/요청 경계 8개, 기존 온라인 신청/관리자 조회 15개, 과정 카탈로그 17개, 역할 내비게이션 23개 통과. 기존 PDF 3종 검사와 lint/production build/manuals 검사도 통과했다. 실제 접수 검증은 전용 로컬 최신 스키마와 합성 회원을 사용했다.

DB migration은 필요하지 않다. 기존 온라인 수강신청·접수 기간 검사는 유지하며 원서 제출은 기존 문서 접수 절차를 따른다. 기능 브랜치를 push하고 PR의 Vercel 검사 통과 후 main에 병합한다. main production 배포의 commit·공개 과정 버튼·로그인 복귀 주소·health 검증 결과는 연결된 PR 본문에 기록한다.

## 재현

```sh
APPLICATION_TEST_DB_DIR=/tmp/u-livet-issues-db node scripts/setup-application-test.mjs
npm run build
APPLICATION_TEST_DB_DIR=/tmp/u-livet-issues-db node scripts/verify-application-flow.mjs --production
APPLICATION_TEST_DB_DIR=/tmp/u-livet-issues-db node scripts/verify-course-application-document.mjs
node scripts/verify-course-application-document-boundaries.mjs
node scripts/verify-course-catalog.mjs
node scripts/verify-role-navigation.mjs
node scripts/verify-learner-documents.mjs
```

검사에서 생성하는 `/tmp/u-livet-issues-browser-fixtures.json`에는 합성 계정 자격정보가 있으므로 커밋하지 않고 종료 시 삭제한다. 생성된 로컬 `artifacts/` 대신 검수 문서에 선별한 비식별 증거만 저장했다.
