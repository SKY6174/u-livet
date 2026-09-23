# anchor-result-attachments-scholarships - Design Document

> Version: 1.0.0 | Date: 2026-09-23 | Status: Approved for implementation
> Level: Dynamic | Plan: `docs/01-plan/features/anchor-result-attachments-scholarships.plan.md`

## 1. Overview

### 1.1 Purpose

완료 과정의 공식 결과보고서에 수강생별 장학금 지급 세부내역을 저장·출력하고, 출석부·수료자명단·장학금 지급현황·강사 강의날인부·강사료 지급현황을 첨부 1~5로 명시한다. 원문 결과보고서 PDF의 사진 표제와 날짜를 추출해 개강식·수료식·운영사진에 반영한다.

### 1.2 Design Goals

- 담당자가 수강생 목록에서 대상자를 선택해 장학 유형, 지급률, 금액, 계좌 정보, 지급일, 비고를 입력한다.
- 세부내역이 있으면 인원수와 합계는 자동 집계하고, 기존 집계값만 저장된 문서는 그대로 열 수 있다.
- 결과보고서 본문 뒤에 현재 입력 데이터로 생성한 다섯 양식을 첨부 1~5 순서로 출력한다.
- PDF 사진 표제의 날짜를 `YYYY-MM-DD`로 정규화하고 기존 빈 개강식·수료식 칸과 운영사진에 병합한다.

## 2. Architecture

### 2.1 System Architecture

Next.js 편집 화면은 `operation_context` RPC에서 과정 수강생과 공식 문서를 함께 읽는다. 공식 결과보고서의 `budget` JSONB에 장학금 세부행을 저장하며, 제출본은 기존 불변 스냅샷 정책을 따른다. 통합 인쇄 화면은 공식 결과보고서 스냅샷을 본문으로, 보고서 번들의 다섯 양식을 첨부로 렌더링한다.

### 2.2 Component Design

- `model.ts`: 장학금 세부행 타입, 구버전 예산 정규화, 집계 헬퍼, 사진 병합 헬퍼를 제공한다.
- `document-editor.tsx`: 수강생 선택 기반 장학금 세부 편집기와 자동 합계를 제공한다.
- `document-preview.tsx`: 본문 8절에 수강생별 지급 세부내역을 출력한다.
- `report-documents.tsx`: 공식 장학금 세부내역을 첨부 3 출력에 우선 사용한다.
- `document-status.tsx`: 여섯 문서를 본문 1개와 첨부 5개로 표시한다.
- `pdf-import.ts`: 페이지 텍스트에서 사진 표제·날짜를 추출하고 이미지와 순서대로 연결한다.

### 2.3 Data Flow

1. 담당자가 공식 결과보고서에서 장학금 대상 수강생과 지급 정보를 입력한다.
2. 클라이언트가 세부행을 검증하고 인원수·합계를 동기화해 RPC로 저장한다.
3. 서버 검증 함수가 예산 JSON 구조, 대상자 UUID, 금액과 지급일 형식을 검증한다.
4. 저장본 출력 시 본문 8절과 첨부 3이 동일한 세부행을 사용한다.
5. 원문 PDF 초안 생성 시 페이지 텍스트의 사진 표제·날짜와 페이지 이미지를 연결해 기존 사진 슬롯에 병합한다.

## 3. Data Model

### 3.1 Budget JSON

```ts
type ScholarshipDetail = {
  personId: string;
  name: string;
  category: string;
  rate: string;
  amount: string;
  bank: string;
  account: string;
  holder: string;
  paidOn: string;
  note: string;
};
```

`Budget`는 기존 `rows`, `scholarshipCount`, `scholarshipAmount`, `scholarshipNote`에 `scholarships` 배열을 추가한다. 기존 문서는 읽을 때 빈 배열로 정규화한다. 세부행이 한 건 이상이면 인원수는 행 수, 합계는 금액 합계가 기준이다.

### 3.2 Course Members

`operation_context`는 `life_enrollments`와 `life_people`에서 과정 수강생의 `person_id`, `name`을 반환한다. 편집기는 이 목록만 대상자 선택에 사용하고 문서에는 출력 안정성을 위해 성명 스냅샷도 저장한다.

## 4. API and Database

- 기존 `life_private.operation_context(offering_id)` 응답에 `members`를 추가한다.
- 기존 `life_private.operation_budget_valid(jsonb)`를 확장해 `scholarships` 배열과 각 행의 키·길이·형식을 검증한다.
- 가변 공식 문서의 구버전 예산에 `scholarships: []`를 데이터 마이그레이션한다. 이미 제출된 불변 스냅샷은 애플리케이션에서 정규화한다.
- 별도 공개 API는 추가하지 않는다. 저장·제출 권한과 RLS는 기존 공식 문서 RPC 정책을 유지한다.

## 5. Implementation Plan

1. 타입, 정규화, 집계 및 사진 메타데이터 파서를 구현한다.
2. DB 검증과 과정 수강생 컨텍스트를 마이그레이션한다.
3. 공식 편집기와 미리보기에 장학금 세부내역을 연결한다.
4. 통합 인쇄와 현황 화면을 본문·첨부 구조로 표시한다.
5. PDF 가져오기에서 사진 표제·날짜를 보존하고 기존 사진 슬롯에 병합한다.
6. 로컬·Preview·운영 DB 및 브라우저 인쇄 흐름을 검증한다.

## 6. Test Plan

- 구버전 예산은 빈 세부행으로 정상 정규화된다.
- 유효한 수강생별 세부행은 저장되고 합계가 자동 계산된다.
- 잘못된 UUID, 음수/비숫자 금액, 잘못된 날짜, 예상 밖 키는 DB에서 거절된다.
- `개강식(2026.07.14.)`, `운영사진1(2026.07.14.)` 같은 표제가 ISO 날짜로 변환된다.
- 통합 인쇄는 결과보고서 본문 다음에 첨부 1~5를 고정 순서로 표시한다.
- 첨부 3은 공식 결과보고서의 장학금 세부내역을 사용하고 일반 화면에서는 계좌번호를 마스킹한다.

## 7. Security Considerations

- 장학금 계좌 정보는 기존 관리자·담당자 권한 경계 안에서만 편집한다.
- 인쇄 화면은 기본적으로 계좌번호를 마스킹하고, 기존 권한 검증을 통과한 명시적 공개 옵션에서만 전체 값을 표시한다.
- PDF 텍스트는 날짜와 허용된 표제만 파싱하며 명령이나 자유 텍스트로 실행하지 않는다.
- JSONB 입력은 키 수, 배열 길이, 문자열 길이와 형식을 서버에서 재검증한다.
