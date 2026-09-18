-- ==============================================================================
-- [001] 울산과학대학교 앵커사업단 평생직업교육 플랫폼 - 확장 모듈 및 공통 ENUM 정의
-- ==============================================================================
-- 파일 경로: supabase/migrations/001_create_enums_and_extensions.sql
-- 설명: 
--   1. 민감정보 암호화를 위한 PostgreSQL 'pgcrypto' 확장 모듈 활성화
--   2. 사용자 역할, 강좌 유형, 수강 상태, 강사 등급 등 공통 열거형(ENUM) 타입 정의
--   3. 모든 테이블에서 공통으로 사용할 수정일시(updated_at) 자동 갱신 함수 등록
-- ==============================================================================

-- 1. pgcrypto 확장 모듈 활성화 (AES-256 개인정보 암호화 지원)
-- 초보자 안내: pgcrypto는 주민등록번호나 계좌번호 같은 민감한 개인정보를 안전하게 암호화해 보관할 수 있게 해주는 도구입니다.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. 사용자 권한 역할(Role) ENUM 정의
--   - LEARNER: 일반 수강생 (성인학습자, 지역주민, 재직자, 재학생)
--   - INSTRUCTOR: 강사 (겸임교수, 외래교원, 산업체 현장전문가)
--   - OPERATOR: 사업단 운영자 (앵커사업단 코디네이터, 전담 연구원)
--   - ADMIN: 최고 관리자 (시스템 및 기관 총괄 관리자)
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
        'LEARNER',
        'INSTRUCTOR',
        'OPERATOR',
        'ADMIN'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 3. 강좌 교육 진행 방식 ENUM 정의
--   - OFFLINE: 대면 실습 및 강의실 집합 교육
--   - ONLINE: 원격 동영상 및 이러닝 교육
--   - BLENDED: 온라인 사전학습 + 오프라인 실습 병행 하이브리드 교육
DO $$ BEGIN
    CREATE TYPE course_type AS ENUM (
        'OFFLINE',
        'ONLINE',
        'BLENDED'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 4. 수강신청 진행 상태 ENUM 정의
--   - APPLIED: 수강신청 접수 완료 (서류선발 또는 대기 상태)
--   - WAITING: 정원 초과 시 예비 대기 순번 부여 상태
--   - APPROVED: 최종 수강 승인 및 선발 확정 (교육 참가 가능)
--   - REJECTED: 서류 심사 탈락 또는 자격 미달 반려
--   - CANCELLED: 학습자 본인 직접 취소 또는 등록 포기
--   - COMPLETED: 출석 및 평가 기준을 충족하여 정상 '수료'
--   - INCOMPLETE: 출석 미달 등으로 인한 '미수료'
DO $$ BEGIN
    CREATE TYPE enrollment_status AS ENUM (
        'APPLIED',
        'WAITING',
        'APPROVED',
        'REJECTED',
        'CANCELLED',
        'COMPLETED',
        'INCOMPLETE'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 5. 강사 자격 등급 ENUM 정의 (시간당 강사료 산출 기준 연계)
--   - TIER_A: 대한민국 명장, 기술사, 박사급 10년 이상 실무경력자 (최고 전문가)
--   - TIER_B: 석사급 7년 이상 또는 공인 기사 자격 소지자 (고급 기술자)
--   - TIER_C: 학사급 3년 이상 산업체 현장 실무자 (일반 실무자)
DO $$ BEGIN
    CREATE TYPE instructor_tier AS ENUM (
        'TIER_A',
        'TIER_B',
        'TIER_C'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 6. 출결 상태 ENUM 정의
--   - PRESENT: 출석 (정상 출석)
--   - LATE: 지각
--   - ABSENT: 결석
--   - EXCUSED: 공결 (예비군, 공문서 등 공식 인정 결석)
DO $$ BEGIN
    CREATE TYPE attendance_status AS ENUM (
        'PRESENT',
        'LATE',
        'ABSENT',
        'EXCUSED'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 7. 데이터 수정 시 updated_at 컬럼을 현재 시각으로 자동 갱신해주는 공통 트리거 함수
-- 초보자 안내: 테이블의 특정 행(Row)이 수정될 때마다 번거롭게 날짜를 일일이 변경하지 않아도 자동으로 현재 시간이 기록됩니다.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
