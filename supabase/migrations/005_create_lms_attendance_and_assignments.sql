-- ==============================================================================
-- [005] 울산과학대학교 앵커사업단 평생직업교육 플랫폼 - LMS 출결 및 과제 관리 스키마
-- ==============================================================================
-- 파일 경로: supabase/migrations/005_create_lms_attendance_and_assignments.sql
-- 설명:
--   1. 주차별/차시별 강의실(lms_lectures) 테이블 (온·오프라인 하이브리드 지원)
--   2. 모바일 QR 및 온라인 동영상 시청시간 기반 하이브리드 출결(lms_attendance) 테이블
--   3. 실습형 과제 출제(lms_assignments) 및 수강생 과제 제출/채점(lms_submissions) 테이블
--   4. 학습자 본인 및 배정 강사 전용 RLS(Row Level Security) 접근 통제 정책 적용
-- ==============================================================================

-- 1. 차시별 강의실(lms_lectures) 테이블
-- 초보자 안내: 1회차, 2회차 등 주차별 강의 날짜, 강의 주제, 실습실 위치, 온라인 영상 링크를 관리합니다.
CREATE TABLE IF NOT EXISTS public.lms_lectures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    lecture_order INTEGER NOT NULL,            -- 1강, 2강, 3강 등 차시 번호
    title TEXT NOT NULL,                       -- 차시 강의 주제
    content TEXT,                              -- 강의 상세 안내 및 학습 목표
    lecture_date DATE NOT NULL,                -- 강의 일자
    start_time TIME NOT NULL,                  -- 시작 시간 (예: 19:00:00)
    end_time TIME NOT NULL,                    -- 종료 시간 (예: 21:00:00)
    is_online BOOLEAN NOT NULL DEFAULT FALSE,  -- 온라인 동영상 강좌 여부 (FALSE면 대면실습)
    video_url TEXT,                            -- 이러닝 동영상 재생 스트리밍 주소
    required_watch_seconds INTEGER DEFAULT 0,  -- 출석 인정을 위한 최소 필수 시청 시간 (초 단위)
    material_file_url TEXT,                    -- 교재/실습자료 다운로드 파일 링크
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_course_lecture_order UNIQUE(course_id, lecture_order)
);

COMMENT ON TABLE public.lms_lectures IS '강좌별 차시(주차) 강의실 정보 및 교재/영상 링크 테이블';

-- 강의실 테이블 updated_at 트리거 연결
DROP TRIGGER IF EXISTS trigger_lms_lectures_updated_at ON public.lms_lectures;
CREATE TRIGGER trigger_lms_lectures_updated_at
    BEFORE UPDATE ON public.lms_lectures
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- 2. 하이브리드 출결 기록(lms_attendance) 테이블
-- 초보자 안내: 학생별 차시 출결 상태(PRESENT, LATE, ABSENT)와 오프라인 QR 체크 시간, 온라인 영상 실제 시청 시간을 기록합니다.
CREATE TABLE IF NOT EXISTS public.lms_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lecture_id UUID NOT NULL REFERENCES public.lms_lectures(id) ON DELETE CASCADE,
    enrollment_id UUID NOT NULL REFERENCES public.course_enrollments(id) ON DELETE CASCADE,
    status attendance_status NOT NULL DEFAULT 'ABSENT',
    
    -- 하이브리드 출결 검증 데이터
    check_in_at TIMESTAMPTZ,                   -- 입실(QR 스캔) 일시
    check_out_at TIMESTAMPTZ,                  -- 퇴실 일시
    watched_seconds INTEGER NOT NULL DEFAULT 0,-- 온라인 영상 실제 누적 시청 시간 (초)
    is_qr_verified BOOLEAN NOT NULL DEFAULT FALSE, -- QR 전자출결 검증 완료 여부
    note TEXT,                                 -- 공결 사유 또는 강사 메모
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_lecture_enrollment_attendance UNIQUE(lecture_id, enrollment_id)
);

COMMENT ON TABLE public.lms_attendance IS '수강생별 차시 출석부 (QR 전자출결 및 온라인 시청시간 기록)';

-- 출결 테이블 updated_at 트리거 연결
DROP TRIGGER IF EXISTS trigger_lms_attendance_updated_at ON public.lms_attendance;
CREATE TRIGGER trigger_lms_attendance_updated_at
    BEFORE UPDATE ON public.lms_attendance
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- 3. 과제 출제(lms_assignments) 테이블
-- 초보자 안내: 강사가 학습자에게 제출을 요구하는 실습 과제, 마감일시, 배점(100점 만점 기준 배점 가중치)을 관리합니다.
CREATE TABLE IF NOT EXISTS public.lms_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,                       -- 과제명 (예: 스마트 선박 블록 3D 모델링 파일 제출)
    description TEXT,                          -- 과제 지침 및 제출 형식 안내
    due_at TIMESTAMPTZ NOT NULL,               -- 과제 제출 마감 일시
    max_score NUMERIC(5,2) NOT NULL DEFAULT 100.00, -- 과제 만점 점수
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE public.lms_assignments IS '강좌별 평가 과제 출제 대장';

