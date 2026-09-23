# 환불 PDF 체크박스 및 서류 DB 최적화 설계

> Version: 1.0.0 | Date: 2026-09-23 | Status: Approved
> Level: Dynamic | Plan: `docs/01-plan/features/anchor-refund-check-db-optimization.plan.md`

## 1. PDF 렌더링

원본 `learner-refund.pdf`에서 발생일 선택 문구가 차지하는 `x=148..525`, `top=325.5..343.5` 영역만 흰색으로 덮는다. 표의 좌우·상하 경계선과 왼쪽 제목 셀은 건드리지 않는다.

다섯 선택지는 동일한 방식으로 다시 그린다.

- 사각형: 7pt 정사각형, 0.65pt 검정 테두리
- 문구 시작점: 사각형 오른쪽에서 3pt 뒤
- 체크 표시: 좌상단 기준 내부 1.2pt 이상 여백을 둔 두 선분
- 문구: 원본과 비슷한 8.6pt 한글 글꼴, 행 높이 중앙 정렬
- 선택지 시작점: 원본의 `153, 189, 258.5, 327, 395.5pt`를 유지

기존 `check()`는 다른 원본 양식의 인쇄된 사각형 위에 표시만 얹으므로 변경하지 않고, 환불 행 전용 `boxedChoice()`를 추가한다.

## 2. DB 연결성 판정

현재 모델의 연결은 다음과 같이 유지한다.

| 연결 | 보장 수단 |
|---|---|
| 요청 → 수강생 | `person_id` FK와 제출 RPC의 `life_private.person_id()` |
| 요청 → 조직·과정 | `org_id` FK와 `(offering_id, org_id)` 복합 FK |
| 요청 → 처리자 | `reviewer_id` FK와 담당 조직 역할 검사 |
| 요청 → 이력 | `events.request_id` FK, 삭제 시 cascade |
| 요청 → PDF 원본 | private 테이블의 `request_id` PK/FK, SHA-256 검사 |
| 환불 금액 → 과정 수강료 | 제출 RPC가 `life_offerings.tuition`으로 재계산 |

서류 민원과 회계 환불은 행정 신청과 실제 지급이라는 서로 다른 수명주기를 가지므로 자동 FK로 결합하지 않는다. 관리자가 `COMPLETED`로 기록하는 현재 경계를 유지한다.

## 3. 조회 최적화

### 3.1 인덱스

- `(org_id, status, kind, submitted_at desc)` 복합 인덱스: 관리자 조직·상태·종류 동시 필터
- `course_name` trigram GIN: 과정명 부분 검색
- `applicant_name` trigram GIN: 신청자명 부분 검색

`pg_trgm`은 `extensions` 스키마에 설치한다. 기존 인덱스는 다른 단일 필터와 정렬 경로에 사용될 수 있으므로 제거하지 않는다.

### 3.2 관리자 RPC

`life_private.admin_learner_documents`를 교체한다.

1. 호출자 person과 MFA를 한 번 확인한다.
2. 역할 테이블에서 현재 유효한 담당 조직을 `authorized_orgs` materialized CTE로 한 번 계산한다.
3. 필터·정렬 후 최근 500건을 `selected_requests`로 먼저 제한한다.
4. 선택된 요청에 대해서만 reviewer와 사건 이력을 결합한다.
5. 목록 JSON에는 기존 필드를 유지해 앱 호환성을 보존한다.

이 방식은 요청마다 `learner_document_staff()`가 person, MFA, 역할을 반복 조회하던 경로를 없애고 최대 응답 크기를 제한한다.

## 4. 변경 파일

- `src/lib/learner-documents/pdf.ts`
- `supabase/migrations/20260923200500_anchor_refund_check_db_optimization.sql`
- `scripts/verify-learner-documents.mjs`
- `scripts/verify-learner-document-workflow.mjs`

## 5. 검증

- 환불 PDF를 PNG로 렌더해 다섯 사각형, 3pt 간격, 선택 표시 경계를 육안 확인한다.
- PDF 1.7과 기존 세 양식 회귀 검사를 실행한다.
- 로컬 DB에 migration을 적용하고 FK·RLS·함수 권한을 확인한다.
- 종류+상태 필터와 부분 검색 인덱스 경로를 `EXPLAIN`으로 확인한다.
- 멱등 제출, 조직 격리, 파일 무결성, 상태 이력 검사를 재실행한다.
- TypeScript, ESLint, production build를 실행한다.
- 운영 DB migration, Git main, 운영 revision과 health를 확인한다.

## 6. 보안

- public 테이블 직접 권한은 계속 철회한다.
- 관리자 목록은 `authenticated`, MFA verified, 유효 역할, 조직 범위를 모두 만족해야 한다.
- 상태 변경은 기존 recent MFA와 revision 잠금을 그대로 사용한다.
- 검색어 최대 100자와 문서 유형·상태 허용 목록 검증을 유지한다.
- PDF 바이트는 관리자 목록 JSON에 포함하지 않는다.
