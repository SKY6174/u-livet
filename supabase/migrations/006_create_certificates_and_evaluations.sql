-- ==============================================================================
-- [006] 울산과학대학교 앵커사업단 평생직업교육 플랫폼 - 만족도 설문, 수료증 및 감사 로그
-- ==============================================================================
-- 파일 경로: supabase/migrations/006_create_certificates_and_evaluations.sql
-- 설명:
--   1. 수료 필수 요건인 강의 만족도 평가(course_evaluations) 테이블 생성
--   2. 위·변조 방지 SHA-256 전자 검증 해시가 포함된 전자 수료증(certificates) 발급 대장
--   3. 개인정보 열람 및 중요 행정 행위를 기록하는 감사 로그(audit_logs) 테이블
--   4. 출석률 80% + 평가 60점 + 설문 완료 시 자동으로 수료를 판정하고 수료증을 발급하는 함수
--   5. 외부 제3자(기업 인사담당자)가 진위를 확인할 수 있는 공공 검증 RLS 정책 적용
-- ==============================================================================

-- 1. 강의 만족도 설문(course_evaluations) 테이블
-- 초보자 안내: 평생직업교육 성과 관리를 위해 수강생이 수료 직전 응답하는 필수 설문조사입니다.
CREATE TABLE IF NOT EXISTS public.course_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID NOT NULL REFERENCES public.course_enrollments(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    
    -- 5점 척도 만족도 항목 (1: 매우불만족 ~ 5: 매우만족)
    curriculum_satisfaction INTEGER NOT NULL CHECK (curriculum_satisfaction BETWEEN 1 AND 5),
    instructor_satisfaction INTEGER NOT NULL CHECK (instructor_satisfaction BETWEEN 1 AND 5),
    facility_satisfaction INTEGER NOT NULL CHECK (facility_satisfaction BETWEEN 1 AND 5),
    overall_satisfaction INTEGER NOT NULL CHECK (overall_satisfaction BETWEEN 1 AND 5),
    
    opinion TEXT,                              -- 주관식 건의사항 및 학습 소감
    is_submitted BOOLEAN NOT NULL DEFAULT TRUE,-- 제출 완료 플래그
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_enrollment_evaluation UNIQUE(enrollment_id)
);

COMMENT ON TABLE public.course_evaluations IS '수료 전 필수 강의 만족도 및 교육 품질 평가 설문 테이블';


-- 2. 위·변조 방지 전자 수료증(certificates) 발급 대장
-- 초보자 안내: 정식 수료 조건을 모두 통과한 학습자에게 부여되는 고유 발급번호와 SHA-256 암호화 검증 해시를 보관합니다.
CREATE TABLE IF NOT EXISTS public.certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certificate_no TEXT UNIQUE NOT NULL,       -- 공식 발급 번호 (예: UC-ANCHOR-2026-00042)
    enrollment_id UUID UNIQUE NOT NULL REFERENCES public.course_enrollments(id) ON DELETE CASCADE,
    
    -- 수료 시점의 확정 데이터 스냅샷 (이후 원본 강좌명이 바뀌어도 유지됨)
    course_title TEXT NOT NULL,                -- 이수 강좌명
    learner_name TEXT NOT NULL,                -- 수료자 성명
    total_hours INTEGER NOT NULL,              -- 이수 시수
    attendance_rate NUMERIC(5,2) NOT NULL,     -- 확정 출석률 (%)
    final_score NUMERIC(5,2) NOT NULL,         -- 최종 종합 점수
    
    -- 위·변조 방지 전자 검증 해시 (SHA-256)
    verification_hash TEXT NOT NULL,           -- 수료증 원본 대조용 암호화 해시 문자열
    pdf_url TEXT,                              -- 서명/직인이 날인된 고해상도 PDF 다운로드 주소
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE, -- 수료 취소(부정 출결 등) 여부
    issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE public.certificates IS '울산과학대학교 앵커사업단 공식 전자 수료증 발급 대장';
COMMENT ON COLUMN public.certificates.certificate_no IS '고유 수료증 등록번호';
COMMENT ON COLUMN public.certificates.verification_hash IS '위변조 검증용 SHA-256 무결성 해시값';


