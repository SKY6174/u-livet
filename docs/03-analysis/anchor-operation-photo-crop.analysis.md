# Gap Analysis: anchor-operation-photo-crop

> Date: 2026-09-23 | Design: `docs/02-design/features/anchor-operation-photo-crop.design.md`

## Match Rate: 100%

## Summary

설계한 중앙 기준 16:9 자르기와 출력 통일 규칙을 모두 구현했다. 데이터베이스 구조를 변경하지 않아 기존 운영사진과 호환되며, 직접 첨부와 PDF 추출 사진은 저장 전 물리적으로 16:9 JPEG로 변환된다.

## Implemented Items

- [x] 공용 중앙 자르기 사각형 계산
- [x] 대상 폭을 16의 배수로 맞춰 정확한 16:9 픽셀 크기 생성
- [x] 직접 JPG·PNG 첨부를 최대 960×540으로 변환
- [x] PDF 추출 사진을 최대 672×378로 변환
- [x] 기존 사진의 화면·인쇄 출력을 중앙 `cover` 방식 16:9로 통일
- [x] PDF 가져오기 썸네일을 16:9로 통일
- [x] 2열 배치와 계속 페이지당 최대 8장 유지
- [x] 사진 5~6장일 때 계속 페이지가 생성되지 않던 조건 수정

## Missing Items

없음.

## Verification

- `node scripts/verify-operation-documents.mjs`: 통과
- `npm run lint`: 통과, 경고 0건
- `npm run build`: 통과
- 16:9, 4:3, 초광각, 세로형 입력의 중앙 자르기 좌표 단위 검증: 통과

## Deviations from Design

없음. 사용자 원본 파일은 그대로 유지하고 보고서에 저장되는 사본과 출력 프레임만 자르는 정책을 적용했다.

## Next Steps

- [x] 90% 이상이므로 배포 보고 단계로 진행
