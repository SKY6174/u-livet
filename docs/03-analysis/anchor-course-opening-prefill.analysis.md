# 계획서 등록 양식 연결 설계 대조

> 2026-09-19 · Feature: anchor-course-opening-prefill
> [설계](../02-design/features/anchor-course-opening-prefill.design.md)

## 일치율: 100% (등록 준비 연결 8/8)

| 항목 | 결과 | 근거 |
|---|---|---|
| 16개 과정별 등록 링크 | 충족 | 카드별 원문 ID만 `/admin?plan=...`로 전달 |
| 허용된 기본값만 변환 | 충족 | 6개 편집 필드·길이 한계·원천 불변 검사 |
| 필수 미확정 항목 유지 | 충족 | 사업연도/방식 3개 선택과 날짜 4개가 빈 필수값 |
| 출처·원문 오류 안내 | 충족 | P05/P08/P10/P11 예외가 참고 안내에 유지 |
| 기존 저장 경로·권한 유지 | 충족 | 실제 관리자 페이지 모듈을 실행해 인증·역할·404·연도 범위 검사 |
| 선택 변경과 수동 입력 | 충족 | sourceId key·선택 해제 링크·기존 수동 기본값 검사 |
| 사용자 결정 기록 | 충족 | 16개 전체, 모집기간 미정으로 운영 문서 갱신 |
| 회귀·빌드·브라우저 | 충족 | 신규 7 + 기존 23개 검사, lint/빌드, 모바일 폼 확인 |

## 검증 결과

- `node scripts/verify-course-opening-prefill.mjs`: 7개 통과.
- `node scripts/verify-course-opening.mjs`: 9개 통과.
- `node scripts/verify-course-plan.mjs`: 14개 통과.
- `npm run lint`, `git diff --check`: 통과.
- Git 파일과 현재 변경분을 새 임시 디렉터리로 복사해 `PREVIEW_REVIEW_ONLY=true npm run build`: 타입·린트·빌드 성공. 기존 작업 폴더의 중복 생성된 `.next` 파일은 수정하지 않았다.
- 빌드의 클라이언트 정적 JavaScript에 운영계획서 원천 JSON의 상태 문자열이 없음을 확인했다.
- 실제 Server Component/모델과 빌드 CSS의 루프백 fixture에서 개설 준비 P08 카드 → 등록 양식 이동을 검증했다. 연도·방식·4개 날짜는 빈 값이며 브라우저 `checkValidity()`가 false였다.
- 불러온 과정명을 편집할 수 있었고, 직접 입력으로 전환하면 과정명은 비워지고 기존 대면 기본값으로 돌아왔다.
- 1280px 데스크톱과 390px 모바일 화면을 직접 확인했다. 모바일 `scrollWidth === innerWidth === 390`, 페이지 오류 없음.

## 한계와 후속 작업

실제 운영 계정으로 MFA 로그인하거나 기수 저장을 수행한 검증은 아니다. 폼 검증은 읽기 전용 fixture이며 DB write를 실행하지 않았다.
사용자가 모집기간을 미정으로 답했으므로 실제 초안 등록·공개는 계속 미완료다. 확정된 기간과 나머지 개설 조건을 받으면 기존 저장·정책 승인 절차로 진행한다.
