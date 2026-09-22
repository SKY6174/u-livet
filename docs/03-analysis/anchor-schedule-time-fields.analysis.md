# Gap Analysis: anchor-schedule-time-fields

> Date: 2026-09-23 | Design: docs/02-design/features/anchor-schedule-time-fields.design.md

---

## Match Rate: 100%

## Summary

일정 데이터, 편집 화면, A4 출력, AI 가져오기와 Supabase 검증을 동일한 9개 필드 구조로 변경했다. 운영 DB의 기존 파크골프 결과보고서 11개 행은 날짜와 시간을 분리하면서 강사·시수·장소·사진을 보존했다.

## Implemented Items

- [x] `date`, `startTime`, `endTime` 별도 입력과 `HH:mm` 검증
- [x] 강의주제·장소 단일 칸과 주강사·보조강사 이름/교육시간 묶음 배치
- [x] A4 표의 일자·시간·주강사·보조강사 그룹 헤더
- [x] 종료시간이 시작시간보다 늦은지 클라이언트와 DB에서 검증
- [x] 기존 복합 일시 문자열의 안전한 정규화와 불변 제출본의 조회 시 호환
- [x] 신규 세션과 AI 가져오기의 날짜·시작·종료 분리
- [x] Preview·운영 DB 마이그레이션과 Edge Function v5 배포

## Missing Items

- 없음

## Changed Items (Deviations from Design)

- 최종 제출 스냅샷은 감사 목적의 불변 자료이므로 DB 행을 직접 갱신하지 않고 조회·출력 시 정규화한다.

## Verification

- ESLint: 통과
- Next.js production build 및 타입 검사: 통과
- 운영문서 전체 DB 회귀 스크립트: 통과
- 운영 DB 결과보고서: 11/11행 정규화, 주강사 35시간·보조강사 22시간·사진 28장 유지
- Supabase 보안 advisor: 이번 변경으로 추가된 error 등급 항목 없음

## Next Steps

- [x] Match rate 90% 이상으로 완료 보고 진행
