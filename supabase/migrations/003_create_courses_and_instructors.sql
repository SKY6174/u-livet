-- ==============================================================================
-- [003] 울산과학대학교 앵커사업단 평생직업교육 플랫폼 - 강사 풀 및 교육과정(강좌) 스키마
-- ==============================================================================
-- 파일 경로: supabase/migrations/003_create_courses_and_instructors.sql
-- 설명:
--   1. 산업체 전문가 강사 풀(instructor_profiles) 테이블 및 자격 등급 관리
--   2. 평생직업교육 교육과정 및 강좌(courses) 테이블 (수료 기준, 교육 일정, 정원 포함)
--   3. 강좌와 강사를 연결하고 강의 시수를 기록하는 매칭(course_instructors) 테이블
--   4. 누구나 공개 강좌를 볼 수 있도록 허용하는 공개 RLS 및 강사/관리자 전용 RLS 설정
-- ==============================================================================

-- 1. 강사 상세 프로필 테이블 (강사 풀 Pool)
-- 초보자 안내: user_profiles의 강사(INSTRUCTOR) 계정과 연결되어 학력, 전문분야, 계좌정보, 승인 여부를 보관합니다.
CREATE TABLE IF NOT EXISTS public.instructor_profiles (
    id UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    tier instructor_tier NOT NULL DEFAULT 'TIER_C',
    hourly_rate INTEGER NOT NULL DEFAULT 50000, -- 시간당 강사료 단가(원)
    specialty TEXT NOT NULL,                   -- 전문 분야 (예: 스마트선박 도면설계, 배터리 패키징 등)
    education TEXT,                            -- 최종 학력 및 출신 학교/전공
    career_summary TEXT,                       -- 주요 산업체 실무 경력 요약
    bank_name TEXT,                            -- 강사료 수령 은행명
    encrypted_bank_account BYTEA,              -- 정산용 계좌번호 (AES-256 암호화 저장)
    is_approved BOOLEAN NOT NULL DEFAULT FALSE,-- 사업단 운영자 승인 여부
    approval_date TIMESTAMPTZ,                 -- 승인 확정 일시
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE public.instructor_profiles IS '앵커사업단 산업체 전문가 및 교원 강사 풀 테이블';
COMMENT ON COLUMN public.instructor_profiles.tier IS '강사 자격 등급 (TIER_A: 명장/특급, TIER_B: 고급기술자, TIER_C: 현장실무자)';
COMMENT ON COLUMN public.instructor_profiles.hourly_rate IS '시간당 지급 강사료 단가 (원 단위)';
COMMENT ON COLUMN public.instructor_profiles.encrypted_bank_account IS '암호화된 강사료 수령 계좌번호';

-- 강사 프로필 updated_at 트리거 연결
DROP TRIGGER IF EXISTS trigger_instructor_profiles_updated_at ON public.instructor_profiles;
CREATE TRIGGER trigger_instructor_profiles_updated_at
    BEFORE UPDATE ON public.instructor_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- 2. 교육과정 및 강좌(courses) 테이블
-- 초보자 안내: 개설되는 모든 평생직업교육 강좌의 일정, 정원, 수강료, 수료 기준을 저장합니다.
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,                        -- 강좌명
    category TEXT NOT NULL,                     -- 교육 분야 (조선·해양, 미래모빌리티, 이차전지, 스마트IT, 공통소양 등)
    course_type course_type NOT NULL DEFAULT 'OFFLINE', -- 대면/원격/블렌디드
    description TEXT,                           -- 강좌 소개 및 학습 개요
    target_audience TEXT,                       -- 주요 교육 대상 (예: 현대중공업 협력사 재직자, 울산 청년 구직자 등)
    capacity INTEGER NOT NULL DEFAULT 20,       -- 모집 정원 (명)
    tuition_fee INTEGER NOT NULL DEFAULT 0,     -- 수강료 (국비/지자체 전액지원 시 0원)
    
    -- 모집 및 교육 일정
    apply_start_at TIMESTAMPTZ NOT NULL,        -- 수강신청 시작일시
    apply_end_at TIMESTAMPTZ NOT NULL,          -- 수강신청 마감일시
    course_start_at TIMESTAMPTZ NOT NULL,       -- 교육 시작일시 (개강)
    course_end_at TIMESTAMPTZ NOT NULL,         -- 교육 종료일시 (종강)
    total_hours INTEGER NOT NULL DEFAULT 30,    -- 총 교육 시간 (시수)
    location TEXT,                              -- 강의실/실습장 위치 (예: 울산과학대학교 동부캠퍼스 3공학관 201호)
    
    -- 평생직업교육 수료 기준 (LMS 판정 로직 연계)
    min_attendance_rate NUMERIC(5,2) NOT NULL DEFAULT 80.00, -- 수료 최소 출석률 (% 기준, 기본 80%)
    min_pass_score NUMERIC(5,2) NOT NULL DEFAULT 60.00,      -- 수료 최소 시험/과제 점수 (기본 60점)
    require_survey BOOLEAN NOT NULL DEFAULT TRUE,            -- 수료 전 만족도 설문조사 필수 여부
    
    is_published BOOLEAN NOT NULL DEFAULT FALSE,-- 포털에 공개하여 모집을 시작할지 여부
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE public.courses IS '울산과학대학교 앵커사업단 개설 교육과정(강좌) 테이블';
COMMENT ON COLUMN public.courses.min_attendance_rate IS '수료 사정 기준 출석률 (예: 80.00 은 80% 이상 출석해야 수료)';
COMMENT ON COLUMN public.courses.is_published IS '포털 홈페이지 수강신청 목록 노출 여부';

-- 강좌 테이블 updated_at 트리거 연결
DROP TRIGGER IF EXISTS trigger_courses_updated_at ON public.courses;
CREATE TRIGGER trigger_courses_updated_at
    BEFORE UPDATE ON public.courses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- 3. 강좌-강사 매칭 및 배정 시수 테이블
-- 초보자 안내: 하나의 강좌에 주강사, 실습보조강사 등 복수의 강사가 배정될 수 있으므로 다대다(N:M) 관계로 연결합니다.
CREATE TABLE IF NOT EXISTS public.course_instructors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    instructor_id UUID NOT NULL REFERENCES public.instructor_profiles(id) ON DELETE CASCADE,
    role_in_course TEXT NOT NULL DEFAULT '주강사', -- 주강사, 보조강사, 특강강사 등
    assigned_hours INTEGER NOT NULL DEFAULT 0,    -- 해당 강좌에서 실제 배정된 강의 시수
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(course_id, instructor_id)              -- 같은 강좌에 동일 강사가 중복 배정되지 않도록 보장
);

