# Completion Report: anchor-result-attachments-scholarships

> Date: 2026-09-23 | Level: Dynamic

## 1. Summary

공식 결과보고서에 수강생별 장학금 지급 세부내역을 추가하고, 기존 여섯 결과 문서를 결과보고서 본문과 첨부 1~5 구조로 연결했다. 원문 PDF의 사진 표제 날짜를 자동 추출하도록 개선했으며, 운영 중인 세 완료 과정의 기존 사진도 원문 기준으로 보정했다.

### Final Match Rate

97% (Target: 90%)

## 2. Completed Items

- [x] 수강생별 장학금 대상·유형·지급률·금액·계좌·지급일 입력
- [x] 세부내역에서 인원수와 지급 합계 자동 집계
- [x] 본문 장학금 세부내역과 첨부 3 지급현황 데이터 통합
- [x] 출석부, 수료자명단, 장학금 지급현황, 강사 강의날인부, 강사료 지급현황을 첨부 1~5로 표시
- [x] PDF 사진 표제와 촬영일의 결정적 추출 및 병합
- [x] 기존 반려동물·파크골프·로컬쿠키 결과 초안 사진 보정
- [x] Preview와 운영 Supabase 마이그레이션 적용
- [x] GitHub `main` 푸시 및 Vercel 프로덕션 배포

## 3. Deviations from Design

기존 DB 저장 함수와 제출본의 구형 4키 예산 구조를 안전하게 읽을 수 있도록 검증기는 구형 구조를 한시적으로 허용한다. 실제 가변 문서는 저장 트리거가 즉시 `scholarships: []`를 추가하며 신규 UI는 항상 5키 구조를 저장한다.

## 4. Metrics

| Metric | Value |
|---|---:|
| Application and test files changed | 12 |
| New schema migration | 1 |
| PDCA match rate | 97% |
| Production commit | `83e1c51` |
| Production deployment | READY |

## 5. Validation

- ESLint: passed with zero warnings
- Next.js production build: passed
- Operation document integration verification: passed
- Invalid participant, budget lock, signature lock and immutable submission checks: passed
- Preview and production migration: applied successfully
- Production health endpoint: healthy
- Production revision endpoint: `83e1c51860c67caaf63450542fffcb17854e804c`

## 6. Operational Result

- 반려동물수제간식: 개강식 2026-08-05, 수료식 2026-08-21, 운영사진 8장 날짜 반영
- 파크골프지도사: 개강식 2026-07-14, 수료식 2026-07-21, 운영사진 24장 날짜 반영
- 로컬 쿠키: 개강식 2026-07-20, 수료식 2026-07-31 반영; 원문에 운영사진별 날짜 텍스트가 없는 6장은 빈 날짜 유지

## 7. Follow-up

- 수강생별 장학금 정보는 원문 집계만으로 추정하지 않는다. 담당자가 실제 대상자와 지급자료를 확인해 입력한다.
- 신규 원문 PDF를 가져오면 식별된 사진 날짜가 자동으로 채워지며 작성자가 원문과 대조한 뒤 저장한다.
