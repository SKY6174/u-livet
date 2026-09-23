# Gap Analysis: anchor-learner-refund-document

> Date: 2026-09-23 | Design: `docs/02-design/features/anchor-learner-refund-document.design.md`

## Match Rate: 100%

## Summary

설계 항목 12개를 구현·검증 결과와 대조했다. 환불 문서 타입, 독립 상태, 입력·검증, 원본 템플릿, 좌표 합성, PDF 1.7, 민감정보 처리, 자동·시각·브라우저 검증이 모두 설계와 일치한다.

## Implemented Items

- [x] `refund` 문서 타입과 제목, 공통 페이지·레거시 경로 지원
- [x] 동일 창의 세 번째 문서 선택 버튼
- [x] 세 문서별 독립 입력·서명·다운로드 완료 상태
- [x] 환불 인적사항·주민등록번호·주소·자택전화 입력
- [x] 원본의 고정 반환사유와 발생시점 선택
- [x] 수강료·공제금액·반환액 입력 및 숫자 검증
- [x] 은행·계좌번호·예금주 입력 및 검증
- [x] 원본 A4 페이지 복사와 좌표 기반 텍스트·체크·서명 합성
- [x] 표 신청날짜와 하단 작성일 동시 반영
- [x] PDF 1.7 헤더·Catalog, A4 1페이지, 제목 메타데이터
- [x] 클라이언트 메모리 전용 처리와 주민등록번호 기본 마스킹
- [x] TypeScript·lint·build·PDF·데스크톱·모바일·레거시 경로 검증

## Missing Items

- 없음

## Changed Items (Deviations from Design)

- 없음. 구현 전 설계에서 원본에 고정 인쇄된 `개인사유`를 편집값이 아닌 고정 문구로 명확히 조정했다.

## Evidence

- 원본과 템플릿의 144 dpi 렌더 비교: 하단 날짜 입력 영역 밖 차이 0 pixel
- `node scripts/verify-learner-documents.mjs`: 세 문서 및 환불 전용 검증 통과
- 브라우저 QA: 세 버튼, 상태·서명 유지, PDF 다운로드, 모바일 390 px, 키보드 전환, `/mypage/documents/refund` 리다이렉트 통과
- `npx tsc --noEmit`, scoped ESLint, `npm run build` 통과

## Recommendations

1. 운영에서 환불액 자동 계산이 필요해질 경우 반환기준과 수업 진행 데이터를 별도 기능으로 설계한다.
2. 현재 범위는 완성되었으므로 completion report로 진행한다.

## Next Steps

- [x] Match rate 90% 이상: report 단계 진행
