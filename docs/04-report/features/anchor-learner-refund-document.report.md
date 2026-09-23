# anchor-learner-refund-document - Completion Report

> Date: 2026-09-23 | Level: Dynamic | Status: Complete

## Summary

수강생 작성 서류 화면에 수강료환불신청서를 세 번째 서식으로 추가했다. 수강생은 같은 창에서 세 양식을 전환하면서 환불 신청 정보를 작성하고, 사용자 제공 원본의 표·문구·여백을 유지한 A4 PDF 1.7 파일을 미리보기 및 다운로드할 수 있다.

## Related Documents

- Plan: `docs/01-plan/features/anchor-learner-refund-document.plan.md`
- Design: `docs/02-design/features/anchor-learner-refund-document.design.md`
- Analysis: `docs/03-analysis/anchor-learner-refund-document.analysis.md`

## Completed Items

- 수강료환불신청서 선택 버튼과 `/mypage/documents/refund` 호환 경로
- 세 문서의 독립적인 입력·서명·저장 완료 상태
- 과정, 인적사항, 주민등록번호, 전화, 주소 입력
- 원본 고정 반환사유, 발생시점, 세 금액 입력
- 환불 계좌 입력 및 형식 검증
- 표 신청날짜, 하단 작성일·신청자·서명 반영
- 원본 페이지 기반 미리보기와 PDF 1.7 다운로드
- 원본 템플릿 재생성 스크립트 및 출처 문서

## Quality Metrics

| Metric | Result |
|--------|--------|
| Design match | 100% (12/12) |
| Original/template pixel comparison | 날짜 입력 영역 밖 0 pixel 차이 |
| PDF compatibility | Header 1.7, Catalog 1.7 |
| PDF layout | A4 595 × 842 pt, 1 page |
| TypeScript | Pass |
| Scoped ESLint | Pass |
| Production build | Pass |
| PDF regression script | Pass, 3 document types |
| Browser QA | Pass, desktop and 390 px mobile |

## Security and Privacy

주민등록번호, 계좌번호, 서명은 기존 양식과 동일하게 서버에 저장하지 않는다. 브라우저 메모리에서만 처리하며 주민등록번호 뒷자리는 입력란에서 기본 마스킹한다.

## Notes

- 원본 하단의 미리 입력된 `2026년`은 실제 선택 날짜를 넣기 위해 해당 날짜 영역에서만 제거했다.
- 환불액은 반환기준과 개별 사정에 따라 달라질 수 있어 자동 계산하지 않는다.
- PDF 다운로드는 접수 완료가 아니며 화면 안내에 따라 별도 제출해야 한다.
