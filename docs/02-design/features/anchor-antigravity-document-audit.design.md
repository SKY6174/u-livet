# anchor-antigravity-document-audit - Design Document

> Version: 1.0.0 | Date: 2026-09-23 | Status: Approved
> Level: Dynamic | Plan: `docs/01-plan/features/anchor-antigravity-document-audit.plan.md`

## 1. Overview

### 1.1 Purpose

원문에서 추출한 사전입력 자료는 DB 이관 후보 데이터로만 취급하고, 인증·권한·저장·제출의 기준은 Supabase의 실제 과정과 운영 문서로 유지한다.

### 1.2 Design Goals

- DB 오류와 권한 거부는 명시적으로 실패하며 다른 과정으로 대체하지 않는다.
- 문서 목록은 실제 DB 상태와 이관 후보 상태를 구분한다.
- 모델 계층은 사전입력 모듈에 의존하지 않는 순수 변환·검증 계층으로 유지한다.
- 추정값을 만들지 않고 원문에서 확인된 데이터만 초안 보조값으로 사용한다.

## 2. Architecture

### 2.1 System Architecture

1. `DocumentList`는 인증 후 `life_operation_list` RPC로 접근 가능한 DB 과정을 읽는다.
2. `PREFILLED_COURSES`는 16개 원문 이관 현황과 과정 메타데이터를 제공한다.
3. DB와 이름이 일치한 과정은 실제 UUID·책임강사·문서 상태로 편집 링크를 제공한다.
4. DB에 없는 과정은 `이관 대기` 상태의 읽기 전용 목록 항목으로 표시하며 편집 링크를 만들지 않는다.
5. 편집/인쇄 페이지는 UUID만 허용하고 `life_operation_context` 권한 검사를 반드시 통과한다.

### 2.2 Component Design

- `data.ts`: UUID·인증·RPC 오류를 fail-closed로 처리하고 실제 DB 과정만 반환한다.
- `model.ts`: DB 과정 기본정보와 저장된 plan/result만으로 초기 문서를 구성한다. 사전입력 의존성을 제거한다.
- `document-list.tsx`: DB 행과 이관 후보를 병합하되 `registered`와 문서 상태를 분리한다.
- `document-list-view.tsx`: 미등록 과정은 `DB 이관 대기` 배지와 비활성 안내를 표시한다.
- `prefilled-data.ts`: 실제 원문에서 추출한 메타·일정·예산 후보만 보관한다. 제출 상태나 실적을 추정하지 않는다.
- `verify-prefilled-operation-documents.mjs`: 과정 수, 고유 ID, 일정 행 스키마, 날짜/시간, 합계, 금지 추정값을 검증한다.

### 2.3 Data Flow

`인증 사용자 → operation list RPC → 실제 과정 목록 → 사전입력 메타 병합 → 등록 과정만 편집 → operation context RPC → save/transition RPC`

사전입력 자료는 목록 설명을 보조하지만 저장·제출 상태와 권한 판정에는 사용하지 않는다.

## 3. Data Model

### 3.1 Entities

- `DocumentCourseItem.registered: boolean`: 실제 DB offering 존재 여부.
- `DocumentCourseItem.has_source_report: boolean`: 원본 결과보고서 존재 여부. 제출 상태와 별개다.
- `PrefilledCourse.scheduleRows`: 현행 `SCHEDULE` 열 키 전체를 갖는 초안 후보 행.
- `PrefilledCourse.budgetRows`: 원문에 기재된 예산 후보. 장학금 집계는 별도 상세자료가 없으면 비워 둔다.

### 3.2 Relationships

- 과정명 정규화가 일치할 때만 `PrefilledCourse`와 DB offering을 연결한다.
- 동일 이름 DB 과정이 없으면 UUID를 합성하지 않으며 편집 경로를 제공하지 않는다.
- `hasResultReport`는 원본 보유 표시용이고 `result_status`는 DB 문서에서만 온다.

## 4. API Specification

### 4.1 Existing RPCs

- `life_operation_list()` — 현재 사용자에게 허용된 실제 과정과 문서 상태 목록.
- `life_operation_context(f uuid)` — 과정 접근권한을 검사한 편집 컨텍스트.
- `life_operation_save`, `life_operation_transition` — 기존 revision/역할/서명 검증 유지.

### 4.2 Failure Behavior

- 비UUID ID: `notFound()`.
- `FORBIDDEN`: `notFound()`.
- 네트워크·RPC 오류: 사용자에게 재시도 오류를 표시하고 사전 과정으로 대체하지 않는다.
- 목록 RPC 오류: 빈 정상 목록으로 위장하지 않고 오류 패널을 표시한다.

## 5. Implementation Plan

### 5.1 Files

- `src/lib/operation-documents/data.ts`
- `src/lib/operation-documents/model.ts`
- `src/lib/operation-documents/prefilled-data.ts`
- `src/components/operation-documents/document-list.tsx`
- `src/components/operation-documents/document-list-view.tsx`
- `scripts/verify-prefilled-operation-documents.mjs`
- `scripts/verify-operation-documents.mjs`
- `package.json`

### 5.2 Order

1. 접근 계층과 모델 의존성을 원복·정리한다.
2. 목록 병합 모델에 등록 여부를 추가하고 추정 상태를 제거한다.
3. 사전입력 일정 행을 현행 스키마로 정규화한다.
4. 사전값에서 임의 생성 정보를 제거한다.
5. 자동 검증을 추가하고 전체 검사를 수행한다.

## 6. Test Plan

### 6.1 Unit/Data Tests

- 사전 과정 16건과 고유 ID·과정명 검증.
- 일정 행의 정확한 키 집합, 날짜·시간 형식, 종료시간 순서 검증.
- 원문 없는 제출 상태·실적·장학금·자격등록번호 추정 금지 검증.
- `initialDocument` 모델 회귀 검사 통과.

### 6.2 Integration Tests

- 로컬 Supabase 운영 문서 권한·revision·서명 회귀 검사.
- ESLint와 Next.js production build.
- 운영 DB 읽기 점검으로 기존 3개 결과보고서 유효성 확인.

## 7. Security Considerations

- 인증 전에 사전 과정 컨텍스트를 반환하지 않는다.
- DB 장애를 관리자 컨텍스트로 변환하지 않는다.
- 원본 사진을 인증 없는 정적 경로로 주입하지 않는다.
- 계좌·서명·개인정보가 포함될 수 있는 원본은 브라우저 공개 경로로 이동하지 않는다.
