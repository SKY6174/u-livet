# anchor-operation-photo-crop - Design Document

> Version: 1.0.0 | Date: 2026-09-23 | Status: Approved
> Level: Dynamic | Plan: `docs/01-plan/features/anchor-operation-photo-crop.plan.md`

## 1. Overview

### 1.1 Purpose

운영사진의 원본 비율과 관계없이 결과보고서의 화면 미리보기와 PDF 출력에서 동일한 16:9 크기로 표시한다. 새 사진은 저장 전에 중앙을 기준으로 16:9로 잘라 용량도 제한한다.

### 1.2 Design Goals

- 직접 첨부 사진과 원본 PDF 추출 사진에 같은 중앙 자르기 계산을 사용한다.
- 기존 저장 사진도 다시 업로드하지 않고 출력 단계에서 16:9로 표시한다.
- 사진 배열의 2열·페이지당 최대 8장 규칙을 유지한다.
- 사진을 찌그러뜨리지 않고 `object-fit: cover`로 불필요한 가장자리만 숨긴다.

## 2. Architecture

### 2.1 Components

- `photo-crop.ts`: 브라우저와 테스트에서 공유하는 순수 중앙 자르기 계산 및 캔버스 렌더링 도우미
- `document-editor.tsx`: JPG·PNG 직접 첨부 시 960×540 이하 JPEG로 변환
- `pdf-import.ts`: PDF 내부 사진 추출 시 672×378 이하 JPEG로 변환
- `documents.css`: 기존 사진을 포함한 미리보기·인쇄 영역을 16:9로 고정
- `result-pdf-import.tsx`: 추출 사진 선택 화면도 16:9 썸네일로 표시

### 2.2 Crop Algorithm

1. 원본의 가로세로 비율을 16:9와 비교한다.
2. 원본이 더 넓으면 좌우를 같은 양만큼 자른다.
3. 원본이 더 높으면 위아래를 같은 양만큼 자른다.
4. 대상 폭은 16의 배수로 제한하고 높이는 정확히 `폭 × 9 / 16`으로 계산한다.
5. 캔버스에 흰 배경을 채운 뒤 잘라낸 영역을 JPEG로 인코딩한다.

## 3. Data Model and API

데이터베이스 스키마와 API 계약은 변경하지 않는다. `content.photos[].image`에는 기존과 같이 data URL을 저장한다. 새로 첨부하거나 PDF에서 추출한 사진의 data URL만 물리적으로 16:9가 된다.

## 4. Existing Data Compatibility

기존 세로형·4:3 사진은 원본 data URL을 그대로 보존한다. 보고서 렌더링 컨테이너를 16:9로 만들고 중앙 기준 `object-fit: cover`를 적용해 출력만 통일한다.

## 5. Implementation Order

1. 공용 중앙 자르기 도우미와 순수 계산 테스트를 추가한다.
2. 직접 첨부와 PDF 사진 추출을 공용 도우미로 전환한다.
3. 미리보기·인쇄 CSS와 가져오기 썸네일을 16:9로 맞춘다.
4. 린트, 빌드, 운영문서 검증 스크립트를 실행한다.

## 6. Test Plan

- 16:9 원본은 전체 영역을 유지한다.
- 4:3 원본은 위아래를 같은 크기로 자른다.
- 세로 원본은 위아래를 같은 크기로 자른다.
- 초광각 원본은 좌우를 같은 크기로 자른다.
- 미리보기·인쇄 CSS가 고정 16:9와 중앙 `cover`를 사용한다.
- 기존 운영문서 회귀 검증, ESLint, Next.js production build가 통과한다.

## 7. Security and Privacy

사진은 브라우저에서만 처리하며 외부 서비스로 전송하지 않는다. 파일 형식과 12MB 상한 검증을 유지하고 임시 object URL은 처리 직후 해제한다.
