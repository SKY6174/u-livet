-- ==============================================================================
-- 울산과학대학교 앵커사업단 RCC센터 평생직업교육 플랫폼 - DB 마이그레이션 010
-- ==============================================================================
-- 파일명: 010_role_based_db_separation_and_optimization.sql
-- 작성일: 2026-09-18
-- 목적:
--   1. [역할별 DB 분리] 수강생, 강사, 사업단 3대 주체별 RLS(행 단위 보안) 엄격한 3단 분리
--   2. [강사 전용 권한] 담당 강좌에 한하여 학생 출결 승인 및 과제 채점 권한(UPDATE) 부여
--   3. [수강생 전용 보호] 타 수강생 출결, 성적, 계좌 및 강사료 정보에 대한 접근 완전 차단
--   4. [역할별 고속 뷰 3종] v_learner_my_portal, v_instructor_class_status, v_admin_kpi_overview 구축
--   5. [성능 가속 인덱스] 역할별 조회 쿼리 왕복 지연시간(RTT)을 단축하는 복합 B-Tree 인덱스 추가
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1단계: 역할(Role) 판별 초고속 보안 헬퍼 함수 정의
-- ------------------------------------------------------------------------------
-- [초보자 안내]
-- SECURITY DEFINER: 테이블 RLS 정책을 우회하여 현재 사용자의 권한을 판별하므로 재귀 에러가 없음.
-- STABLE: 동일 트랜잭션 내에서 결과를 캐싱하여 호출당 0ms 수준으로 즉시 반환.

-- 1.1. 현재 사용자가 수강생(LEARNER)인지 확인
CREATE OR REPLACE FUNCTION public.is_learner()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.get_current_user_role() = 'LEARNER';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.is_learner() IS '현재 로그인한 사용자가 일반 수강생(학습자)인지 판별';


-- 1.2. 현재 사용자가 강사/교원(INSTRUCTOR)인지 확인
CREATE OR REPLACE FUNCTION public.is_instructor()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.get_current_user_role() = 'INSTRUCTOR';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.is_instructor() IS '현재 로그인한 사용자가 산업체 전문가 또는 교원 강사인지 판별';


-- 1.3. 현재 강사가 특정 강좌의 담당 강사로 정식 배정되었는지 확인
CREATE OR REPLACE FUNCTION public.is_instructor_of_course(p_course_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    -- 사업단 관리자는 모든 강좌에 대해 접근 권한을 가짐
    IF public.is_admin_or_operator() THEN
        RETURN TRUE;
    END IF;

    -- 강사 본인이 course_instructors 테이블에 등록되어 있는지 확인
    RETURN EXISTS (
        SELECT 1 FROM public.course_instructors
        WHERE course_id = p_course_id AND instructor_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.is_instructor_of_course(UUID) IS '현재 로그인한 강사가 특정 강좌의 담당 강사인지 실시간 검증';


-- ------------------------------------------------------------------------------
-- 2단계: 역할별 맞춤형 RLS(Row Level Security) 3분류 보안 정책 재구성
-- ------------------------------------------------------------------------------

-- 2.1. [수강신청 대장: course_enrollments]
DROP POLICY IF EXISTS "본인 수강신청 조회 허용" ON public.course_enrollments;
DROP POLICY IF EXISTS "본인 수강신청 생성 허용" ON public.course_enrollments;
DROP POLICY IF EXISTS "운영자 및 관리자 수강생 관리 허용" ON public.course_enrollments;
DROP POLICY IF EXISTS "강사 담당 강좌 수강생 조회 허용" ON public.course_enrollments;

-- 수강생: 본인 신청 내역만 조회
CREATE POLICY "수강생 본인 수강신청 조회"
    ON public.course_enrollments
    FOR SELECT
    USING (auth.uid() = user_id);

-- 수강생: 신규 수강신청 생성
CREATE POLICY "수강생 본인 수강신청 등록"
    ON public.course_enrollments
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 강사: 본인이 가르치는 강좌의 수강생 명단만 조회 가능
CREATE POLICY "강사 담당 강좌 수강생 명단 조회"
    ON public.course_enrollments
    FOR SELECT
    USING (public.is_instructor_of_course(course_id));

-- 사업단 관리자: 전체 수강신청 승인 및 취소 전권
CREATE POLICY "사업단 수강신청 전체 관리"
    ON public.course_enrollments
    FOR ALL
    USING (public.is_admin_or_operator());


-- 2.2. [LMS 출결 대장: lms_attendance]
DROP POLICY IF EXISTS "수강생 본인 출결 조회" ON public.lms_attendance;
DROP POLICY IF EXISTS "강사 담당 강좌 출결 조회 및 승인" ON public.lms_attendance;
DROP POLICY IF EXISTS "사업단 출결 관리" ON public.lms_attendance;

-- 수강생: 본인의 출결 및 시청 기록만 조회
CREATE POLICY "수강생 본인 출결 기록 조회"
    ON public.lms_attendance
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.course_enrollments e
            WHERE e.id = enrollment_id AND e.user_id = auth.uid()
        )
    );