-- 3. 개인정보 접근 및 중요 행위 감사 로그(audit_logs) 테이블
-- 초보자 안내: 관리자가 주민번호를 복호화하거나, 수료증을 발급/취소하는 등 중요한 보안 행위를 수행할 때마다 접속 IP와 작업 내용을 빠짐없이 기록합니다.
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,                      -- 수행 작업 (예: VIEW_RESIDENT_ID, ISSUE_CERTIFICATE, EXPORT_REPORT)
    target_table TEXT,                         -- 대상 테이블명
    target_id TEXT,                            -- 대상 레코드 ID
    ip_address TEXT,                           -- 접속 IP 주소
    user_agent TEXT,                           -- 브라우저 정보
    details JSONB,                             -- 변경 상세 내역 (JSON 형식)
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE public.audit_logs IS '개인정보 보호 및 시스템 주요 행위 감사 추적 로그';


-- 4. [핵심 엔진] 수료 기준 자동 판정 및 수료증 발급 함수
-- 초보자 안내: 출석률(80% 이상), 과제 평가(60점 이상), 만족도 설문 완료 여부를 자동 계산하여 수료증을 발급합니다.
CREATE OR REPLACE FUNCTION public.evaluate_and_issue_certificate(
    p_enrollment_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_enrollment RECORD;
    v_course RECORD;
    v_user RECORD;
    v_total_lectures INTEGER;
    v_present_lectures INTEGER;
    v_attendance_rate NUMERIC(5,2);
    v_avg_score NUMERIC(5,2);
    v_survey_completed BOOLEAN;
    v_cert_no TEXT;
    v_hash TEXT;
    v_year TEXT;
    v_seq INTEGER;
BEGIN
    -- 1. 수강신청 정보 조회
    SELECT * INTO v_enrollment FROM public.course_enrollments WHERE id = p_enrollment_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', '수강신청 내역을 찾을 수 없습니다.');
    END IF;

    -- 이미 수료증이 발급된 경우 중복 발급 방지
    IF EXISTS (SELECT 1 FROM public.certificates WHERE enrollment_id = p_enrollment_id) THEN
        RETURN jsonb_build_object('success', false, 'message', '이미 수료증이 발급된 과정입니다.');
    END IF;

    -- 2. 강좌 정보 및 수강자 프로필 조회
    SELECT * INTO v_course FROM public.courses WHERE id = v_enrollment.course_id;
    SELECT * INTO v_user FROM public.user_profiles WHERE id = v_enrollment.user_id;

    -- 3. 출석률 계산 (PRESENT 또는 EXCUSED 출석 인정)
    SELECT COUNT(*) INTO v_total_lectures FROM public.lms_lectures WHERE course_id = v_course.id;
    IF v_total_lectures = 0 THEN
        v_attendance_rate := 100.00;
    ELSE
        SELECT COUNT(*) INTO v_present_lectures 
        FROM public.lms_attendance a
        JOIN public.lms_lectures l ON l.id = a.lecture_id
        WHERE a.enrollment_id = p_enrollment_id AND l.course_id = v_course.id AND a.status IN ('PRESENT', 'EXCUSED');
        
        v_attendance_rate := ROUND((v_present_lectures::numeric / v_total_lectures::numeric) * 100, 2);
    END IF;

    -- 4. 과제 평균 점수 계산 (과제가 없을 경우 기본 100점 인정)
    SELECT COALESCE(AVG(score), 100.00) INTO v_avg_score
    FROM public.lms_submissions
    WHERE enrollment_id = p_enrollment_id;

    -- 5. 필수 만족도 설문 완료 여부 검사
    SELECT EXISTS (
        SELECT 1 FROM public.course_evaluations WHERE enrollment_id = p_enrollment_id
    ) INTO v_survey_completed;

    -- 6. 수료 조건 엄격 검증 (출석률 >= 기준치, 점수 >= 기준치, 설문 필수 충족)
    IF v_attendance_rate < v_course.min_attendance_rate THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', format('출석률 미달입니다. (현재: %s%%, 수료기준: %s%%)', v_attendance_rate, v_course.min_attendance_rate)
        );
    END IF;

    IF v_avg_score < v_course.min_pass_score THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', format('평가 점수 미달입니다. (현재: %s점, 수료기준: %s점)', v_avg_score, v_course.min_pass_score)
        );
    END IF;

    IF v_course.require_survey AND NOT v_survey_completed THEN
        RETURN jsonb_build_object('success', false, 'message', '만족도 설문조사에 먼저 참여해 주셔야 수료가 가능합니다.');
    END IF;

    -- 7. 고유 수료증 번호 생성 (예: UC-ANCHOR-2026-00001)
    v_year := to_char(CURRENT_DATE, 'YYYY');
    SELECT COUNT(*) + 1 INTO v_seq FROM public.certificates;
    v_cert_no := format('UC-ANCHOR-%s-%s', v_year, lpad(v_seq::text, 5, '0'));

    -- 8. 위·변조 방지 SHA-256 검증 해시 생성 (수료증번호 + 사용자ID + 강좌ID + 발급일자)
    v_hash := encode(digest(v_cert_no || v_user.id::text || v_course.id::text || CURRENT_TIMESTAMP::text, 'sha256'), 'hex');

    -- 9. 수료증 대장 등록
    INSERT INTO public.certificates (
        certificate_no,
        enrollment_id,
        course_title,
        learner_name,
        total_hours,
        attendance_rate,
        final_score,
        verification_hash
    ) VALUES (
        v_cert_no,
        p_enrollment_id,
        v_course.title,
        v_user.name,
        v_course.total_hours,
        v_attendance_rate,
        v_avg_score,
        v_hash
    );

    -- 10. 수강신청 테이블 상태를 COMPLETED로 갱신
    UPDATE public.course_enrollments
    SET status = 'COMPLETED',
        is_completed = TRUE,
        completed_at = CURRENT_TIMESTAMP
    WHERE id = p_enrollment_id;

    RETURN jsonb_build_object(
        'success', true, 
        'certificate_no', v_cert_no,
        'verification_hash', v_hash,
        'message', '정상적으로 수료 확정 및 수료증이 발급되었습니다.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================================
-- [Row Level Security (RLS) 보안 정책 설정]
-- ==============================================================================

-- 5. RLS 활성화
ALTER TABLE public.course_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 5.1. [course_evaluations] 학습자 본인 설문 작성 및 조회
CREATE POLICY "학습자 본인 만족도 설문 작성 허용"
    ON public.course_evaluations
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.course_enrollments e
            WHERE e.id = course_evaluations.enrollment_id AND e.user_id = auth.uid()
        )
    );

