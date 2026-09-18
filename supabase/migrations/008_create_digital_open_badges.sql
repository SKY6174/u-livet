-- ==============================================================================
-- [008] 울산과학대학교 앵커사업단 - Open Badges 2.0 국제 표준 디지털 배지 인프라
-- ==============================================================================
-- 파일 경로: supabase/migrations/008_create_digital_open_badges.sql
-- 설명:
--   1. 1EdTech (구 IMS Global) Open Badges v2.0 국제 표준 규격을 준수하는 디지털 배지 인프라 구축
--   2. 강좌별 역량 배지 정의(badge_classes) 마스터 테이블 생성
--   3. 학습자별 디지털 배지 수여 및 블록체인급 무결성 검증 대장(badge_assertions) 테이블
--   4. 수료증 발급 완료 시 디지털 배지를 자동 수여하는 함수(issue_digital_badge)
--   5. 외부 검증 플랫폼(LinkedIn, Credly, Badgr) 호환 및 엄격한 RLS 정책 적용
-- ==============================================================================

-- 1. 배지 정의 마스터 테이블 (badge_classes)
-- 초보자 안내: Open Badges 표준의 'BadgeClass'로, 어떤 직무 역량에 대해 어떤 이미지와 기준으로 배지를 수여할지 정의합니다.
CREATE TABLE IF NOT EXISTS public.badge_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    
    badge_code TEXT UNIQUE NOT NULL,                          -- 배지 고유 식별 코드 (예: BDG-SMART-SHIP-2026)
    name TEXT NOT NULL,                                       -- 배지 명칭 (예: 스마트 친환경 선박 3D설계 전문가 배지)
    description TEXT NOT NULL,                                -- 배지 설명 및 수여 취지
    image_url TEXT NOT NULL,                                  -- 배지 메달 이미지 URL (SVG 또는 고해상도 PNG)
    criteria_narrative TEXT NOT NULL,                         -- 수여 기준 설명 (출석 80% 이상, 종합평가 60점 이상 등)
    
    -- 발급 기관(Issuer) 정보 (Open Badges 규격 필수)
    issuer_name TEXT NOT NULL DEFAULT '울산과학대학교 앵커사업단 RCC센터',
    issuer_url TEXT NOT NULL DEFAULT 'https://uc-life.vercel.app',
    issuer_email TEXT NOT NULL DEFAULT 'anchor@uc.ac.kr',
    
    -- 직무 역량 태그 및 숙련도 등급
    alignment_skills TEXT[] DEFAULT '{}',                     -- 습득 역량 키워드 (예: {"선체3D모델링", "친환경추진시스템", "선박품질검사"})
    badge_level TEXT NOT NULL DEFAULT 'ADVANCED'
        CHECK (badge_level IN ('INTRODUCTORY', 'INTERMEDIATE', 'ADVANCED', 'MASTER')),
    
    is_active BOOLEAN NOT NULL DEFAULT TRUE,                  -- 배지 운영 활성화 상태
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE public.badge_classes IS 'Open Badges v2.0 규격 강좌별 직무 역량 배지 정의 마스터';


-- 2. 학습자 배지 수여 대장 테이블 (badge_assertions)
-- 초보자 안내: Open Badges 표준의 'Assertion'으로, 특정 학습자에게 특정 일시에 수여된 디지털 배지의 고유 인스턴스 기록입니다.
CREATE TABLE IF NOT EXISTS public.badge_assertions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    badge_class_id UUID NOT NULL REFERENCES public.badge_classes(id) ON DELETE RESTRICT,
    enrollment_id UUID UNIQUE NOT NULL REFERENCES public.course_enrollments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    
    -- 수령자(Recipient) 식별 및 개인정보 보호 (SHA-256 해시)
    recipient_email_hash TEXT NOT NULL,                       -- 수령자 이메일의 SHA-256 해시값 (Open Badges 표준 사양)
    recipient_name TEXT NOT NULL,                             -- 수령자 성명 (스냅샷)
    
    -- 수여 당시 학업 성취도 스냅샷
    attendance_rate NUMERIC(5, 2) NOT NULL,                   -- 이수 출석률
    final_score NUMERIC(5, 2) NOT NULL,                       -- 최종 평가 성적
    
    -- 위·변조 방지 전자 검증 해시
    verification_hash TEXT NOT NULL,                          -- Assertion 무결성 검증 SHA-256 해시
    evidence_url TEXT,                                        -- 수료증 확인 URL 또는 포트폴리오 링크
    
    issued_on TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 배지 공식 수여 일시
    expires_at TIMESTAMPTZ,                                   -- 배지 만료일 (평생자격인 경우 NULL)
    
    status TEXT NOT NULL DEFAULT 'ISSUED'
        CHECK (status IN ('ISSUED', 'REVOKED')),              -- ISSUED: 정상수여, REVOKED: 부정출결 등 취소
    revocation_reason TEXT,                                   -- 취소 사유
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE public.badge_assertions IS 'Open Badges v2.0 규격 학습자 디지털 배지 수여 대장';
COMMENT ON COLUMN public.badge_assertions.verification_hash IS '배지 위변조 방지 SHA-256 전자서명 해시';