COMMENT ON TABLE public.course_instructors IS '강좌별 강사 배정 및 실제 강의 시수 매핑 테이블';

-- 매칭 테이블 updated_at 트리거 연결
DROP TRIGGER IF EXISTS trigger_course_instructors_updated_at ON public.course_instructors;
CREATE TRIGGER trigger_course_instructors_updated_at
    BEFORE UPDATE ON public.course_instructors
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ==============================================================================
-- [Row Level Security (RLS) 보안 정책 설정]
-- ==============================================================================

-- 4. RLS 활성화
ALTER TABLE public.instructor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_instructors ENABLE ROW LEVEL SECURITY;

-- 4.1. [courses] 공개 강좌 조회 정책: 포털 방문자(로그인하지 않은 익명 포함) 누구나 공개된 강좌 조회 가능
CREATE POLICY "공개 강좌는 누구나 조회 가능"
    ON public.courses
    FOR SELECT
    USING (is_published = TRUE);

-- 4.2. [courses] 운영자/관리자 전용 모든 강좌 관리 (생성, 수정, 삭제)
CREATE POLICY "운영자 및 관리자 강좌 전체 관리 허용"
    ON public.courses
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('OPERATOR', 'ADMIN')
        )
    );

-- 4.3. [instructor_profiles] 강사 본인 프로필 조회 및 수정 정책
CREATE POLICY "강사 본인 프로필 조회 및 수정 허용"
    ON public.instructor_profiles
    FOR ALL
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 4.4. [instructor_profiles] 운영자/관리자 강사 프로필 전체 조회 및 승인 허용
CREATE POLICY "운영자 및 관리자 강사 프로필 관리 허용"
    ON public.instructor_profiles
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('OPERATOR', 'ADMIN')
        )
    );

-- 4.5. [course_instructors] 배정 강사 및 운영자 매칭 정보 조회 허용
CREATE POLICY "배정 강사 및 운영자 매칭 정보 조회 허용"
    ON public.course_instructors
    FOR SELECT
    USING (
        instructor_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('OPERATOR', 'ADMIN')
        )
    );

-- 4.6. [course_instructors] 운영자 전용 강사 배정 등록 및 수정
CREATE POLICY "운영자 강사 배정 등록 및 수정 허용"
    ON public.course_instructors
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('OPERATOR', 'ADMIN')
        )
    );
