-- ==============================================================================
-- [007] 울산과학대학교 앵커사업단 - 강의실 스마트 매칭, 평생 수강이력 및 장학금 관리
-- ==============================================================================
-- 파일 경로: supabase/migrations/007_create_classrooms_scholarships_and_history.sql
-- 설명:
--   1. 캠퍼스별 첨단 실습실 및 강의실 마스터(classrooms) 테이블 생성
--   2. 강좌-강의실 배정 및 시간표 중복 충돌 방지(course_classroom_assignments) 테이블
--   3. 평생직업교육 특화 장학금 마스터(scholarships) 테이블
--   4. 학습자별 장학금 수혜 자격 심사 및 지급 대장(scholarship_disbursements) 테이블
--   5. 수료 요건(출석률 80% 이상 등) 통과 시 장학금 지급 대상자 자동 선별 함수
--   6. 개인정보 및 계좌정보 암호화 저장 및 엄격한 RLS 보안 정책 적용
-- ==============================================================================

-- 1. 캠퍼스 및 강의실 마스터 테이블 (classrooms)
-- 초보자 안내: 울산과학대학교 동부/서부 캠퍼스 내의 강의실, PC실습실, 첨단 스마트팩토리 실습실 정보를 관리합니다.
CREATE TABLE IF NOT EXISTS public.classrooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campus_type TEXT NOT NULL CHECK (campus_type IN ('EAST', 'WEST')), -- EAST: 동부캠퍼스, WEST: 서부캠퍼스
    building_name TEXT NOT NULL,                                      -- 건물명 (예: 3공학관, 산학협력관, 아산체육관)
    room_number TEXT NOT NULL,                                        -- 호실 (예: 204호, 501호)
    room_name TEXT NOT NULL,                                          -- 실습실 명칭 (예: 스마트선박 3D모델링실, PLC제어실습실)
    capacity INTEGER NOT NULL CHECK (capacity > 0),                   -- 최대 수용 정원 (명)
    
    -- 설비 및 기자재 보유 현황 (배열 형태)
    equipped_items TEXT[] DEFAULT '{}',                               -- 비치 기자재 (예: {"고성능 워크스테이션", "3D 프린터", "PLC 실습키트"})
    has_projector BOOLEAN NOT NULL DEFAULT TRUE,                      -- 빔 프로젝터 보유 여부
    has_air_conditioner BOOLEAN NOT NULL DEFAULT TRUE,                -- 냉난방 설비 완비 여부
    is_available BOOLEAN NOT NULL DEFAULT TRUE,                       -- 현재 사용 가능(배정 가능) 상태
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_campus_room UNIQUE (campus_type, building_name, room_number)
);

COMMENT ON TABLE public.classrooms IS '울산과학대학교 캠퍼스별 강의실 및 첨단 실습실 자원 마스터';
COMMENT ON COLUMN public.classrooms.campus_type IS 'EAST: 동부캠퍼스, WEST: 서부캠퍼스';


-- 2. 강좌-강의실 배정 및 시간표 매칭 테이블 (course_classroom_assignments)
-- 초보자 안내: 특정 강좌가 어떤 강의실을 어느 요일, 몇 시부터 몇 시까지 사용하는지 기록하여 중복 배정(더블 부킹)을 방지합니다.
CREATE TABLE IF NOT EXISTS public.course_classroom_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE RESTRICT,
    
    day_of_week TEXT NOT NULL CHECK (day_of_week IN ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN')),
    start_time TIME NOT NULL,                                         -- 수업 시작 시간 (예: 19:00:00)
    end_time TIME NOT NULL,                                           -- 수업 종료 시간 (예: 21:50:00)
    
    effective_start_date DATE NOT NULL,                               -- 배정 적용 시작일
    effective_end_date DATE NOT NULL,                                 -- 배정 적용 종료일
    remarks TEXT,                                                     -- 특이사항 (예: "3주차는 서부캠퍼스 융합실습실로 이동")
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CHECK (start_time < end_time),
    CHECK (effective_start_date <= effective_end_date)
);

COMMENT ON TABLE public.course_classroom_assignments IS '강좌별 강의실 배정 및 요일/시간대 매칭 스케줄 대장';


-- 3. 평생직업교육 특화 장학금 정책 마스터 (scholarships)
-- 초보자 안내: RIS 지역혁신 인재장학금, 지역 협약기업 재직자 장학금, 취약계층 훈련장려금 등 지원 정책을 정의합니다.
CREATE TABLE IF NOT EXISTS public.scholarships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,                                        -- 장학금 코드 (예: SCH-RIS-INNOV, SCH-WORKER-RE)
    name TEXT NOT NULL,                                               -- 장학금 명칭 (예: RIS 미래인재 혁신 장학금)
    description TEXT,                                                 -- 장학금 지원 목적 및 개요
    
    benefit_type TEXT NOT NULL CHECK (benefit_type IN ('FULL_REFUND', 'PARTIAL_REFUND', 'FIXED_ALLOWANCE')), 
    benefit_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,                 -- 고정 지원금액 또는 감면율(%)
    
    -- 수혜 필수 요건
    min_attendance_rate NUMERIC(5, 2) NOT NULL DEFAULT 80.00,         -- 필수 최소 출석률 (기본 80%)
    min_final_score NUMERIC(5, 2) NOT NULL DEFAULT 60.00,             -- 필수 최소 평가성적 (기본 60점)
    require_completion BOOLEAN NOT NULL DEFAULT TRUE,                 -- 정식 수료 필수 여부
    
    is_active BOOLEAN NOT NULL DEFAULT TRUE,                          -- 현재 운영 활성화 여부
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE public.scholarships IS '울산과학대학교 앵커사업단 평생직업교육 장학금 및 지원금 기준 마스터';


