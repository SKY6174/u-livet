# anchor-antigravity-document-audit - Plan Document

> Version: 1.0.0 | Date: 2026-09-23 | Status: Approved
> Level: Dynamic

## 1. Overview

### 1.1 Purpose

Antigravity가 추가한 2026년 16개 과정 운영계획서와 7개 결과보고서 사전입력 구현을 원문·Supabase 저장 구조·권한 정책과 대조하여 실제 작성 및 제출 흐름에 사용할 수 있는 상태로 교정한다.

### 1.2 Background

현재 구현은 원문 PDF·추출 Markdown과 사진을 저장소에 추가하고 코드 기반 사전값으로 목록과 편집기를 구성했다. 운영 DB에는 기존 3개 결과보고서만 존재하며, 사전값 과정은 UUID가 아닌 임시 ID를 사용한다. 회귀 검사에서는 모델 모듈 의존성 오류가 발생했고, DB 실패 시 첫 사전 과정으로 대체하는 fail-open 동작과 원문 근거가 없는 실적·장학금 추정값이 확인됐다.

## 2. Goals

### 2.1 Primary Goals

- [x] Antigravity 커밋의 코드·원문·운영 DB 상태를 분리해 점검한다.
- [ ] 인증·권한·DB 오류를 숨기지 않고 기존 보안 경계를 유지한다.
- [ ] DB에 등록되지 않은 사전 과정은 작성 가능한 문서처럼 표시하지 않는다.
- [ ] 원문 근거가 없는 모집·수료·만족도·장학금·자격정보를 생성하지 않는다.
- [ ] 사전 일정은 현재 문서 스키마로 정규화하여 저장 검증과 일치시킨다.
- [ ] 운영 문서 회귀 검사, lint, production build를 통과한다.

### 2.2 Non-Goals

- 13개 미등록 과정을 운영 DB에 자동 생성하거나 승인 상태로 전환하지 않는다.
- 원본 PDF의 개인정보·서명·계좌정보를 공개 정적 자산으로 배포하지 않는다.
- OCR이 불명확한 값을 임의 보정하지 않는다.

## 3. Scope

### 3.1 In Scope

- 운영 문서 데이터 접근 계층의 fail-closed 복원
- 모델과 사전입력 데이터의 순환 의존 제거
- 16개 목록의 DB 등록 여부 및 이관 상태 표시
- 저장 가능한 사전 일정 행 정규화
- 결과보고서 보유 여부를 제출 상태로 오인하지 않도록 상태 교정
- 사전입력 데이터 자동 검증 스크립트와 기존 회귀 검사 보강

### 3.2 Out of Scope

- 미등록 과정의 course/version/offering/responsibility 일괄 생성
- 70장 사진의 Supabase private Storage 이관
- 원문 PDF 역사 커밋 제거를 위한 강제 푸시

## 4. Success Criteria

- [ ] 비UUID 과정 URL과 DB 오류가 관리자 편집기로 우회되지 않는다.
- [ ] 16개 목록에서 DB 등록 3건과 이관 대기 13건이 사실대로 구분된다.
- [ ] 원문 보유가 곧 `SUBMITTED` 상태로 표시되지 않는다.
- [ ] 사전값에 임의 실적·장학금·등록번호가 없다.
- [ ] 모든 사전 일정 행이 현행 스키마 키를 갖고 유효한 날짜·시간 형식을 사용한다.
- [ ] `node scripts/verify-operation-documents.mjs`, `npm run lint`, `npm run build` 통과.

## 5. Schedule

| Phase | Target Date | Status |
|-------|------------|--------|
| Plan | 2026-09-23 | Complete |
| Design | 2026-09-23 | In Progress |
| Implementation | 2026-09-23 | Pending |
| Review | 2026-09-23 | Pending |

## 6. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| 임시 사전값을 실제 제출본으로 오인 | High | High | DB 문서 상태만 작성·제출 상태로 사용하고 미등록 과정은 이관 대기로 표시 |
| DB 장애 시 다른 과정 노출 | High | Medium | fallback 제거, 인증 후 RPC 오류를 명시적으로 표시 |
| 원문 없는 수치의 행정 사용 | High | High | 추정 생성 제거, 원문 근거가 있는 값만 사전입력 |
| 사진을 정적 공개 경로로 노출 | High | Medium | 정적 경로 주입 제거, private Storage 이관 전에는 편집 데이터에 넣지 않음 |

## 7. References

- `docs/2026년 RISE사업 평생직업교육과정 운영계획서/`
- `docs/1. 2026년 앵커사업 평생직업교육과정 운영결과보고서_0923/`
- `docs/04-report/features/anchor-operation-documents.report.md`
- Supabase `life_operation_*` RPC 및 RLS 정책