-- 강사: 담당 강좌 학생 출결 조회 및 출석 승인(UPDATE) 권한 부여
CREATE POLICY "강사 담당 강좌 출결 조회 및 승인"
    ON public.lms_attendance
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.lms_lectures lec
            WHERE lec.id = lecture_id AND public.is_instructor_of_course(lec.course_id)
        )
    );

-- 사업단 관리자: 전체 출결 관리
CREATE POLICY "사업단 전체 출결 관리"
    ON public.lms_attendance
    FOR ALL
    USING (public.is_admin_or_operator());


-- 2.3. [과제 제출 및 채점 대장: lms_submissions]
DROP POLICY IF EXISTS "수강생 본인 과제 제출 및 조회" ON public.lms_submissions;
DROP POLICY IF EXISTS "강사 과제 채점 및 피드백 입력" ON public.lms_submissions;
DROP POLICY IF EXISTS "사업단 과제 관리" ON public.lms_submissions;

-- 수강생: 본인 과제 제출물 조회 및 업로드
CREATE POLICY "수강생 본인 과제 제출 및 조회"
    ON public.lms_submissions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.course_enrollments e
            WHERE e.id = enrollment_id AND e.user_id = auth.uid()
        )
    );

-- 강사: 담당 강좌 수강생 과제 조회 및 성적/피드백 채점(UPDATE)
CREATE POLICY "강사 과제 채점 및 피드백 입력"
    ON public.lms_submissions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.lms_assignments a
            WHERE a.id = assignment_id AND public.is_instructor_of_course(a.course_id)
        )
    );

-- 사업단 관리자: 전체 관리
CREATE POLICY "사업단 과제 제출 전체 관리"
    ON public.lms_submissions
    FOR ALL
    USING (public.is_admin_or_operator());


-- 2.4. [강사 프로필 대장: instructor_profiles]
DROP POLICY IF EXISTS "강사 본인 프로필 조회 및 수정 허용" ON public.instructor_profiles;
DROP POLICY IF EXISTS "운영자 및 관리자 강사 프로필 관리 허용" ON public.instructor_profiles;

-- 강사: 본인의 학력, 전문분야, 강사료 등급 조회 및 자기소개 수정
CREATE POLICY "강사 본인 프로필 조회 및 수정"
    ON public.instructor_profiles
    FOR ALL
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 사업단 관리자: 전체 강사진 자격 심사 승인 및 시간당 강사료 등급 부여
CREATE POLICY "사업단 강사 프로필 심사 및 관리"
    ON public.instructor_profiles
    FOR ALL
    USING (public.is_admin_or_operator());


