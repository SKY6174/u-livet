---
name: supabase-secure-data
description: Supabase PostgreSQL 데이터베이스 설계 시 순번 마이그레이션 파일 규칙(000_...), RLS 보안 정책, 개인정보 pgcrypto 암호화 및 감사 로그 작성 지침을 제공하는 스킬입니다.
---

# Supabase 보안 데이터 아키텍처 및 마이그레이션 가이드 (SUPABASE-SECURE-DATA)

## 1. 개요 및 절대 규칙
본 프로젝트에서 데이터베이스를 설계하거나 마이그레이션을 생성할 때 반드시 준수해야 하는 규칙입니다.

### [규칙 7] 마이그레이션 파일 명명 및 저장 규칙
- 모든 SQL 파일은 반드시 `supabase/migrations/` 폴더 내에 위치해야 합니다.
- 파일명 접두사로 반드시 3자리 순번 `000_` 형태를 붙여야 합니다.
  - `001_initial_schema_and_extensions.sql`
  - `002_create_users_and_profiles.sql`
  - `003_create_courses_and_instructors.sql`
  - `004_create_enrollments_and_lms.sql`
  - `005_create_certificates_and_evaluations.sql`
  - `006_create_security_rls_and_audit.sql`

### [규칙 8] 개인정보 암호화 및 보안 원칙
- **주민등록번호 등 고유식별정보**:
  - 원칙적으로 주민등록번호 뒷자리는 저장하지 않으며, 고용보험환급 및 정부 실적보고 등 법정 수집 근거가 있을 경우에만 수집합니다.
  - 저장 시에는 반드시 PostgreSQL의 `pgcrypto` 확장을 사용하여 `pgp_sym_encrypt(주민번호, 암호화키)`로 양방향 대칭키 암호화(AES-256) 저장합니다.
- **비밀번호**:
  - Supabase Auth를 기본 사용하되, 자체 인증 테이블 사용 시 bcrypt / Argon2 단방향 해싱(솔트 포함) 적용.
- **전화번호/계좌번호(강사료 지급용)**:
  - 마스킹 처리 뷰(View)를 제공하고 관리자 화면에서도 필요 시에만 감사 로그를 남긴 후 복호화 열람.

---

## 2. 권장 테이블 스키마 구조 개요

```
[users (auth.users 연동)]
   │
   ├── [user_profiles] (이름, 연락처, 생년월일, 역할, 암호화된 식별번호)
   │        │
   │        ├── [instructor_profiles] (학력, 경력, 자격증, 강의이력)
   │        │        │
   │        │        └── [course_instructors]
   │        │                   │
   │        └── [course_enrollments] (수강신청, 선발상태, 수료여부)
   │                   │
   │                   ├── [lms_attendance] (출결기록, 시청시간)
   │                   ├── [lms_submissions] (과제제출, 퀴즈성적)
   │                   └── [certificates] (수료증 발급대장, QR 검증해시)
   │
   └── [courses] (강좌정보, 모집기간, 정원, 강의방식, 수료기준)
```

---

## 3. 개인정보 암호화 표준 SQL 템플릿

```sql
-- 1. pgcrypto 확장 활성화
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. 환경변수 또는 Vault에서 키를 주입받아 암호화/복호화하는 함수 예시
-- 암호화 함수 (Insert/Update 트리거 또는 애플리케이션 레벨 호출)
CREATE OR REPLACE FUNCTION encrypt_resident_id(raw_id text, secret_key text)
RETURNS bytea AS $$
BEGIN
    RETURN pgp_sym_encrypt(raw_id, secret_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 복호화 함수 (인가된 관리자 및 감사 로그 기록 시에만 호출)
CREATE OR REPLACE FUNCTION decrypt_resident_id(encrypted_id bytea, secret_key text)
RETURNS text AS $$
BEGIN
    RETURN pgp_sym_decrypt(encrypted_id, secret_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 4. Row Level Security (RLS) 필수 원칙

1. **테이블 RLS 무조건 활성화**:
   ```sql
   ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
   ALTER TABLE course_enrollments ENABLE ROW LEVEL SECURITY;
   ALTER TABLE lms_attendance ENABLE ROW LEVEL SECURITY;
   ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
   ```
2. **학습자 격리 정책**:
   - 학습자는 `auth.uid() = user_id` 조건으로 자신의 데이터만 `SELECT`, `UPDATE` 가능.
3. **강사 격리 정책**:
   - 강사는 자신이 배정된 강좌(`course_id`)의 수강생 출결/과제 데이터만 열람/수정 가능.
4. **운영자/관리자 전용 정책**:
   - `ROLE_OPERATOR` 또는 `ROLE_ADMIN` 역할을 가진 사용자만 전체 데이터 조회 및 수료 사정 승인 가능.