-- 과제 테이블 updated_at 트리거 연결
DROP TRIGGER IF EXISTS trigger_lms_assignments_updated_at ON public.lms_assignments;
CREATE TRIGGER trigger_lms_assignments_updated_at
    BEFORE UPDATE ON public.lms_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- 4. 과제 제출 및 채점(lms_submissions) 테이블
-- 초보자 안내: 학습자가 작성한 과제 내용, 첨부파일과 강사가 부여한 평가 점수 및 피드백을 관리합니다.
CREATE TABLE IF NOT EXISTS public.lms_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES public.lms_assignments(id) ON DELETE CASCADE,
    enrollment_id UUID NOT NULL REFERENCES public.course_enrollments(id) ON DELETE CASCADE,
    content TEXT,                              -- 과제 제출 텍스트
    submission_file_url TEXT,                  -- 과제 파일 다운로드 URL (Supabase Storage 연동)
    score NUMERIC(5,2),                        -- 강사가 채점한 점수 (미채점 시 NULL)
    feedback TEXT,                             -- 강사 맞춤형 피드백 코멘트
    graded_at TIMESTAMPTZ,                     -- 채점 완료 일시
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_assignment_enrollment_submission UNIQUE(assignment_id, enrollment_id)
);

COMMENT ON TABLE public.lms_submissions IS '학습자 과제 제출물 및 강사 채점/피드백 테이블';

-- 제출 테이블 updated_at 트리거 연결
DROP TRIGGER IF EXISTS trigger_lms_submissions_updated_at ON public.lms_submissions;
CREATE TRIGGER trigger_lms_submissions_updated_at
    BEFORE UPDATE ON public.lms_submissions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ==============================================================================
-- [Row Level Security (RLS) 보안 정책 설정]
-- ==============================================================================

-- 5. RLS 활성화
ALTER TABLE public.lms_lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_submissions ENABLE ROW LEVEL SECURITY;

-- 5.1. [lms_lectures] 수강생, 배정강사, 운영자 강의실 조회 허용
CREATE POLICY "승인 수강생 및 강사 강의실 조회 허용"
    ON public.lms_lectures
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.course_enrollments e
            WHERE e.course_id = lms_lectures.course_id 
              AND e.user_id = auth.uid() 
              AND e.status = 'APPROVED'
        )
        OR EXISTS (
            SELECT 1 FROM public.course_instructors ci
            WHERE ci.course_id = lms_lectures.course_id 
              AND ci.instructor_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('OPERATOR', 'ADMIN')
        )
    );

-- 5.2. [lms_attendance] 학습자 본인 출결 기록만 조회 허용
CREATE POLICY "학습자 본인 출결 조회 허용"
    ON public.lms_attendance
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.course_enrollments e
            WHERE e.id = lms_attendance.enrollment_id AND e.user_id = auth.uid()
        )
    );

-- 5.3. [lms_attendance] 담당 강사 및 운영자 출결 조회 및 승인 허용
CREATE POLICY "담당 강사 및 운영자 출결 관리 허용"
    ON public.lms_attendance
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.lms_lectures l
            JOIN public.course_instructors ci ON ci.course_id = l.course_id
            WHERE l.id = lms_attendance.lecture_id AND ci.instructor_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('OPERATOR', 'ADMIN')
        )
    );

-- 5.4. [lms_assignments] 승인 수강생 및 담당강사 과제 목록 조회 허용
CREATE POLICY "승인 수강생 및 강사 과제 조회 허용"
    ON public.lms_assignments
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.course_enrollments e
            WHERE e.course_id = lms_assignments.course_id 
              AND e.user_id = auth.uid() 
              AND e.status = 'APPROVED'
        )
        OR EXISTS (
            SELECT 1 FROM public.course_instructors ci
            WHERE ci.course_id = lms_assignments.course_id 
              AND ci.instructor_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('OPERATOR', 'ADMIN')
        )
    );

-- 5.5. [lms_submissions] 학습자 본인 과제 제출 및 조회 허용
CREATE POLICY "학습자 본인 과제 제출 및 조회 허용"
    ON public.lms_submissions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.course_enrollments e
            WHERE e.id = lms_submissions.enrollment_id AND e.user_id = auth.uid()
        )
    );

-- 5.6. [lms_submissions] 담당 강사 및 운영자 과제 채점 허용
CREATE POLICY "담당 강사 및 운영자 과제 채점 허용"
    ON public.lms_submissions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.lms_assignments a
            JOIN public.course_instructors ci ON ci.course_id = a.course_id
            WHERE a.id = lms_submissions.assignment_id AND ci.instructor_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('OPERATOR', 'ADMIN')
        )
    );
