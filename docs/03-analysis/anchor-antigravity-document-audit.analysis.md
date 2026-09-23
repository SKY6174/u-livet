# Gap Analysis: anchor-antigravity-document-audit

> Date: 2026-09-23 | Design: `docs/02-design/features/anchor-antigravity-document-audit.design.md`

---

## Match Rate: 100%

## Summary

설계한 10개 구현·검증 항목을 모두 반영했다. 원문 추출 데이터는 16개 과정의 DB 이관 후보로만 사용하고, 인증·책임강사·문서 상태·편집 링크는 Supabase RPC 결과만 기준으로 삼는다. 원문에 근거하지 않은 실적·장학금·자격정보 생성과 비UUID 편집 우회를 제거했다.

## Implemented Items

- [x] `data.ts`에서 UUID·인증·RPC 오류를 fail-closed로 처리한다.
- [x] `model.ts`가 사전입력 모듈에 의존하지 않고 DB·저장본만 사용한다.
- [x] 관리자는 원문 이관 대상 16개 과정을 확인할 수 있다.
- [x] DB에 없는 과정은 `DB 이관 대기`로 표시하고 편집 링크를 제공하지 않는다.
- [x] 책임강사는 `life_operation_list`에서 허용된 실제 DB 과정만 확인한다.
- [x] 원본 결과보고서 보유 여부와 DB 제출 상태를 분리한다.
- [x] 사전 일정 행에 현행 스키마의 시작·종료시간 키를 추가한다.
- [x] 임의 모집·수료·만족도·장학금·자격등록번호 생성 로직을 제거한다.
- [x] 인증 없는 정적 사진 경로 주입을 제거한다.
- [x] 16개 사전입력 자료 검증, 운영문서 DB 회귀, lint, production build를 통과한다.

## Missing Items

- 없음.

## Changed Items (Deviations from Design)

- 책임강사에게 원문 16개와 이름이 일치하지 않는 실제 DB 과정이 허용된 경우에도 작업 목록에서 누락되지 않도록 실제 DB 행을 추가 표시한다. 이는 Supabase를 권한의 기준으로 삼는 설계 목표를 강화한다.
- 원문 반려동물 수제간식 계획서의 일정 연도가 표지·과정 연도와 달리 2025년으로 추출되어 2026년으로 정규화했다.

## Verification

- `npm run test:operation-prefill`: 16개 과정·7개 결과보고서 원문, 키·날짜·추정값 검증 통과.
- `node scripts/verify-operation-documents.mjs`: 권한, revision, 예산 우선, 책임강사 서명·제출, 불변 제출본 검증 통과.
- `npm run lint`: 통과.
- `npm run build`: 통과.
- 로컬 Supabase 인증 쿠키로 관리자/책임강사 목록 HTTP 200, DB 오류 패널 없음 확인.

## Remaining Source Warning

- `도배 전문시공인력 양성과정`은 표지 종료일이 2026-10-29이나 원문 일정표에는 2026-11-03~11-26 일정이 있다. 시스템이 임의 보정하지 않고 원문 확인 경고로 유지한다.

## Recommendations

1. 13개 미등록 과정은 과정·책임강사를 Supabase에 등록한 후 문서 작성을 시작한다.
2. 원본 사진은 개인정보 검토 후 private Storage와 권한 API를 통해 별도 이관한다.
3. 도배 과정 교육기간은 담당자가 원문을 확인해 표지 또는 일정표를 정정한다.

## Next Steps

- [x] Match rate 90% 이상이므로 보고 단계로 진행한다.
