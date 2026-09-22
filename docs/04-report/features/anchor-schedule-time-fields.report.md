# 강의 일정 입력 구조 조정 완료 보고

2026-09-23 · anchor-schedule-time-fields

## 결과

운영계획서와 결과보고서의 강의 일정 입력을 `일자 | 시작시간 | 종료시간`으로 분리했다. 강의주제와 교육장소는 각각 한 칸을 사용하고, 주강사와 보조강사는 강사명·교육시간 두 칸씩으로 묶었다. 편집 화면, 저장 검증, 미리보기·인쇄 표, AI PDF 가져오기가 같은 구조를 사용한다.

## 데이터 및 호환성

- 일정 행: `date/startTime/endTime/topic/instructor/hours/assistant/assistantHours/location`
- 운영계획서의 수업방식·공휴일 항목 유지
- 새 과정의 세션 시간은 서울 시간대 기준으로 자동 분리
- 이전 `YYYY.MM.DD. (HH:mm~HH:mm)` 형식은 자동 변환
- 최종 제출 스냅샷은 원본을 변경하지 않고 조회·출력 단계에서 호환

운영 DB의 파크골프 결과보고서 11개 강의행을 변환했다. 변환 후 주강사 합계 35시간, 보조강사 합계 22시간, 운영사진 28장이 그대로 유지됐다.

## 배포

- Supabase Preview·운영 마이그레이션 적용
- `operation-report-ai` Preview·운영 Edge Function v5 배포
- AI 구조화 출력에 `date`, `startTime`, `endTime` 적용
- 웹 애플리케이션 production build 통과

## 검증

- `npm run lint`
- `npm run build`
- `node scripts/verify-operation-documents.mjs`
- `git diff --check`
- 운영 DB 일정 11/11행 키·시간·시수·사진 보존 확인

모든 검사에 통과했다.