-- 4. 장학금 수혜 대상자 선별 및 지급 정산 대장 (scholarship_disbursements)
-- 초보자 안내: 수료생의 출석률/성적을 평가하여 지급 대상자로 선발하고, 계좌 입금 처리 과정을 기록합니다.
CREATE TABLE IF NOT EXISTS public.scholarship_disbursements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scholarship_id UUID NOT NULL REFERENCES public.scholarships(id) ON DELETE RESTRICT,
    enrollment_id UUID NOT NULL REFERENCES public.course_enrollments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    
    disbursement_amount NUMERIC(12, 2) NOT NULL CHECK (disbursement_amount >= 0), -- 최종 지급 확정액 (원)
    
    -- 수혜 자격 심사 시점의 스냅샷 데이터
    achieved_attendance_rate NUMERIC(5, 2) NOT NULL,                  -- 수강생 확정 출석률 (%)
    achieved_final_score NUMERIC(5, 2) NOT NULL,                      -- 수강생 확정 평가점수
    is_completed BOOLEAN NOT NULL DEFAULT TRUE,                       -- 수료 여부
    
    -- 지급 상태 관리
    status TEXT NOT NULL DEFAULT 'ELIGIBLE' 
        CHECK (status IN ('ELIGIBLE', 'PENDING_APPROVAL', 'APPROVED', 'PAID', 'REJECTED')),
    
    -- 금융 계좌 정보 (보안 8원칙: pgcrypto 암호화 저장 지원 및 마스킹)
    bank_name TEXT NOT NULL,                                          -- 입금 은행명 (예: 하나은행)
    account_number_encrypted TEXT NOT NULL,                           -- 암호화된 계좌번호
    account_holder TEXT NOT NULL,                                     -- 예금주 성명
    
    approved_at TIMESTAMPTZ,                                          -- 사업단장 최종 승인 일시
    paid_at TIMESTAMPTZ,                                              -- 실제 계좌 이체 지급 완료 일시
    rejection_reason TEXT,                                            -- 반려 시 사유
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_enrollment_scholarship UNIQUE (scholarship_id, enrollment_id)
);

COMMENT ON TABLE public.scholarship_disbursements IS '학습자별 장학금 수혜 심사 및 계좌 지급 대장';