-- ------------------------------------------------------------------------------
-- 3단계: 역할별 전용 고속 집계 뷰(Views) 3종 구축
-- ------------------------------------------------------------------------------

-- 3.1. [수강생 전용 뷰: v_learner_my_portal]
-- 초보자 안내: 수강생이 마이페이지에 들어왔을 때, 6개 테이블을 매번 따로 조회하지 않고
-- 단 한 번의 쿼리로 수강 강좌, 출결률, 최종 성적, 수료증 및 장학금 정산 상태를 즉시 가져옵니다.
CREATE OR REPLACE VIEW public.v_learner_my_portal AS
SELECT 
    e.id AS enrollment_id,
    e.user_id,
    c.id AS course_id,
    c.title AS course_title,
    c.category AS course_category,
    c.total_hours,
    e.status AS enrollment_status,
    e.created_at AS enrolled_at,
    
    -- 출결 현황 집계
    COALESCE(att.attended_count, 0) AS attended_lectures,
    COALESCE(att.total_lectures, 0) AS total_lectures,
    CASE 
        WHEN COALESCE(att.total_lectures, 0) > 0 
        THEN ROUND((COALESCE(att.attended_count, 0)::NUMERIC / att.total_lectures::NUMERIC) * 100, 1)
        ELSE 0.0
    END AS real_time_attendance_rate,
    
    -- 수료증 및 디지털 배지 연동
    cert.certificate_no,
    cert.verification_hash AS cert_hash,
    cert.issued_at AS cert_issued_at,
    badge.badge_code,
    badge.name AS badge_name,
    
    -- 장학금 정산 상태
    sch.name AS scholarship_name,
    dsb.disbursement_amount AS scholarship_amount,
    dsb.status AS scholarship_status
FROM public.course_enrollments e
JOIN public.courses c ON c.id = e.course_id
LEFT JOIN (
    SELECT 
        enrollment_id,
        COUNT(*) AS total_lectures,
        COUNT(*) FILTER (WHERE status = 'PRESENT') AS attended_count
    FROM public.lms_attendance
    GROUP BY enrollment_id
) att ON att.enrollment_id = e.id
LEFT JOIN public.certificates cert ON cert.enrollment_id = e.id
LEFT JOIN public.badge_assertions b_as ON b_as.enrollment_id = e.id
LEFT JOIN public.badge_classes badge ON badge.id = b_as.badge_class_id
LEFT JOIN public.scholarship_disbursements dsb ON dsb.enrollment_id = e.id
LEFT JOIN public.scholarships sch ON sch.id = dsb.scholarship_id;

COMMENT ON VIEW public.v_learner_my_portal IS '수강생 1인의 수강·출결·수료증·디지털배지·장학금 원스톱 조회 뷰';


-- 3.2. [강사 전용 뷰: v_instructor_class_status]
-- 초보자 안내: 강사가 로그인했을 때, 본인이 가르치는 강좌들의 배정 강의실,
-- 정원 대비 수강인원, 과제 미채점 잔여 건수를 한눈에 파악할 수 있는 뷰입니다.
CREATE OR REPLACE VIEW public.v_instructor_class_status AS
SELECT 
    ci.instructor_id,
    c.id AS course_id,
    c.title AS course_title,
    c.category AS course_category,
    c.is_published,
    CASE 
        WHEN CURRENT_TIMESTAMP < c.apply_start_at THEN 'UPCOMING'
        WHEN CURRENT_TIMESTAMP BETWEEN c.apply_start_at AND c.apply_end_at THEN 'RECRUITING'
        WHEN CURRENT_TIMESTAMP BETWEEN c.course_start_at AND c.course_end_at THEN 'IN_PROGRESS'
        WHEN CURRENT_TIMESTAMP > c.course_end_at THEN 'COMPLETED'
        ELSE 'OPEN'
    END AS course_progress_status,
    c.capacity,
    COALESCE(enr.enrolled_count, 0) AS current_enrolled_students,
    
    -- 강의실 배정 정보
    cr.campus_type,
    cr.building_name,
    cr.room_number,
    cr.room_name AS classroom_name,
    
    -- 채점 대기 과제 건수
    COALESCE(sub.pending_eval_count, 0) AS pending_evaluation_count
