-- ==============================================================================
-- [002] 울산과학대학교 앵커사업단 평생직업교육 플랫폼 - 회원 프로필 및 개인정보 암호화
-- ==============================================================================
-- 파일 경로: supabase/migrations/002_create_users_and_profiles.sql
-- 설명:
--   1. Supabase Auth(인증)와 연동되는 사용자 프로필(user_profiles) 테이블 생성
--   2. 주민등록번호 등 민감정보 보호를 위한 pgcrypto AES-256 암호화 및 복호화 함수 구현
--   3. 일반 화면에서 안전하게 조회할 수 있는 개인정보 마스킹 뷰(user_profiles_safe_view) 생성
--   4. 회원가입 시 프로필을 자동으로 생성해 주는 트리거 등록
--   5. 강력한 접근 통제를 위한 행 단위 보안 정책(RLS, Row Level Security) 적용
-- ==============================================================================

-- 1. 사용자 프로필 테이블 생성
-- 초보자 안내: Supabase의 기본 auth.users 테이블과 연결(1:1 외래키)하여 회원의 실명, 연락처, 역할 등을 저장합니다.
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    role user_role NOT NULL DEFAULT 'LEARNER',
    -- 암호화된 주민등록번호 (AES-256 암호화 바이트 데이터 저장)
    encrypted_resident_id BYTEA,
    organization TEXT, -- 소속 기관/기업명 (재직자 과정 통계용)
    birth_date DATE,   -- 생년월일 (연령별 통계 지표용)
    gender TEXT,       -- 성별 (남/여)
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 테이블 설명 및 컬럼 주석 달기
COMMENT ON TABLE public.user_profiles IS '앵커사업단 평생직업교육 통합 회원 프로필 테이블';
COMMENT ON COLUMN public.user_profiles.id IS 'Supabase auth.users의 고유 UUID 식별자';
COMMENT ON COLUMN public.user_profiles.role IS '사용자 권한 (LEARNER: 학습자, INSTRUCTOR: 강사, OPERATOR: 운영자, ADMIN: 관리자)';
COMMENT ON COLUMN public.user_profiles.encrypted_resident_id IS 'AES-256 대칭키로 암호화된 주민등록번호 (바이트 배열)';

-- 2. 수정 일시(updated_at) 자동 갱신 트리거 연결
DROP TRIGGER IF EXISTS trigger_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER trigger_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==============================================================================
-- [보안 및 암호화 섹션 - 규칙 8 준수]
-- ==============================================================================

-- 3. 주민등록번호 양방향 대칭키 암호화 함수 (AES-256)
-- 초보자 안내: 회원이 입력한 주민번호 원본(raw_id)과 서버 비밀키(secret_key)를 받아 안전하게 암호화된 bytea 데이터로 변환합니다.
CREATE OR REPLACE FUNCTION public.encrypt_resident_id(
    raw_id TEXT,
    secret_key TEXT
)
RETURNS BYTEA AS $$
BEGIN
    IF raw_id IS NULL OR raw_id = '' THEN
        RETURN NULL;
    END IF;
    -- pgcrypto 내장 함수 pgp_sym_encrypt 사용
    RETURN pgp_sym_encrypt(raw_id, secret_key, 'cipher-algo=aes256');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 주민등록번호 복호화 함수
-- 초보자 안내: 국비 환급 보고서 등 합법적인 사유가 있을 때 서버 비밀키를 통해서만 원본 문자열을 복원합니다.
CREATE OR REPLACE FUNCTION public.decrypt_resident_id(
    encrypted_id BYTEA,
    secret_key TEXT
)
RETURNS TEXT AS $$
BEGIN
    IF encrypted_id IS NULL THEN
        RETURN NULL;
    END IF;
    -- pgcrypto 내장 함수 pgp_sym_decrypt 사용
    RETURN pgp_sym_decrypt(encrypted_id, secret_key);
EXCEPTION
    WHEN OTHERS THEN
        RETURN 'DECRYPTION_FAILED';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 안전한 프로필 조회 뷰 (민감한 암호화 컬럼 제외 및 전화번호 마스킹)
-- 초보자 안내: 프론트엔드 목록 화면에서 실수로라도 암호화된 민감 데이터가 유출되지 않도록 안전하게 정제한 뷰입니다.
CREATE OR REPLACE VIEW public.user_profiles_safe_view AS
SELECT 
    id,
    email,
    name,
    CASE 
        WHEN phone IS NOT NULL AND length(phone) >= 10 THEN
            regexp_replace(phone, '(\d{3})(\d{3,4})(\d{4})', '\1-****-\3')
        ELSE phone
    END AS masked_phone,
    role,
    organization,
    birth_date,
    gender,
    is_active,
    created_at
FROM public.user_profiles;

-- 6. 신규 회원가입 시 프로필 자동 생성 트리거
-- 초보자 안내: 사용자가 회원가입을 완료하면 auth.users 테이블에 추가되는 즉시 user_profiles에도 기본 레코드가 자동 등록됩니다.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', '이름미입력'),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'LEARNER'::user_role)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- [Row Level Security (RLS) 행 단위 보안 정책 설정]
-- ==============================================================================

-- 7. 테이블 RLS 활성화
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 7.1. 본인 프로필 조회 정책 (일반 사용자)
CREATE POLICY "본인 프로필만 조회 가능"
    ON public.user_profiles
    FOR SELECT
    USING (auth.uid() = id);

-- 7.2. 본인 프로필 수정 정책 (이름, 연락처 등)
CREATE POLICY "본인 프로필만 수정 가능"
    ON public.user_profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 7.3. 운영자 및 관리자 전용 전체 조회 정책
CREATE POLICY "운영자 및 관리자 전체 프로필 조회 허용"
    ON public.user_profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('OPERATOR', 'ADMIN')
        )
    );

-- 7.4. 운영자 및 관리자 전용 회원 상태 수정 정책
CREATE POLICY "운영자 및 관리자 회원 수정 허용"
    ON public.user_profiles
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('OPERATOR', 'ADMIN')
        )
    );