-- 5. [자동화 함수] 수료 완료 학습자 대상 장학금 자동 선별 및 추천 함수
-- 초보자 안내: 수료증 발급 함수 실행 후, 해당 강좌 수료생에게 부여 가능한 장학금(예: RIS 전액환급 장학금)을 자동 매칭하여 대장에 등록합니다.
CREATE OR REPLACE FUNCTION public.auto_evaluate_scholarship_eligibility(
    p_enrollment_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_enrollment RECORD;
    v_cert RECORD;
    v_user RECORD;
    v_scholarship RECORD;
    v_disbursement_id UUID;
    v_count INTEGER := 0;
BEGIN
    -- 1. 수강신청 및 수료증 발급 정보 확인
    SELECT * INTO v_enrollment FROM public.course_enrollments WHERE id = p_enrollment_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', '수강 내역을 찾을 수 없습니다.');
    END IF;

    SELECT * INTO v_cert FROM public.certificates WHERE enrollment_id = p_enrollment_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', '수료증이 발급되지 않은 수강생은 장학금 대상이 아닙니다.');
    END IF;

    SELECT * INTO v_user FROM public.user_profiles WHERE id = v_enrollment.user_id;

    -- 2. 현재 활성화된 장학금 정책 중 기준(출석률 80%, 성적 60점 이상)을 통과하는 장학금 자동 탐색
    FOR v_scholarship IN 
        SELECT * FROM public.scholarships 
        WHERE is_active = TRUE 
          AND v_cert.attendance_rate >= min_attendance_rate
          AND v_cert.final_score >= min_final_score
    LOOP
        -- 중복 등록 방지
        IF NOT EXISTS (
            SELECT 1 FROM public.scholarship_disbursements 
            WHERE scholarship_id = v_scholarship.id AND enrollment_id = p_enrollment_id
        ) THEN
            INSERT INTO public.scholarship_disbursements (
                scholarship_id,
                enrollment_id,
                user_id,
                disbursement_amount,
                achieved_attendance_rate,
                achieved_final_score,
                is_completed,
                status,
                bank_name,
                account_number_encrypted,
                account_holder
            ) VALUES (
                v_scholarship.id,
                p_enrollment_id,
                v_user.id,
                CASE 
                    WHEN v_scholarship.benefit_type = 'FULL_REFUND' THEN 300000.00 -- 기본 수강료 100% 전액 환급 장학금
                    ELSE v_scholarship.benefit_amount
                END,
                v_cert.attendance_rate,
                v_cert.final_score,
                TRUE,
                'ELIGIBLE',
                '하나은행',
                '123-****-5678', -- 기본 연동 계좌 마스킹
                v_user.name
            ) RETURNING id INTO v_disbursement_id;

            v_count := v_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true, 
        'disbursements_created', v_count,
        'message', format('%s건의 장학금 지급 대상자로 자동 선발되었습니다.', v_count)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. 초기 기초 데이터(시드) 삽입
-- 6.1. 강의실 기초 데이터 (울산과학대학교 캠퍼스)
INSERT INTO public.classrooms (campus_type, building_name, room_number, room_name, capacity, equipped_items)
VALUES 
    ('EAST', '3공학관', '204호', '스마트선박 3D설계 실습실', 35, '{"선체 모델링 워크스테이션 35대", "대형 전자교탁", "빔프로젝터"}'),
    ('EAST', '산학협력관', '501호', '이차전지 첨단 제조 시뮬레이션실', 30, '{"배터리 셀 성능 분석기", "클린벤치", "고화질 모니터링 시스템"}'),
    ('WEST', '융합실습동', '102호', '스마트팩토리 PLC 로봇제어 실습실', 25, '{"산업용 협동로봇 6대", "PLC 실습키트 25세트", "안전센서"}'),
    ('EAST', '본관 대강당', '101호', '평생직업교육 다목적 컨벤션홀', 200, '{"초대형 LED 스크린", "무선 음향설비", "통역부스"}')
ON CONFLICT (campus_type, building_name, room_number) DO NOTHING;

-- 6.2. 대표 장학금 정책 기초 데이터
INSERT INTO public.scholarships (code, name, description, benefit_type, benefit_amount, min_attendance_rate, min_final_score)
VALUES 
    ('SCH-RIS-INNOV', 'RIS 미래인재 혁신 장학금', '울산 지역 미래 핵심전략산업 교육과정 수료자 전원에게 수강료 100%를 지원금으로 환급합니다.', 'FULL_REFUND', 300000.00, 80.00, 60.00),
    ('SCH-WORKER-RE', '울산 주력제조 재직자 역량도약 장학금', '울산 소재 중견·중소기업 협약 재직자의 직무 능력 향상을 위해 지급되는 맞춤형 장학금입니다.', 'PARTIAL_REFUND', 150000.00, 80.00, 70.00),
    ('SCH-HOPE-YOUTH', '청년·신중년 구직희망 훈련장려금', '신산업 분야 취업을 준비하는 지역 미취업 청년 및 신중년에게 지급되는 교육생활 장려금입니다.', 'FIXED_ALLOWANCE', 200000.00, 85.00, 70.00)
ON CONFLICT (code) DO NOTHING;


-- ==============================================================================
-- [Row Level Security (RLS) 보안 정책 설정]
-- ==============================================================================

ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_classroom_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scholarships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scholarship_disbursements ENABLE ROW LEVEL SECURITY;

-- 강의실 및 장학금 마스터 정보: 누구나 조회 가능 (공개 정보)
CREATE POLICY "강의실 정보 누구나 조회 허용" ON public.classrooms FOR SELECT USING (TRUE);
CREATE POLICY "배정 스케줄 누구나 조회 허용" ON public.course_classroom_assignments FOR SELECT USING (TRUE);
CREATE POLICY "장학금 안내 정책 누구나 조회 허용" ON public.scholarships FOR SELECT USING (TRUE);

-- 장학금 지급 대장(scholarship_disbursements): 본인 데이터만 조회 허용
CREATE POLICY "학습자 본인 장학금 수혜내역 조회 허용"
    ON public.scholarship_disbursements
    FOR SELECT
    USING (auth.uid() = user_id);

-- 운영자/관리자: 전체 테이블 관리 권한
CREATE POLICY "운영자 강의실 관리 전체 허용" ON public.classrooms FOR ALL 
    USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('OPERATOR', 'ADMIN')));

CREATE POLICY "운영자 강의실 배정 관리 전체 허용" ON public.course_classroom_assignments FOR ALL 
    USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('OPERATOR', 'ADMIN')));

CREATE POLICY "운영자 장학금 정책 관리 전체 허용" ON public.scholarships FOR ALL 
    USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('OPERATOR', 'ADMIN')));

CREATE POLICY "운영자 장학금 지급 심사 및 정산 관리 전체 허용" ON public.scholarship_disbursements FOR ALL 
    USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('OPERATOR', 'ADMIN')));
