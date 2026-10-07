# DB 개설 과정만 수강신청원서에 사용

2026-10-07 · application-document-db-courses · Dynamic

## 목표

수강신청원서의 자유 과정명 입력과 미연결 과정 안내 선택을 없애고 실제 DB 개설 기수를 선택하게 한다.
UI, 서버 액션, 직접 RPC 제출에서 같은 기준을 적용한다.

## 범위와 완료 기준

- 기존 공개 카탈로그 중 유효한 개설 기수 ID가 있는 항목만 제공한다.
- 원서의 과정 선택은 ID 기반 드롭다운이며 과정명과 교육기간을 표시한다.
- 서버는 필수 기수 ID와 실제 DB 공개 과정/공개 안내의 연결을 재검증한다.
- DB는 신규 APPLICATION 제출의 누락·존재하지 않는·비공개 기수를 거부한다.
- 기존 문서 원본과 상태·원서 재시도·장학/환불 자격·수강 등록 절차는 보존한다.
- 로컬 경계·RPC·브라우저 검사, lint/build 후 PR 생성, 병합, push 및 운영 배포를 완료한다.

## 참조

application-document-link 및 anchor-learner-document-workflow 설계를 사용한다.
운영 대상은 u-livet.org, Supabase uoebygejgglgiivzgyks, Vercel prj_h5sjV2a5VUNpxFMEa1dPYwoFMAz0이다.
