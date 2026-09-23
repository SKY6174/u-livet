# Gap Analysis: anchor-result-attachments-scholarships

> Date: 2026-09-23 | Design: `docs/02-design/features/anchor-result-attachments-scholarships.design.md`

## Match Rate: 97%

## Summary

설계한 장학금 세부행, 수강생 컨텍스트, 본문·첨부 출력 연계, PDF 사진 날짜 추출과 기존 완료 과정 보정이 모두 구현되었다. 로컬 권한·상태전이 통합 검증과 Next.js 프로덕션 빌드가 통과했고, 동일 마이그레이션을 Preview와 운영 Supabase에 순차 적용한 뒤 운영 데이터의 사진 표제·날짜를 조회해 확인했다.

## Implemented Items

- [x] 공식 결과보고서 예산 JSON에 수강생별 장학금 지급 세부행 추가
- [x] 과정의 활성 수강생 목록을 `operation_context`에 추가
- [x] 수강생 선택, 지급률·금액·계좌·지급일·비고 입력 UI 추가
- [x] 세부행 기준 인원수·금액 자동 집계 및 구버전 집계값 호환
- [x] DB 형식 검증과 해당 과정 활성 수강생 여부·성명 검증 트리거 추가
- [x] 본문 8절에 지급 요약과 수강생별 세부내역 페이지 출력
- [x] 공식 세부행을 첨부 3 장학금 지급현황에 우선 반영
- [x] 여섯 문서를 본문과 첨부 1~5로 표시하고 인쇄 제목에도 반영
- [x] PDF 사진 표제·날짜 파서와 개강식·수료식·운영사진 병합 구현
- [x] 반려동물·파크골프·로컬쿠키 현재 초안의 원문 사진 날짜 보정
- [x] Preview 선적용 후 운영 DB 적용 및 결과 조회
- [x] 린트, 빌드, 권한·상태전이·불변 제출본·장학금 대상 검증 통과

## Missing Items

- [ ] 없음

## Changed Items

- [x] DB 검증기는 기존 내부 저장 함수가 생성하는 4키 예산도 받아들인 뒤 저장 트리거에서 `scholarships: []`로 정규화한다. 신규 클라이언트 입력과 저장 데이터는 설계대로 5키 구조를 사용한다.
- [x] 브라우저 자동화 실행 파일과 CUA 런타임이 현재 호스트에서 사용할 수 없어, 인증 화면 시각 검증 대신 프로덕션 빌드와 실제 PostgREST 권한 통합 스크립트로 검증했다.

## Evidence

- `npm run lint`: 통과
- `npm run build`: 통과
- `node scripts/verify-operation-documents.mjs`: 통과
- Preview migration `anchor_result_attachments_scholarships`: 적용 성공
- Production migration `anchor_result_attachments_scholarships`: 적용 성공
- 운영 세 과정: 장학금 세부 배열 키 존재, 개강식·수료식 이미지와 날짜 연결 확인

## Next Steps

- [x] 검증 결과를 보고 단계에 반영
- [ ] 배포 후 운영 URL과 커밋 버전 확인
