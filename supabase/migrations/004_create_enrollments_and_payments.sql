-- ==============================================================================
-- [004] 울산과학대학교 앵커사업단 평생직업교육 플랫폼 - 수강신청 및 결제/지원금 스키마
-- ==============================================================================
-- 파일 경로: supabase/migrations/004_create_enrollments_and_payments.sql
-- 설명:
--   1. 교육과정 수강신청(course_enrollments) 테이블 생성 (선착순 대기순번 및 서류심사 지원)
--   2. 국비 전액지원, 바우처 및 자부담 결제 내역(payments) 테이블 생성
--   3. 정원 초과 시 자동으로 예비 대기번호(waiting_number)를 계산해 주는 트리거 구현
--   4. 학습자 본인 격리 및 사업단 운영자 전용 RLS(Row Level Security) 설정
-- ==============================================================================

-- 1. 수강신청(course_enrollments) 테이블 생성
-- 초보자 안내: 어떤 학습자가 어떤 강좌에 신청했는지, 심사 상태(APPLIED, APPROVED, REJECTED 등)와 최종 수료 여부를 관리합니다.
CREATE TABLE IF NOT EXISTS public.course_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    status enrollment_status NOT NULL DEFAULT 'APPLIED',
    
    -- 지원자 추가 정보 (서류 선발형 과정 지원용)
    motivation TEXT,                           -- 지원 동기 및 학습 계획
    organization_name TEXT,                   -- 신청 당시 재직 중인 기업체명
    attachment_url TEXT,                      -- 재직증명서 또는 학력/경력 증빙 파일 경로
    waiting_number INTEGER,                   -- 정원 초과 시 부여되는 예비 대기 순번
    rejection_reason TEXT,                    -- 선발 탈락 또는 반려 사유
    
    -- 수료 사정 최종 결과 플래그
    is_completed BOOLEAN NOT NULL DEFAULT FALSE, -- 출석/시험 통과 시 TRUE로 변경됨
    completed_at TIMESTAMPTZ,                 -- 수료 확정 일시
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- 동일 강좌에 동일인이 중복으로 중복 신청하는 것을 방지
    CONSTRAINT unique_course_user_enrollment UNIQUE(course_id, user_id)
);

COMMENT ON TABLE public.course_enrollments IS '교육과정별 수강신청 및 선발/수료 상태 대장';
COMMENT ON COLUMN public.course_enrollments.status IS '수강 상태 (APPLIED: 접수, WAITING: 대기, APPROVED: 선발승인, REJECTED: 반려, COMPLETED: 수료)';
COMMENT ON COLUMN public.course_enrollments.waiting_number IS '선착순 정원 마감 시 부여되는 예비 순번 (1번, 2번 ...)';

-- 수강신청 테이블 updated_at 트리거 연결
DROP TRIGGER IF EXISTS trigger_course_enrollments_updated_at ON public.course_enrollments;
CREATE TRIGGER trigger_course_enrollments_updated_at
    BEFORE UPDATE ON public.course_enrollments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- 2. 결제 및 국비/사업단 지원금 대장(payments) 테이블
-- 초보자 안내: 앵커사업단 과정은 대부분 '국비/사업단 100% 전액 지원(무료)'이지만, 자부담 실습비나 교재비가 있는 경우 PG 결제 내역을 보관합니다.
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID NOT NULL REFERENCES public.course_enrollments(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL DEFAULT 0,         -- 실제 결제 금액 (전액 지원 무료과정은 0원)
    payment_method TEXT NOT NULL DEFAULT 'GOV_SUBSIDY', -- GOV_SUBSIDY(국비/사업단지원), VOUCHER(바우처), CREDIT_CARD(카드), BANK_TRANSFER(이체)
    status TEXT NOT NULL DEFAULT 'COMPLETED',  -- COMPLETED(완료), PENDING(대기), REFUNDED(환불)
    transaction_id TEXT,                       -- PG사 결제 승인번호 또는 지원금 사업 승인코드
    receipt_url TEXT,                          -- 전자 영수증 또는 국비 지원 확인증 URL
    paid_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE public.payments IS '수강료 결제 및 국비/앵커사업단 지원금 지급 내역 테이블';

-- 결제 테이블 updated_at 트리거 연결
DROP TRIGGER IF EXISTS trigger_payments_updated_at ON public.payments;
CREATE TRIGGER trigger_payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- 3. 정원 초과 시 자동으로 예비 대기번호를 계산해 주는 트리거 함수
-- 초보자 안내: 신청 시점에 승인된 인원이 정원(capacity)을 초과한 경우, 상태를 WAITING으로 바꾸고 대기 번호를 1씩 증가시켜 부여합니다.
CREATE OR REPLACE FUNCTION public.handle_enrollment_capacity_check()
RETURNS TRIGGER AS $$
DECLARE
    v_capacity INTEGER;
    v_approved_count INTEGER;
    v_max_waiting INTEGER;
BEGIN
    -- 해당 강좌의 정원 확인
    SELECT capacity INTO v_capacity FROM public.courses WHERE id = NEW.course_id;
    
    -- 현재까지 승인(APPROVED)된 인원 수 계산
    SELECT COUNT(*) INTO v_approved_count 
    FROM public.course_enrollments 
    WHERE course_id = NEW.course_id AND status = 'APPROVED';
    
    -- 이미 정원이 꽉 찼다면 상태를 대기(WAITING)로 설정하고 순번 계산
    IF v_approved_count >= v_capacity THEN
        SELECT COALESCE(MAX(waiting_number), 0) INTO v_max_waiting
        FROM public.course_enrollments
        WHERE course_id = NEW.course_id;
        
        NEW.status = 'WAITING';
        NEW.waiting_number = v_max_waiting + 1;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_course_capacity ON public.course_enrollments;
CREATE TRIGGER trigger_check_course_capacity
    BEFORE INSERT ON public.course_enrollments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_enrollment_capacity_check();


-- ==============================================================================
-- [Row Level Security (RLS) 보안 정책 설정]
-- ==============================================================================

-- 4. RLS 활성화
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 4.1. [course_enrollments] 학습자 본인 신청 내역만 조회
CREATE POLICY "학습자 본인 수강신청 내역 조회 허용"
    ON public.course_enrollments
    FOR SELECT
    USING (user_id = auth.uid());

-- 4.2. [course_enrollments] 학습자 신규 수강신청 등록 허용
CREATE POLICY "학습자 신규 수강신청 등록 허용"
    ON public.course_enrollments
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- 4.3. [course_enrollments] 학습자 본인 신청 취소 (모집 기간 내 상태를 CANCELLED로 변경)
CREATE POLICY "학습자 본인 수강신청 취소 허용"
    ON public.course_enrollments
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- 4.4. [course_enrollments] 운영자/관리자 전체 수강신청 관리 (심사, 승인, 반려, 대기관리)
CREATE POLICY "운영자 및 관리자 수강신청 전체 관리 허용"
    ON public.course_enrollments
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('OPERATOR', 'ADMIN')
        )
    );

-- 4.5. [payments] 학습자 본인 결제 내역만 조회
CREATE POLICY "학습자 본인 결제 내역 조회 허용"
    ON public.payments
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.course_enrollments e
            WHERE e.id = payments.enrollment_id AND e.user_id = auth.uid()
        )
    );

-- 4.6. [payments] 운영자/관리자 결제 내역 전체 조회 및 환불 관리
CREATE POLICY "운영자 및 관리자 결제 전체 관리 허용"
    ON public.payments
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('OPERATOR', 'ADMIN')
        )
    );
