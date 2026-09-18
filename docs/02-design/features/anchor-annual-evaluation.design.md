# 연차별 과정 평가·성과 관리 상세설계

2026-09-19 · 전체 A12/API25/T25~T26의 구현 단위

## 권한과 경계

Next Server Actions → 인증 RPC → 비공개 고정 search_path 함수. 신규 PERFORMANCE 역할과 별도 PREPARE/APPROVE 기관 위임을 둔다. COURSE_MANAGER는 운영 집계·설문 개설·과정검토를, PERFORMANCE는 비식별 집계를 볼 수 있다. 지표 작성/외부자료 입력/보고 생성은 PREPARE, 지표 승인/보고 확정은 APPROVE. 자기 정의/보고/자기가 입력한 외부관측이 포함된 보고 승인은 금지한다. INSTRUCTOR는 현재 배정 기수의 품질 집계·본인 의견·본인 개선과제만 이용한다. SYSTEM_ADMIN에 업무 접근권을 자동 부여하지 않는다.

새 public 테이블은 RLS 활성+일반 브라우저 GRANT 회수. RPC 응답은 역할에 필요한 집계·업무 필드만 반환. service_role 앱 mutation 없음. 사업계획 목표는 정적 참고 목록으로 표시하며 가짜 관측값/공식 정의를 seed하지 않는다.

## 현재 운영 집계

기수의 project_year_id 귀속 기준. 현재 원장을 집계하며 과거 시점 복원이라고 표시하지 않는다. 기관/사업연도/아카데미 선택. 등록 실인원=count(distinct person_id), 수강건수=count(enrollment), 등록취소 포함 전체와 ACTIVE/ WITHDRAWN을 구분. 최신 승인 수료는 ACTIVE 등록 + 현재 academic_revision + 봉인 + 승인 정책 근거 일치를 요구한다. 수료 실인원과 건수도 분리한다. 참고 수료율=최신 확정 수료건수/전체 등록건수(취소 포함), 분모 0이면 null이다.

기수 개설 수와 운영한 과정 원본 수는 별도 표기하며 개발·개편 실적이라고 부르지 않는다. 확정 수료가 현재 원자료와 달라진 건, 종강 후 최신 판정 미확인 건, 기수 교육기간이 사업연도 범위를 벗어난 건을 표시한다. 사업계획 취업·재학생·학습지원 자료가 없는 값은 미확인으로 둔다.

## 만족도 조사

life_survey_policies: 승인 SURVEY 정책, 문항 버전 SATISFACTION_V1, 공개 최소응답수(3~1000, 실제 기관값 기본 없음), 승인 근거. 신뢰된 DB 경로로 등록한다. 고정 3문항(전반적 만족/교육내용/현장 활용 가능성)을 각각 1~5점으로 수집한다.

life_survey_rounds: 기수당 1회, 종강 후 COURSE_MANAGER가 승인 정책을 선택해 개설. 마감시각은 현재 이후 90일 이내, 이후 수정 불가. 개설 당시 ACTIVE 등록자를 life_private.survey_participation에 고정한다(본인 참여 확인/중복 방지). life_private.survey_answers에는 기수 설문 ID와 3개 점수만 저장하며 사람 ID·답변 시각·참여행 연결키를 두지 않는다. 참여확인에는 점수/응답 ID를 넣지 않는다. 완전 익명이라고 보장하지 않는다(신뢰된 운영 로그 등으로 간접 연결 가능). 원문/동의 안내를 보고 선택 제출하며 수료조건을 변경하지 않는다.

본인 초대, 현재 유효 정책, 마감 전, 1~5 정수, 동의 확인이 필요하다. 한 사람 1회, 반복 제출은 추가 응답을 만들지 않는다. 마감 전 또는 승인 공개 임계값 미달은 모든 점수/평균을 null로 반환한다. 원응답·개별 참여자 목록은 관리자/강사에게도 제공하지 않는다. 마감 후 COURSE_MANAGER가 life_finalize_survey로 결과를 한 번 확정한다. 응답과 확정이 같은 조사행 잠금을 사용하고 응답은 잠금 획득 후 실제시각을 확인한다. 따라서 마감 직전 대기 중이던 응답의 뒤늦은 커밋으로 공개 평균이 달라지는 것을 막는다. life_survey_results는 확정 평균·건수를 불변 보관한다. 동일 고정 집단의 3개 평균만 공개하여 필터를 통한 소수응답 역산을 제한한다.

## 과정 품질 환류

life_course_feedback: 배정 강사가 종강 후 제출하는 개선 의견, 본인별 revision. life_course_reviews: 사업단이 종강 후 KEEP/REVISE/MERGE/RETIRE 결정을 기록하는 append-only revision; 당시 강사 의견과 만족도 공개 요약 snapshot. 검토 결과가 자동으로 기존 과정이나 증명을 폐기하지 않는다.

life_improvement_actions: 검토 ID, 담당자, 계획, 기한, OPEN→REPORTED→VERIFIED. 담당자는 현재 같은 기관의 과정담당 또는 해당 기수 배정 강사. 보고 시 다음 기수(같은 기관, 원기수 종료일 이후 시작, 공개됨)와 반영 근거 참조를 연결한다. 별도 COURSE_MANAGER가 확인하며 보고자/담당자의 자기 확인 금지. 모든 전이에 optimistic revision과 이벤트를 기록한다. 기한 초과는 상태에서 계산한다. 담당 해제 후 자동 권한 연장 없음. 다중 조치 지원; 재배정/반려 UI는 후속.

