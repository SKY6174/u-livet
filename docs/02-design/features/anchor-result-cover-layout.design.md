# 결과보고서 커버 레이아웃 조정 설계

2026-09-23 · anchor-result-cover-layout

## 출력 구조

- `DocumentPreview`의 결과보고서 커버 표를 네 행으로 렌더링한다.
  1. 영역
  2. 세부프로그램명
  3. 교육기간
  4. 책임강사
- 책임강사 값 셀은 `소속`, `성명`, `(서명)`과 서명 이미지를 하나의 전용 컨테이너로 묶는다.
- 기존 `op-result-signature` 블록과 표 아래 원본 참고 서명 영역은 제거한다. 원본 PDF에서 가져온 서명 이미지는 직접 서명이 없을 때 책임강사 표 셀 안에서 사용한다.
- 커버 출력면의 푸터 중앙은 빈 칸으로 유지하고, 두 번째 출력면부터 `출력면 인덱스`를 페이지 번호로 사용한다.

## 데이터 흐름

1. `life_private.operation_context(offering_id)`가 현재 책임강사의 이름과 소속을 반환한다.
2. 소속은 해당 기관의 승인 강사 풀 `life_private.instructor_pool.affiliation`을 우선한다.
3. 강사 풀 소속이 비어 있으면 과정의 운영기관 `life_organizations.name`을 사용한다.
4. 관리자 편집 미리보기와 저장본 출력 경로 모두 같은 `DocumentContext.responsible.affiliation`을 `DocumentPreview`에 전달한다.

## DB 변경

- 테이블은 변경하지 않는다.
- 기존 `life_private.operation_context(uuid)` 함수의 `responsible` JSON에 `affiliation`만 추가한다.
- 함수의 `SECURITY DEFINER`, 빈 `search_path`, 기존 접근 검사와 반환 범위는 그대로 유지한다.

## 스타일

- 결과보고서 커버 표에만 전용 클래스를 적용해 다른 표에 영향을 주지 않는다.
- 기준 표 글자 크기에서 1.5px 확대하고 `font-stretch: 100%`, `letter-spacing: normal`을 명시한다.
- 각 행 높이는 기존 렌더링 높이 대비 1.2배가 되도록 고정하며, 세로 가운데 정렬한다.
- 서명 이미지는 `(서명)` 표기 주변의 제한된 박스 안에서 `object-fit: contain`으로 표시한다.

## 변경 파일

- `src/lib/operation-documents/model.ts`
- `src/components/operation-documents/document-preview.tsx`
- `src/components/operation-documents/document-editor.tsx`
- `src/app/operation-documents/[id]/[kind]/print/page.tsx`
- `src/components/operation-documents/documents.css`
- `supabase/migrations/*_anchor_result_cover_affiliation.sql`
- 관련 운영문서 회귀 검사

## 검증

- 운영문서 DB 회귀 검사에서 책임강사 소속 반환을 확인한다.
- 린트와 production build를 실행한다.
- 실제 결과보고서 미리보기를 브라우저로 열어 표 행 순서, 중복 서명 제거, 책임강사 행, 페이지 번호를 검사한다.
- Playwright/Chromium 인쇄 결과를 PDF 1.7로 정규화한 뒤 페이지 번호와 커버 레이아웃을 렌더링해 확인한다.

## 보안

- 책임강사 소속은 기존 `operation_access` 통과 사용자에게만 반환한다.
- 승인 강사 풀의 다른 개인정보는 추가 반환하지 않는다.
