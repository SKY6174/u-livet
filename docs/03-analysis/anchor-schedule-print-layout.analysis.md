# Gap Analysis: anchor-schedule-print-layout

2026-09-23 · Design: `docs/02-design/features/anchor-schedule-print-layout.design.md`

## Match Rate: 100%

## 구현 확인

- 일자와 시간을 한 셀에 병합하고 `YYYY. MM. DD.`와 `(HH:mm ~ HH:mm)` 두 줄로 출력했다.
- 날짜·시간에 줄바꿈 방지 규칙을 적용하고 결과보고서와 운영계획서의 열 비율을 각각 조정했다.
- 강의주제 열에 `word-break: keep-all`과 `overflow-wrap: break-word`를 적용했다.
- 주·보조강사 이름 열을 네 글자 기준의 좁은 열로 배정하고 `교육/시간` 머리글을 두 줄로 고정했다.
- 교육장소 마지막 괄호를 분리하여 장소명과 호실을 두 줄로 출력했다. 괄호 앞 공백 유무와 괄호 없는 장소도 처리한다.
- 합계 행의 병합 범위를 새 8열/10열 구조에 맞췄다.
- 저장 스키마, Supabase 데이터, 편집 화면과 제출 흐름은 변경하지 않았다.

## 검증 결과

- 운영문서 전체 회귀 스크립트 통과
- 린트와 production build 통과
- 브라우저에서 결과보고서 일정 표의 헤더·3개 실제 행 렌더링 확인
- 모든 일정 셀의 `scrollWidth <= clientWidth` 확인
- Next.js 오류 오버레이와 브라우저 오류 없음

## 누락 및 차이

없음.
