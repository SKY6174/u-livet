# 수강생 제출 PDF 운영 자산 포함 계획

> Version: 1.0.0 | Date: 2026-09-23 | Status: Approved
> Level: Dynamic

## 목적

운영 서버의 `입력완료` 처리에서 수강신청원서 PDF 원본을 찾지 못하는 문제를 해결한다. 서버 PDF 생성에 필요한 세 원본 양식과 두 한글 글꼴을 Next.js/Vercel 함수 산출물에 명시적으로 포함하고, 내부 파일 경로 오류가 사용자에게 노출되지 않게 한다.

## 범위

- `outputFileTracingIncludes`에 `public/forms/learner-*.pdf`와 KoPubDotum TTF 두 파일 추가
- 제출 액션의 PDF 자산 읽기 실패를 일반 사용자 안내로 변환
- production build의 NFT trace에 모든 자산이 포함되는지 자동 검증
- PDF 1.7 및 서류 민원 DB 통합 회귀 검사
- 운영 배포 후 실제 함수 번들·revision·health 확인

## 완료 기준

- [ ] production trace에서 5개 필수 파일을 모두 찾는다.
- [ ] 패키징된 서버 함수에서 세 서식 PDF를 생성할 수 있다.
- [ ] 파일 시스템 경로와 `ENOENT`가 사용자 메시지에 노출되지 않는다.
- [ ] 기존 다운로드·제출·상태 이력 동작이 유지된다.
- [ ] Git main과 운영 배포가 같은 커밋을 제공한다.

## 위험과 대응

| 위험 | 대응 |
|---|---|
| 동적 파일명이 trace에서 누락 | glob으로 세 원본을 명시하고 빌드 후 trace 검사 |
| 글꼴 누락으로 다음 오류 발생 | 사용 중인 두 TTF도 같은 trace 규칙에 포함 |
| 원인 진단 정보 소실 | 서버에는 `console.error`로 오류 종류만 기록하고 사용자에게는 일반 문구 제공 |

## 참조

- `docs/02-design/features/anchor-learner-document-workflow.design.md`
- `src/app/mypage/documents/actions.ts`
- `next.config.js`
