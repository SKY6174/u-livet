# 결과보고서 커버 레이아웃 완료 보고

2026-09-23 · anchor-result-cover-layout

## 반영 내용

- 커버 페이지의 쪽 번호를 제거하고 두 번째 출력면을 1쪽으로 변경했다.
- 결과보고서 기본정보 표를 영역, 세부프로그램명, 교육기간, 책임강사 순서로 재구성했다.
- 표 행 높이를 약 20% 키우고 글자 크기를 1.5px 확대했으며 장평 100%를 명시했다.
- 책임강사 행에 승인 강사 소속, 성명, `(서명)`과 서명 이미지를 함께 배치했다.
- 직접 입력 서명이 없고 원본 PDF 추출 서명이 있으면 해당 이미지를 같은 표 셀에 표시한다.
- 표 아래의 책임강사·원본 참고 서명 영역을 삭제했다.
- Preview와 운영 DB의 운영문서 컨텍스트에 책임강사 소속을 추가했다.

## 검증

- `node scripts/verify-operation-documents.mjs`
- `npm run lint`
- `npm run build`
- 인증된 로컬 관리자 세션으로 결과보고서 인쇄 화면 확인
- A4 6쪽 PDF 1.7 다운로드 및 첫 두 쪽 렌더링 확인
- Preview·운영 DB 책임강사 3건의 출력용 소속값 확인
- Preview·운영 Supabase Security Advisor 경고 없음

## 배포 데이터

- Migration: `20260923040917_anchor_result_cover_affiliation`
- Preview: `bfqwntulxabfrimcypvx`
- Production: `uoebygejgglgiivzgyks`