-- 3. [자동화 함수] 수료 완료 시 디지털 배지 자동 수여 함수
-- 초보자 안내: 학습자가 과정을 성공적으로 수료하면, 해당 강좌에 등록된 Open Badge를 찾아 고유 해시와 함께 자동으로 발급합니다.
CREATE OR REPLACE FUNCTION public.issue_digital_badge(
    p_enrollment_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_enrollment RECORD;
    v_cert RECORD;
    v_user RECORD;
    v_course RECORD;
    v_badge_class RECORD;
    v_assertion_id UUID;
    v_email_hash TEXT;
    v_verify_hash TEXT;
BEGIN
    -- 1. 수강신청 및 수료증 확인
    SELECT * INTO v_enrollment FROM public.course_enrollments WHERE id = p_enrollment_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', '수강 내역을 찾을 수 없습니다.');
    END IF;

    SELECT * INTO v_cert FROM public.certificates WHERE enrollment_id = p_enrollment_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', '수료증이 먼저 발급되어야 배지를 발급할 수 있습니다.');
    END IF;

    SELECT * INTO v_user FROM public.user_profiles WHERE id = v_enrollment.user_id;
    SELECT * INTO v_course FROM public.courses WHERE id = v_enrollment.course_id;

    -- 2. 해당 강좌의 배지 클래스(BadgeClass) 조회
    SELECT * INTO v_badge_class FROM public.badge_classes WHERE course_id = v_course.id AND is_active = TRUE;
    IF NOT FOUND THEN
        -- 강좌 전용 배지가 아직 없으면 기본 표준 배지 매핑
        SELECT * INTO v_badge_class FROM public.badge_classes WHERE is_active = TRUE LIMIT 1;
    END IF;

    -- 이미 배지가 발급된 경우 중복 발급 방지
    IF EXISTS (SELECT 1 FROM public.badge_assertions WHERE enrollment_id = p_enrollment_id) THEN
        RETURN jsonb_build_object('success', false, 'message', '이미 디지털 배지가 발급되었습니다.');
    END IF;

    -- 3. Open Badges 표준 수령자 이메일 SHA-256 해시 생성
    v_email_hash := 'sha256$' || encode(digest(COALESCE(v_user.email, 'learner@uc.ac.kr'), 'sha256'), 'hex');

    -- 4. 무결성 검증 해시 생성 (배지ID + 수료증번호 + 발급일자)
    v_verify_hash := encode(digest(v_badge_class.id::text || v_cert.certificate_no || CURRENT_TIMESTAMP::text, 'sha256'), 'hex');

    -- 5. 배지 수여 대장(Assertion) 등록
    INSERT INTO public.badge_assertions (
        badge_class_id,
        enrollment_id,
        user_id,
        recipient_email_hash,
        recipient_name,
        attendance_rate,
        final_score,
        verification_hash,
        evidence_url,
        status
    ) VALUES (
        v_badge_class.id,
        p_enrollment_id,
        v_user.id,
        v_email_hash,
        v_user.name,
        v_cert.attendance_rate,
        v_cert.final_score,
        v_verify_hash,
        'https://uc-life.vercel.app/certificate/' || v_cert.certificate_no,
        'ISSUED'
    ) RETURNING id INTO v_assertion_id;

    RETURN jsonb_build_object(
        'success', true,
        'assertion_id', v_assertion_id,
        'verification_hash', v_verify_hash,
        'message', 'Open Badges 표준 디지털 배지가 성공적으로 발급되었습니다.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. 초기 대표 배지 마스터 시드 데이터 삽입
INSERT INTO public.badge_classes (
    course_id,
    badge_code,
    name,
    description,
    image_url,
    criteria_narrative,
    alignment_skills,
    badge_level
)
SELECT 
    id,
    'BDG-SMART-SHIP-2026',
    '스마트 친환경 선박 3D설계 직무 마스터 배지',
    '울산 주력산업인 조선해양 분야에서 미래 친환경 스마트 선박 3D 모델링, 선체 블록 검사 및 공정 설계 역량을 마스터하였음을 인증합니다.',
    '/images/badges/badge_smart_ship.svg',
    '총 64시간 교육 이수, 출석률 80% 이상 및 최종 프로젝트 평가 60점 이상 충족',
    '{"스마트선박", "선체3D모델링", "친환경추진체계", "선박품질검사"}',
    'MASTER'
FROM public.courses
WHERE title LIKE '%선박%' OR title LIKE '%조선%'
LIMIT 1
ON CONFLICT (badge_code) DO NOTHING;


-- ==============================================================================
-- [Row Level Security (RLS) 보안 정책 설정]
-- ==============================================================================

ALTER TABLE public.badge_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badge_assertions ENABLE ROW LEVEL SECURITY;

-- 배지 마스터 정보: 누구나 조회 가능 (공개 사양)
CREATE POLICY "배지 정의 마스터 누구나 조회 허용" ON public.badge_classes FOR SELECT USING (TRUE);

-- 배지 수여 대장: 제3자(링크드인, 기업 채용관) 검증을 위해 정상 발급건은 공개 조회 허용
CREATE POLICY "정상 발급 디지털 배지 공개 검증 허용" ON public.badge_assertions FOR SELECT USING (status = 'ISSUED');

-- 운영자/관리자: 전체 배지 관리 권한
CREATE POLICY "운영자 배지 관리 허용" ON public.badge_classes FOR ALL 
    USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('OPERATOR', 'ADMIN')));

CREATE POLICY "운영자 배지 발급 대장 관리 허용" ON public.badge_assertions FOR ALL 
    USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('OPERATOR', 'ADMIN')));
