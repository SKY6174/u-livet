# 과정별 출석 수료기준·수료율·중도 환불 표시 설계

> Feature: anchor-completion-attendance-refunds | 2026-09-25 | Dynamic
> Plan: [계획](../../01-plan/features/anchor-completion-attendance-refunds.plan.md)

## 데이터 흐름

1. 운영계획서 `content.fields.completionAttendancePercent`에 책임교수가 80~100의 출석률을 기입한다. 초기값 80, 기존 문서에 없는 값은 저장 가능하도록 정규화한다. PDF 미리보기에도 표시한다.
2. 사업단 담당자가 기존 REVIEW → SUBMITTED 절차로 승인한다. 최신 `life_operation_submissions`의 plan 스냅샷만 판정 기준으로 읽는다. 새 plan 제출 시 `life_offerings.academic_revision`을 증가시켜 기존 판정을 무효화한다.
3. 수료 판정 엔진은 `greatest(80, 승인 정책 출석률, 최신 제출 계획서 출석률)`을 적용한다. 기존 과제·시험 및 마감·별도 확정 절차는 유지한다. 기존 제출 계획서에 필드가 없으면 80%를 적용한다.
4. `life_completion_board`는 학습자별 종료 회차 기반 출석률, 전체 회차 출결 완결 여부, 최신 판정, 실제 금융 환불과 환불 문서 신청 상태를 반환한다. 개인정보·금액은 기존 권한 검사 뒤에도 반환하지 않는다.
5. 수료 상세 화면은 출석기준 충족 수/등록 수의 자동 수료율, 확정 수/등록 수의 확정 수료율 및 중도 환불 인원 수를 자동 계산한다. 출결 미완결자는 충족 인원에 세지 않는다. 개별 행에는 진행 중 출석률과 환불 상태를 별도 표기한다.

## 변경 파일

- `src/lib/operation-documents/schema.ts`: 계획서 필드.
- `src/lib/operation-documents/model.ts`: 기본값 및 입력 유효성.
- `src/components/operation-documents/document-editor.tsx`: 숫자 입력 80~100 제한 및 안내.
- `src/components/operation-documents/document-preview.tsx`: PDF 미리보기의 수료기준.
- `src/lib/portal/evaluation.ts`: 수료 보드 반환 타입.
- `src/app/completion/[id]/page.tsx`: 기준·수료율·환불 표시.
- 새 Supabase migration: 문서 스키마 확장, 수료 판정·보드 RPC 교체, 계획 재제출 시 판정 무효화.

## 호환성 및 보안

- 기존 계획서 본문만 새 필드 80을 채운다. 이미 제출된 스냅샷은 수정하지 않고 판정 시 기본값을 쓴다.
- 계획서와 정책 기준 충돌 시 더 높은 값을 적용한다. 정책 승인과 수료 확정의 기존 이중 승인 규칙을 유지한다.
- 중도 환불은 과정 시작일 이후 금융 환불 요청 또는 `before-start` 이외의 환불 신청 문서로 판단한다. 승인·지급 상태를 구분하고 거절/취소는 별도 표시하지 않는다.
- 분모는 전체 등록자(철회 포함)이며, 출석기준 충족자는 활성 등록자만 센다. 과정 전체 회차가 종료·기록될 때까지 자동 수료율은 잠정치로 표시한다.

## 검증

- 79/80/90% 경계, 출석부 누락, 계획서 재제출, 철회 및 환불 상태별 DB 테스트.
- 계획서 새 문서·기존 문서 정규화, 서버 유효성, PDF 미리보기 확인.
- TypeScript, lint, build 및 적용 가능한 Supabase migration 테스트.
