# Gap Analysis: anchor-archived-golf-external-instructors

> Date: 2026-09-23 | Design: `docs/02-design/features/anchor-archived-golf-external-instructors.design.md`

## Match Rate: 100%

## Summary

운영 DB의 종료된 파크골프지도사 양성(자격증)과정에 조경호·우철호를 교외 강사로 임시 승인하고 강사 역할과 과정 배정을 생성했다. 원본 PDF 해시를 확인한 뒤 결과보고서 일정 11행을 저장했으며 기존 예산, 사진, 서명 데이터는 유지했다.

## Implemented Items

- [x] 두 사람을 활성 교외 강사로 등록하고 필수서류 제출 대상으로 지정
- [x] 두 사람에게 강사 역할을 부여하고 종료 과정 강사진에 배정
- [x] 원본 결과보고서 6쪽의 일정 11행과 주·보조강사 시간을 그대로 반영
- [x] 대상 과정 상태, 원본 해시, 결과 초안 revision, 빈 일정 조건을 트랜잭션에서 검증
- [x] 강사 승인 2건과 일정 반영 1건을 감사 이벤트로 기록
- [x] Preview에는 원본 결과 자료가 없어 환경별 데이터 이관을 안전하게 생략

## Verification

- 운영 결과 초안 revision 3, 일정 11행, 주강사 시간 35시간, 보조강사 시간 22시간
- 조경호 주강사 7행, 우철호 보조강사 5행
- 두 사람 모두 `EXTERNAL` / `ACTIVE`, 강사 역할 및 과정 배정 확인
- 기존 운영사진 슬롯 28개 유지
- 운영문서 권한·상태 회귀 검증, ESLint, Next.js production build 통과
- Supabase security advisor 오류 0건

## Missing Items

- 없음

## Changed Items

- Preview DB에는 해당 과정의 원본 PDF와 결과 초안이 없으므로 마이그레이션 이력만 적용하고 데이터 생성은 생략했다.
