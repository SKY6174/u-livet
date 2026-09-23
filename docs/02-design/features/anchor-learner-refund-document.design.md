# anchor-learner-refund-document - Design Document

> Version: 1.0.0 | Date: 2026-09-23 | Status: Approved
> Level: Dynamic | Plan: `docs/01-plan/features/anchor-learner-refund-document.plan.md`

## 1. Overview

### 1.1 Purpose

기존 수강생 서류 작성기의 문서 타입을 세 종류로 확장하고, 사용자 제공 환불 신청서의 원본 페이지를 변경 없이 템플릿으로 사용한다. 브라우저에서 입력한 값은 새 PDF 1.7 문서에 복사된 원본 페이지 위의 지정 좌표에 합성한다.

### 1.2 Design Goals

- 원본 A4 595 × 842 pt 페이지의 여백·표·고정 문구·하단 반환기준을 보존한다.
- 기존 문서 전환, 상태 유지, 미리보기, 서명, 다운로드 경험을 재사용한다.
- 환불 신청에 필요한 데이터만 추가하고 기존 두 문서 동작을 유지한다.
- 주민등록번호와 계좌정보를 서버로 전송하거나 영구 저장하지 않는다.

## 2. Architecture

### 2.1 System Architecture

```text
LearnerDocumentEditor
  -> document type별 React 메모리 상태
  -> template/font fetch
  -> renderLearnerDocument(type, values, assets)
  -> 원본 페이지 copy + 입력값/체크/서명 overlay
  -> PDF 1.7 byte array
  -> PDF.js preview / local download
```

백엔드 API나 데이터베이스 변경은 없다. 모든 처리는 기존과 같이 브라우저 메모리에서 수행한다.

### 2.2 Component Design

- `model.ts`: `refund` 문서 타입, 발생시점 상수, 환불 전용 필드, 필수·형식 검증을 정의한다.
- `editor.tsx`: 세 번째 버튼과 환불 전용 입력 섹션을 렌더링한다. 각 타입의 폼 상태와 다운로드 완료 기준을 독립 관리한다.
- `pdf.ts`: 환불 템플릿 좌표에 텍스트, 선택 표시, 작성일, 서명을 합성한다.
- `learner-refund.pdf`: 사용자 제공 원본 1페이지를 그대로 복사한 정적 템플릿이다.

### 2.3 Data Flow

1. 페이지 진입 시 세 문서의 초기값을 생성한다.
2. 사용자가 `수강료환불신청서` 버튼을 선택하면 환불 폼 상태를 표시한다.
3. 입력이 바뀌면 300 ms 후 템플릿·글꼴과 함께 PDF를 다시 렌더링한다.
4. PDF.js가 최신 바이트를 미리보기한다.
5. 검증 성공 시 `수강료환불신청서_YYYY-MM-DD.pdf`를 로컬로 다운로드한다.

## 3. Data Model

### 3.1 Document Type

`LearnerDocumentType = "application" | "scholarship" | "refund"`

### 3.2 Refund Fields

기존 공통 필드 `courseName`, `name`, `phone`, `address`, `residentFront`, `residentBack`, `bank`, `account`, `accountHolder`, `signedOn`, `signature`를 재사용한다.

| 필드 | 타입 | 필수 | 용도 |
|------|------|------|------|
| `homePhone` | string | 아니오 | 자택전화 |
| `refundOccurrence` | enum | 예 | 수업 전/1·6 전/1·3 전/1·2 전/1·2 후 |
| `tuitionFee` | string | 예 | 수강료 원금 |
| `deductionAmount` | string | 예 | 공제금액, 0 허용 |
| `refundAmount` | string | 예 | 실제 반환액 |

`signedOn`은 표의 신청날짜와 하단 신청일에 함께 사용한다. 원본에 인쇄된 반환사유 `개인사유`는 고정 문구로 유지한다. 환불금액은 자동 계산하지 않으며 숫자 입력을 그대로 원 단위로 표시한다.

### 3.3 Validation

- 공통: 과정명, 성명, 휴대전화, 작성일, 서명
- 환불: 주소, 주민등록번호 13자리, 은행명, 계좌번호, 예금주, 발생시점, 세 금액
- 전화번호: 휴대전화는 기존 국내 휴대전화 형식, 자택전화는 비어 있거나 숫자·공백·하이픈 8~14자
- 금액: 숫자 및 천 단위 쉼표를 허용하고 숫자 기준 1~12자리
- 반환시점 `after-half`도 원본 문구대로 선택 가능하되 자동 금액 계산은 하지 않는다.

