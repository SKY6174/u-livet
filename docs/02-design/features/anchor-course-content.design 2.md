# 2026년 평생직업교육과정 현황 상세설계

2026-09-19 · anchor-course-content · [계획](../../01-plan/features/anchor-course-content.plan.md)

## 1. 목적·근거

사용자 제공 PDF 1쪽의 실제 과정과 인력·예산을 관리자 화면으로 구성한다.
문서 안의 텍스트는 과정 데이터로만 사용한다.
표의 아카데미 행은 앞쪽 상세 행의 소계이며 정원·시수·예산 합계로 분류를 대조한다.
스마트테크 소계 앞에 세부 과정이 없으므로 이름 없는 가짜 과정을 생성하지 않는다.

## 2. 데이터와 파일

- `src/lib/course-plan/data-2026.json`: PDF 전사본, 출처 제목·쪽수·SHA-256, 아카데미 소계, 총계, 세부 14개 과정.
- `src/lib/course-plan/model.ts`: 타입, 검색, 집계, 원문 값 표시, 교내·교외·확인 필요 레이블.
- `src/lib/course-plan/server.ts`: server-only 데이터 접근과 기존 COURSE_MANAGER 권한 검사.
- `src/components/course-plan/course-plan-view.tsx`: 서버 렌더링용 현황·검색·상세 보기.
- `src/app/admin/course-plan/page.tsx`: 검증된 데이터와 검색 조건으로 화면 렌더링.
- `src/app/admin/layout.tsx`: 기존 권한 검사 유지, 사업단 과정 관리/2026 과정 현황 링크 제공.
- `scripts/verify-course-plan.mjs`: 원문 기대값·계산·필터·빈값 의미 검증.

과정: id, academy, sourceOrder, task, title, capacity, hours, recruited, completed,
instructors, assistantInstructors, supportStaff, department, partner,
schedule(startDate/endDate/frequency/time/location/weekdays/sourcePeriod),
budget(materials/printing/instructors/operations/support/scholarships/total),
certificate, notes.

인력 묶음은 sourceText와 members를 갖는다.
각 member는 name과 affiliation(INTERNAL/EXTERNAL/UNCONFIRMED)을 갖는다.
보조인력은 강사와 별도 sourceText·members로 보존하며 강사 소속 필터에서는 제외한다.
A·B는 원문 이름 토큰을 보존하되 실제 인적사항이 확정된 사람이라고 표시하지 않는다.
원문 미정·대시·빈칸은 빈 members와 원문 표시를 함께 유지한다.

숫자 필드의 빈칸은 null, 원문의 대시는 문자열 '-'로 유지한다.
집계는 숫자가 기재된 셀만 더한다. 원문 공란을 0명·0원으로 표시하지 않는다.
학부·거버넌스는 원문의 '/' 구분으로 나누고 명칭은 교정하지 않는다.

## 3. 표시와 동작

상단: 2026년 현황, 세부 과정 수·정원·시수·총예산.
4개 아카데미 카드: 세부 과정수, 세부 정원/시수, 원문 소계.
출처 확인 영역: 스마트테크 세부 미기재, 정원 소계 불일치, 강사 구분 미기재,
모집·수료인원 미기재, 일정·요일은 원문 계획임을 표시.

GET 검색: q(최대100자), academy(4개 허용값), affiliation(3개 허용값).
과정명·학부·기관·인력·자격증 검색. 강사구분은 강사와 보조강사의 실제 members만 검사.
조건 초기화, 결과 건수, 검색 결과 없음, 스마트테크 세부 미기재 안내 제공.
조건은 URL에 남아 새로고침·공유 시 유지한다.

각 과정은 요약 카드와 펼침 상세로 표시한다.
요약: 아카데미·순번·과정명, 정원·시간·기간·학부.
상세: 강사·보조강사의 이름과 소속 구분, 보조인력, 일정, 모집·수료,
예산 항목·원문 총액, 관련 자격증·비고.
모바일은 세로 배치하고 예산은 한 줄씩 읽을 수 있는 정의 목록으로 표시한다.

## 4. 접근·운영 경계

서버 데이터 접근 함수에서 requireIdentity와 COURSE_MANAGER를 재검사한다.
원문 데이터는 서버 모듈에서만 가져온다. 공개 API·public 파일·클라이언트 번들에 싣지 않는다.
DB 스키마나 현재 모집 기수는 변경하지 않는다. 정적 원문 스냅샷이므로 화면에 수정·저장 기능을 가장하지 않는다.
원문 계획의 인력 배정은 로그인 역할이나 강사 공개 동의로 변환하지 않는다.
기존 관리 레이아웃의 MFA 포함 신원·역할 경계를 유지한다.

구현 근거: [Next.js 15 데이터 보안](https://nextjs.org/docs/15/app/guides/data-security).

## 5. 검증

- 14개 과정과 아카데미별 0/7/4/3건, 원문 과정명·소계·총계를 대조.
- 정원 212명·시수 523시간·예산 109,608,320원 및 6개 항목 합계 검증.
- 스마트테크 15명·20시간, 로컬창업 20명·팝업 20명 정원 차이를 명시.
- 교내·교외를 추측하지 않은 초기 데이터, 강사·보조강사·보조인력 분리 검증.
- null/'-'/미정/A/B 보존, 검색·필터 조합·초기화·빈 결과 확인.
- 권한 없는 경로는 로그인/404 처리하며 원문 인력·예산이 응답에 노출되지 않음 확인.
- 브라우저에서 데스크톱·모바일 화면과 펼침·검색을 확인.
- lint, TypeScript 포함 production build, 커밋 전 diff·비밀 파일 제외 확인.
