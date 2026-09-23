# 관리자 업무 흐름·실시간 요청함 개선 설계

> Version: 1.0.0 | Date: 2026-09-23 | Status: Approved by user request
> Level: Dynamic | Plan: `docs/01-plan/features/anchor-admin-workflow-inbox.plan.md`

## 1. 내비게이션 설계

`officeSections()`의 기존 역할 조건과 링크 주소를 유지하고 다음 순서로 재배치한다.

1. `기획·개설`: 과정 운영 관리, 전문가 관리, 운영계획서
2. `접수·운영`: 수강생 서류, 무료 주차권 관리
3. `마감·수료`: 결과보고서, 수료 검토, 증명 관리
4. `정산·성과`: 수납·환불, 연차 평가·성과
5. `계정·권한`: 구성원 관리

공통 헤더는 이 배열을 평면화하므로 데스크톱·모바일 메뉴에 같은 순서를 자동 적용한다. 업무 홈은 같은 배열을 섹션별 카드로 표현한다.

## 2. 실시간 접수 알림 설계

### 2.1 데이터 경계

- `getAdminLearnerDocuments({ kind: null, status: null, query: "" })`를 재사용한다.
- RPC가 조직 범위, `SYSTEM_ADMIN|COURSE_MANAGER|FINANCE`, 최근 MFA를 검증한다.
- `RECEIVED`, `REVIEWING`, `APPROVED`를 미종결 요청으로 집계한다.
- `APPLICATION`, `SCHOLARSHIP`, `REFUND` 유형별 건수와 최근 5건을 표시한다.
- 조회 실패는 알림 패널 안에서만 안내하고 나머지 업무 홈은 정상 렌더링한다.

### 2.2 UI

- `LearnerRequestAlerts` 서버 표현 컴포넌트는 전체 미종결 건수, 유형별 카드, 최근 요청 목록을 제공한다.
- 유형 카드는 기존 관리자 서류함의 `kind` 검색 파라미터로 연결한다.
- 최근 요청은 문서 종류, 신청자, 과정명, 접수 시각, 현재 상태를 표시한다.
- `AdminLiveRefresh` 클라이언트 컴포넌트는 문서가 보이는 동안 30초마다 `router.refresh()`를 호출하고 사용자가 즉시 갱신할 수도 있게 한다.
- 자동 갱신은 브라우저 탭이 숨겨져 있을 때 중지한다.

## 3. 수료 검토 전체 과정 설계

### 3.1 병합 규칙

- DB의 `life_catalog` 과정과 `PREFILLED_COURSES` 16개를 병합한다.
- `findPrefilledCourse()`의 기존 과정명 정규화 규칙으로 3개 이관 과정을 대응시킨다.
- 16개 원문 과정은 원문 순서를 유지한다.
- 원문 목록에 없는 DB 과정은 시작일·과정명 순으로 뒤에 추가한다.

### 3.2 표시와 동작

- DB 등록 과정: 상태·기간·정원을 표시하고 기존 `/completion/{id}`로 연결한다.
- 미등록 과정: `과정 등록 필요` 상태, 원문 기간·정원을 표시하고 수료 검토 링크를 비활성화한다.
- `COURSE_MANAGER`에게는 `/admin/courses?plan={sourceId}#new-course` 등록 링크를 제공한다.
- `CERTIFIER`에게는 담당자가 과정을 등록하면 검토할 수 있다는 안내만 표시한다.
- 상단 요약에 전체 운영 대상, 검토 가능, 등록 필요 건수를 제공한다.

## 4. 변경 파일

- `src/lib/auth/workspace-navigation.ts`: 업무 흐름 순서 재배치
- `src/app/admin/page.tsx`: 알림 데이터 조회·배치
- `src/components/admin/learner-request-alerts.tsx`: 요청 알림 UI
- `src/components/admin/admin-live-refresh.tsx`: 30초 자동·수동 갱신
- `src/lib/completion/offerings.ts`: 16개 운영 대상과 DB 과정 병합
- `src/app/completion/page.tsx`: 병합된 수료 검토 과정 표시
- `scripts/verify-role-navigation.mjs`: 메뉴 순서·업무 홈 알림 회귀 검사
- `scripts/verify-completion-index.mjs`: 과정 병합·권한별 동작 검사

## 5. 검증 계획

- 역할별 메뉴 링크와 정확한 업무 순서 검사
- 권한 없는 역할에서 알림 RPC를 호출하지 않는지 검사
- 미종결 상태와 문서 유형별 집계, 최근 요청 표시 검사
- 3개 DB 과정 + 16개 원문 과정 병합 시 16개가 표시되고 중복이 없는지 검사
- 관리자·수료 승인자별 미등록 과정 동작 검사
- 기존 서류 처리 워크플로 및 데이터 조회 검사
- ESLint, TypeScript/Next.js 프로덕션 빌드

## 6. 보안·성능

- 새로운 공개 API나 DB 함수는 만들지 않는다.
- 민감한 PDF 본문·주민번호·계좌·서명은 알림 데이터에 포함하지 않는다.
- 관리자 알림은 기존 마스킹 필드만 사용한다.
- 자동 갱신은 클라이언트에서 서버 컴포넌트를 다시 요청하되 30초보다 짧게 실행하지 않는다.
- 과정 등록 상태는 서버가 읽은 DB 행을 기준으로 하며 정적 원문 데이터는 권한을 부여하지 않는다.
