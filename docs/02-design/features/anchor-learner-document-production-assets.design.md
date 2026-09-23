# 수강생 제출 PDF 운영 자산 포함 설계

> Version: 1.0.0 | Date: 2026-09-23 | Status: Approved
> Level: Dynamic | Plan: `docs/01-plan/features/anchor-learner-document-production-assets.plan.md`

## 원인

브라우저 미리보기는 `/forms/...`와 `/fonts/...` 정적 URL을 사용하므로 정상이다. `입력완료`는 서버 액션에서 `process.cwd()/public/...`를 직접 읽는다. 파일명에 문서 유형을 동적으로 조합하므로 Next.js 파일 추적기가 해당 PDF를 함수 의존성으로 발견하지 못했고, 기존 `outputFileTracingIncludes`에도 Nanum 글꼴 하나만 등록되어 운영 함수 `/var/task`에 수강생 양식이 포함되지 않았다.

## 구현

### 배포 자산

`next.config.js`의 전역 서버 trace에 다음을 추가한다.

- `public/forms/learner-application.pdf`
- `public/forms/learner-scholarship.pdf`
- `public/forms/learner-refund.pdf`
- `public/fonts/KoPubDotum-Medium.ttf`
- `public/fonts/KoPubDotum-Bold.ttf`

glob은 `./public/forms/learner-*.pdf`, `./public/fonts/KoPubDotum-*.ttf`로 선언한다. 브라우저 정적 제공과 서버 함수 파일 복사를 함께 지원하며 파일을 코드/base64에 중복 포함하지 않는다.

### 오류 처리

제출 액션의 catch에서 사용자에게 보여도 되는 렌더 검증 문구만 허용한다. `ENOENT`를 포함한 예상하지 못한 시스템 오류는 서버 로그에 오류 이름·코드만 기록하고, 화면에는 `제출 PDF를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.`를 반환한다. 절대 파일 경로와 내부 예외 문구는 응답에 넣지 않는다.

### 빌드 검증

`scripts/verify-learner-document-production-assets.mjs`는 `.next/server/**/*.nft.json`을 읽어 필수 다섯 파일이 하나 이상의 서버 trace에 모두 포함되는지 검사한다. production build 뒤 실행해 실제 패키징 입력을 검증한다.

## 변경 파일

- `next.config.js`
- `src/app/mypage/documents/actions.ts`
- `scripts/verify-learner-document-production-assets.mjs`

DB 스키마와 제출 RPC는 변경하지 않는다. 이전 실패는 DB RPC 호출 전에 발생했으므로 중복 접수 보정도 필요하지 않다.

## 검증

1. 변경 전 build trace에서 수강생 양식 누락을 재현한다.
2. production build와 trace 검사를 실행한다.
3. 세 PDF 1.7 렌더 회귀 검사를 실행한다.
4. 민원 DB 제출·파일·상태 이력 통합 검사를 실행한다.
5. 운영 배포가 새 revision과 healthy 상태인지 확인한다.
6. 운영 세션에서 실제 `입력완료`를 실행해 새 요청과 PDF 원본이 생성되는지 확인한다.

## 보안

- 원본 양식과 글꼴은 공개 자산이며 비밀정보를 포함하지 않는다.
- 시스템 파일 경로를 사용자 응답에서 제거한다.
- PDF는 서버에서 다시 생성하고 기존 SHA-256·크기·PDF 1.7 검사를 그대로 거친다.
