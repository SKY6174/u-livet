# 과정 안내 날짜·요일·시간 검증

2026-10-07 · course-guide-date-time-fields

## 설계 일치: 100% (10/10)

시작/종료 date 입력, 개별 요일/time 입력, 행 추가/삭제, 요청한 날짜·시간 표기, 기존 그룹/범위 시간표 자동 채움, 미확정 안내 보존, 날짜/시간 역전 방지, DB 계약·revision·권한 유지, 종료일 필터 호환, 모바일 공개 줄바꿈을 구현했다.

## 확인 결과

- `node scripts/verify-course-guide-schedule.mjs`: 8종 검증 통과. 기존 16개 안내, 새 표기 round-trip, 연도 넘김·윤년·날짜 역전·미확정, 요일 그룹/범위·다중 행·형식 오류 및 서울 자정 필터 경계.
- `node scripts/verify-course-catalog.mjs`: 기존 19종 카탈로그 회귀 통과.
- `APPLICATION_TEST_DB_DIR=/tmp/u-livet-issues-db node scripts/verify-course-guide-schedule-flow.mjs`: 7종 실제 Next production 브라우저/DB 검증 통과. native Auth 담당자 로그인, 기존 값 채움, 실제 RPC로 토 14:00~18:00·일 15:00~19:00 저장, DB label/revision 및 재열기, 날짜/시간 역전 시 DB 미수정, 미확정 값 보존, 익명/수강생 저장 차단.
- 1440px 편집 및 360px 편집/상세 스크린샷을 시각 확인했다. 가로 넘침 없음, 상세 요일별 개행(`white-space: pre-line`), 브라우저 JS 오류 없음.
- 전용 uc-life-issues DB에 UUID 기반 합성 안내만 만들고 finally에서 안내·감사 기록을 삭제했다. 안내 행 수 복원 확인. 운영 교육 내용/시간 및 개설 기수는 수정하지 않는다.
- `npm run lint`, `npm run build`, `git diff --check` 통과.
- React 검토: 안정적인 행 key, functional state update, label/fieldset 및 동작 버튼 접근성, 추가 DB 요청 없는 순수 변환, 기존 서버/클라이언트 경계 유지.

## 릴리스

기존 13개 RPC 필드와 길이 검증·권한·revision을 유지하는 프런트엔드 변경으로 schema migration은 없다. PR 자동 검사 후 병합하고 운영의 exact merge revision, health, 카탈로그 및 상세 날짜/시간을 확인한다. 스크린샷은 무시되는 tmp/release-validation에 보관하고 환경파일/시험 자료를 커밋하지 않는다.