## 4. PDF Layout Mapping

모든 좌표는 원본 PDF의 좌상단 기준 pt이다. 템플릿은 원본을 재조판하지 않는다.

| 입력 | x | top | width | height |
|------|---:|----:|------:|-------:|
| 과정명 | 129 | 145.3 | 416 | 25.2 |
| 성명 | 129 | 170.5 | 167 | 25.3 |
| 주민번호 앞/뒤 | 376 / 465 | 170.5 | 72 / 72 | 25.3 |
| 휴대전화 | 129 | 195.8 | 167 | 25.3 |
| 자택전화 | 376 | 195.8 | 169 | 25.3 |
| 주소 | 129 | 221.2 | 416 | 25.3 |
| 반환사유 | 129 | 271.7 | 167 | 25.3 |
| 신청날짜 | 376 | 271.7 | 169 | 25.3 |
| 은행명 | 129 | 297.0 | 116 | 25.3 |
| 계좌번호 | 296 | 297.0 | 123 | 25.3 |
| 예금주 | 458 | 297.0 | 87 | 25.3 |
| 발생시점 체크 | 147 / 184 / 253 / 322 / 390 | 329 | - | - |
| 수강료 | 233 | 347.6 | 104 | 25.2 |
| 공제금액 | 441 | 347.6 | 104 | 25.2 |
| 반환액 | 180 | 372.8 | 148 | 25.3 |
| 하단 신청자 | 250 | 483 | 82 | 24 |
| 하단 서명 | 381 | 480 | 59 | 25 |

## 5. API Specification

새 API는 없다. 기존 인증된 `/mypage/documents` 페이지와 클라이언트 PDF 생성 경로를 사용한다. 기존 `/mypage/documents/[type]` 호환 경로는 `refund`도 공통 페이지로 리다이렉트한다.

## 6. Implementation Plan

### 6.1 File Structure

- `public/forms/learner-refund.pdf`
- `public/forms/learner-templates.md`
- `src/lib/learner-documents/model.ts`
- `src/lib/learner-documents/pdf.ts`
- `src/components/learner-documents/editor.tsx`
- `scripts/verify-learner-documents.mjs`

### 6.2 Implementation Order

1. 원본 템플릿을 정적 자산으로 등록하고 원본과 페이지 렌더가 같은지 확인한다.
2. 모델과 검증 규칙을 확장한다.
3. PDF 좌표 매핑을 구현한다.
4. 편집기 버튼·환불 입력 섹션·상태 관리를 구현한다.
5. 자동·시각·브라우저 검증을 수행하고 발견된 차이를 수정한다.

## 7. Test Plan

### 7.1 Automated Checks

- 세 문서의 blank/filled 렌더링과 PDF 1.7 헤더·Catalog·A4 1페이지 확인
- 환불 필수값, 주민등록번호, 전화번호, 계좌번호, 금액, 날짜 검증
- 지원하지 않는 글리프·긴 문자열·잘못된 서명 데이터 거부
- TypeScript, scoped lint, production build

### 7.2 Visual and Browser Checks

- 원본과 템플릿을 동일 해상도로 렌더링하여 입력 영역 이외의 픽셀 차이가 없는지 확인
- 합성된 환불 PDF를 PNG로 렌더링하여 모든 값과 서명이 칸 안에 들어가는지 확인
- 데스크톱에서 세 버튼, 문서 전환 상태 유지, 미리보기, 다운로드 확인
- 390 px 모바일에서 가로 스크롤·잘림이 없는지 확인
- 기존 경로 `/mypage/documents/refund`가 공통 화면에서 환불 문서를 선택하는지 확인

## 8. Security Considerations

- 주민등록번호와 계좌번호는 브라우저 메모리 및 생성된 로컬 PDF에만 존재한다.
- 주민등록번호 뒷자리는 입력란에서 기본 마스킹한다.
- 템플릿·글꼴은 고정된 same-origin 정적 자산만 불러온다.
- 입력 길이와 허용 문자를 검증하고 PDF 글꼴 미지원 문자를 명시적으로 거부한다.
- 서명은 PNG 데이터 URL, 최대 3 MB·4096 px로 제한한다.