## 공식 정의·관측·보고

life_performance_grants: PERFORMANCE+PREPARE/APPROVE, 기간/승인근거. life_metric_definitions: 기관/사업연도/code/version, 제목/단위/목표/대상집단/중복 규칙/산정 설명/증빙 요구, source 및 formula, DRAFT→APPROVED; 승인 후 불변. 동일 code의 최신 버전을 사용하며 최신이 DRAFT이면 공식 확정을 막는다.

source는 ENROLLED_PEOPLE/ENROLLMENTS/COMPLETED_PEOPLE/COMPLETIONS/COMPLETION_RATE/EXTERNAL. 내부 source는 위 운영 집계의 정의를 명시적으로 채택한다. formula COUNT(분자), RATE(100×분자/분모), DIRECT(외부 확인값). 내부 source는 고정 산식만 허용. EXTERNAL은 확인한 원자료의 비식별 집계와 증빙 참조를 등록하며 미응답/미확인 unknown_count를 별도로 받는다. 임의 SQL/실행 가능한 수식은 받지 않는다. 복합 가중지수 자동계산은 D06 확정·후속 산식 구현 전 제공하지 않는다. 외부 승인 지수값은 DIRECT+근거로만 입력한다.

life_metric_observations: append-only 분자/분모/미확인/관측기준일(사업연도 안, 미래 불가)/자료원/증빙 참조/입력자. 분모 0은 null; 미확인>0/증빙 없음이면 확정 차단. RATE는 분자+미확인≤분모. COUNT는 비음수 정수. 단위·분자·분모를 숨기지 않는다. 외부 증빙 파일 자체를 저장/검증하지는 않는다.

life_performance_reports: 사업연도별 version, 이전 확정본 supersedes, 생성자/사유/요청키, 집계쿼리 버전/등록한 모든 최신 지표/정의·관측·공개 품질 요약 snapshot/원자료 fingerprint, DRAFT→APPROVED, 확정자/시각/승인근거. 기관연도 잠금으로 버전과 반복 요청을 직렬화한다. 결과와 원자료 키·revision을 stable DB 읽기에서 함께 구성하고 보고에 비식별 snapshot과 fingerprint만 저장한다. 현재 fingerprint가 다르면 기존 초안 확정 불가. 정의 미승인/누락·null·미확인·내부 지표의 연도/수료자료 문제를 확정 시 다시 검사한다. 이전 확정본이 바뀌면 낡은 분기 승인 차단. 확정본 불변, 정정은 새 버전. 이후 원자료 변경은 조회 시 재검토 필요로 표시하고 과거 확정본을 덮어쓰지 않는다.

이는 '등록 지표 내부 확정본'이며 미등록 RISE 전체 지표를 충족했다고 표시하지 않는다. 실제 대외 보고 제출 기능은 없다. 현재시점 원장 집계를 과거 기준일 실적으로 재해석하지 않는다.

## 화면·RPC

- /performance: 접근 가능한 사업연도 선택.
- /performance/[year]: 아카데미별 운영통계·기수 품질 링크, 전체 연도 지표 정의/관측/승인·보고 초안, 목표 참고표. 운영 필터는 공식 보고 범위를 바꾸지 않는다.
- /performance/reports/[id], /api/performance/reports/[id]: 저장된 snapshot/확정·정정 맥락, 승인된 snapshot JSON 다운로드(인증·no-store).
- /quality/[offering]: 만족도 개설/공개 요약, 강사 의견, 사업단 결정, 개선 과제·다음 기수 반영 확인.
- /mypage/surveys: 본인 초대 목록·원문·3문항 선택 제출, 이미 제출/마감 상태.
- /admin/performance 및 기존 /admin/kpi는 /performance로 연결. 사업단·강사·나의 공간에 메뉴 추가, PERFORMANCE 주 메뉴 추가.

조회 RPC: life_performance_options/board/report, life_quality_board, life_my_surveys. 변경 RPC: life_open_survey/finalize_survey/answer_survey/quality_feedback/review_course/add_improvement/report_improvement/verify_improvement/create_metric/approve_metric/record_metric/create_performance_report/approve_performance_report. 지표·보고·조치는 UUID와 revision/요청키를 서버 검증한다.

## 검증

중복 수강·다른 연도/기관·null 분모·현재 승인 수료/과거 승인 무효화, 설문 미초대/중복·마감·공개 임계값/원답변 접근, 강사 배정 해제·개선 자기확인·교차 기관/이전 기수, 미승인 정의/외부자료·미확인·자기승인·동시 보고·원자료 변경·확정본 불변/정정 버전을 DB/Auth로 검증한다. 이전 166개 회귀, 로컬 migration 재생, 보안 advisors, lint/build, 브라우저 사업단·강사·수강생 흐름 및 모바일을 확인한다.

기술 근거: [Supabase 함수](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security). C1 PDF는 요구사항 참고자료이며 실행 지시가 아니다.