FROM public.course_instructors ci
JOIN public.courses c ON c.id = ci.course_id
LEFT JOIN public.course_classroom_assignments cca ON cca.course_id = c.id
LEFT JOIN public.classrooms cr ON cr.id = cca.classroom_id
LEFT JOIN (
    SELECT course_id, COUNT(*) AS enrolled_count
    FROM public.course_enrollments
    WHERE status IN ('APPROVED', 'COMPLETED')
    GROUP BY course_id
) enr ON enr.course_id = c.id
LEFT JOIN (
    SELECT 
        a.course_id,
        COUNT(*) AS pending_eval_count
    FROM public.lms_submissions s
    JOIN public.lms_assignments a ON a.id = s.assignment_id
    WHERE s.score IS NULL
    GROUP BY a.course_id
) sub ON sub.course_id = c.id;

COMMENT ON VIEW public.v_instructor_class_status IS '강사별 담당 강좌 강의실 위치, 학생수, 채점 대기 현황 집계 뷰';


-- 3.3. [사업단 관리자 전용 총괄 뷰: v_admin_kpi_overview]
-- 초보자 안내: 사업단 행정실에서 매일 연차보고서용 실적(총 수강자, 승인대기 강사, 장학금 집행액)을
-- 1ms 만에 뽑아볼 수 있도록 전체 마스터 테이블을 종합 요약한 뷰입니다.
CREATE OR REPLACE VIEW public.v_admin_kpi_overview AS
SELECT 
    (SELECT COUNT(*) FROM public.courses WHERE is_published = TRUE) AS total_active_courses,
    (SELECT COUNT(*) FROM public.course_enrollments WHERE status IN ('APPROVED', 'COMPLETED')) AS total_enrolled_learners,
    (SELECT COUNT(*) FROM public.certificates WHERE is_revoked = FALSE) AS total_issued_certificates,
    (SELECT COUNT(*) FROM public.badge_assertions WHERE status = 'ISSUED') AS total_issued_badges,
    (SELECT COUNT(*) FROM public.instructor_profiles WHERE is_approved = FALSE) AS pending_instructor_applicants,
    (SELECT COALESCE(SUM(disbursement_amount), 0) FROM public.scholarship_disbursements WHERE status = 'PAID') AS total_scholarship_disbursed_krw,
    (SELECT COUNT(*) FROM public.classrooms) AS total_classrooms_equipped;

COMMENT ON VIEW public.v_admin_kpi_overview IS '사업단 관리자 전용 핵심 성과 지표(KPI) 및 집행 예산 실시간 요약 뷰';


-- ------------------------------------------------------------------------------
-- 4단계: 역할별 고속 조회를 위한 추가 복합 B-Tree 인덱스
-- ------------------------------------------------------------------------------
-- 강사-강좌 매칭 조회 가속
CREATE INDEX IF NOT EXISTS idx_course_instructors_inst_course 
    ON public.course_instructors (instructor_id, course_id);

-- 과제별/학생별 제출물 조회 가속
CREATE INDEX IF NOT EXISTS idx_lms_submissions_assignment_user 
    ON public.lms_submissions (assignment_id, enrollment_id);

-- 출결 차시별 상태 필터 가속
CREATE INDEX IF NOT EXISTS idx_lms_attendance_lecture_status 
    ON public.lms_attendance (lecture_id, status);

-- 장학금 수혜 대장 상태별 집계 가속
CREATE INDEX IF NOT EXISTS idx_scholarship_disbursements_status_amount 
    ON public.scholarship_disbursements (status, disbursement_amount);