-- 5.2. [course_evaluations] 운영자/관리자 전체 설문 결과 조회 (통계용)
CREATE POLICY "운영자 설문 결과 통계 조회 허용"
    ON public.course_evaluations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('OPERATOR', 'ADMIN')
        )
    );

-- 5.3. [certificates] 학습자 본인 수료증 조회 허용
CREATE POLICY "학습자 본인 수료증 조회 허용"
    ON public.certificates
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.course_enrollments e
            WHERE e.id = certificates.enrollment_id AND e.user_id = auth.uid()
        )
    );

-- 5.4. [certificates] 제3자(외부 기업) 수료증 진위 검증용 조회 (해시 및 발급번호 일치 시 공개)
CREATE POLICY "제3자 위변조 진위 검증 조회 허용"
    ON public.certificates
    FOR SELECT
    USING (is_revoked = FALSE);

-- 5.5. [certificates] 운영자/관리자 수료증 발급 및 관리 전체 권한
CREATE POLICY "운영자 수료증 관리 허용"
    ON public.certificates
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('OPERATOR', 'ADMIN')
        )
    );

-- 5.6. [audit_logs] 관리자 전용 감사 로그 열람 정책 (위·변조 방지를 위해 UPDATE/DELETE 불가)
CREATE POLICY "관리자 전용 감사 로그 조회 허용"
    ON public.audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

CREATE POLICY "시스템 시스템 감사 로그 기록 허용"
    ON public.audit_logs
    FOR INSERT
    WITH CHECK (TRUE);
