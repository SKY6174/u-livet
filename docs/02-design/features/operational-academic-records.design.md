# 출결·성적·수료 운영 읽기 설계

계획: `docs/01-plan/features/operational-academic-records.plan.md`
참고: anchor-learning-evaluation, anchor-attendance-book, anchor-completion-attendance-refunds, 기존 운영 과정/계정/증명/회계 설계.

1. private stable/security definer/빈 search_path predicate `operational_academic_context(offering,person)`는 기존 operational_offering과 non_operational_members ID 분류만 조합한다. 일반 execute를 회수하고 restrictive RLS에 필요한 authenticated execute만 부여한다. 이 boolean은 신원/출결/성적을 반환하지 않으며 공개 RPC를 만들지 않는다. manages/enrolled/teaches/reviews/MFA 같은 기존 권한 helper는 변경하지 않는다.
2. security_invoker private view 9개: operational_enrollments, operational_attendance, operational_submissions, operational_submission_grades, operational_quiz_attempts, operational_quiz_results, operational_completion_runs, operational_completion_approvals, operational_qr_checkins. 과제·회차·시험의 과정과 대상 인물, 판정의 등록 연결을 따라 필터하고 원래 열/상태/점수는 그대로 유지한다. 모든 일반 역할 직접 권한은 회수한다. 정상 철회·미제출/미채점·승인대기/이전 판정은 별도로 제외하지 않는다.
3. attendance_book, qr_checkins, exam_room, completion_board, completion_history, instructor_completion, instructor_home_summary, course_workspace, course_report, my_learning, operation_context, annual_facts, roster 등 읽기 함수 13개에서 운영 view를 사용한다. 기수 단건 조회는 기존 권한에 운영 과정 확인을 AND한다. 목록/최신 판정 선택/집계/연간 fingerprint 전에 필터한다. 기존 시험 종료 전 점수 비공개와 정답 비공개를 유지한다. course_workspace의 학사 분모·완료·대기·출결 기대/기록 수를 같은 범위로 맞춘다.
4. 연간 applications proof/집계와 roster도 같은 인물·과정 범위로 맞춘다. annual_frame/metric/write/report 원본은 변경하지 않는다. 현재 성과 보고서 원본은 별도 감사하고 보존한다. 제출 보고서·공식 문서·성적 판정 evidence·발급/배지 근거에는 운영 projection을 역저장하거나 치환하지 않는다.
5. 직접 SELECT 가능한 life_enrollments, life_attendance, life_submissions, life_completion_runs에 authenticated 대상 restrictive SELECT 정책만 추가한다. 기존 permissive 정책/grants/INSERT·UPDATE·DELETE는 유지한다. 성적/승인 자식은 기존 부모 EXISTS 정책을 통해 같은 제외를 적용한다. 시험 응시는 원래 직접 읽기 권한이 없으므로 권한을 추가하지 않는다. 보안 경계와 통계가 같은 read model을 쓴다.
6. 로컬에서 정상/검증 과정·계정과 출석 누락/휴강/정정 revision, 실제 점수/만료 응시, 승인·미승인·철회·오래된 판정을 섞는다. 수료율의 분모/분자, 출결 기대/기록, 최신 판정 선택, 강사/기관·본인·타 기관/익명, direct RLS와 private view 차단, 원본 hash를 확인한다. 기존 63개 항목에 세션/과제/제출/성적/시험/정답/QR/연간 확정 원본을 추가해 운영 전후 count/hash를 비교한다. 변경 읽기 13개와 새 predicate를 제외한 모든 기존 함수 hash가 그대로여야 한다.

출시: 로컬 검증 및 설계 대조 → 데이터 없는 서울 Preview 전체 migration/검사 → PR/check → drift guard를 둔 동일 SQL 원자적 운영 적용/ledger 등록 → main 병합 자동 배포/READY/SHA/health/실제 수료·보고서·모니터링 확인. QA를 위한 운영 권한 확대나 실제 채점·수료 승인·재산출은 실행하지 않는다.


## 정상 철회자의 과거 직접 조회 보존

검증 중 부모 테이블의 기존 RLS를 다시 타는 SELECT 정책이 정상 철회자의 본인 출결/미공개 과제 제출 조회까지 좁힐 수 있음을 확인했다. 분류를 위한 회차·과제의 과정 ID 조회만 private security definer 함수 `operational_attendance_reference(session,person)`, `operational_submission_reference(assignment,person)`에서 수행한다. 두 helper는 분류 boolean만 반환하고 빈 search_path·authenticated execute 한정이며, 실제 행 접근은 기존 본인/강사/기관 정책이 계속 검사한다. 후속 migration에서 새 restrictive 정책 2개의 USING만 helper로 변경한다. 정상 철회자가 부모 회차·미공개 과제는 볼 수 없어도 본인 기존 출결/제출/성적은 유지되는 사례를 추가 검증한다. 이 보완은 부모 자료 권한이나 기존 처리 함수를 확대하지 않는다.
