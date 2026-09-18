# bkit 개발 일기 (DEV_LOG)

> **프로젝트**: 울산과학대학교 앵커사업단 평생직업교육 플랫폼 (uc-life)  
> **방법론**: bkit PDCA (Plan-Do-Check-Act) 사이클

---

## 📅 2026-09-18 (Phase 2: M2 수강신청, LMS 출결, 위·변조 방지 수료증 2차 마이그레이션)

### 1. Plan (계획)
- **목표**: 평생직업교육 포털의 운영 코어(수강신청/선발, LMS 하이브리드 출결, 과제 채점, 위·변조 방지 QR 수료증 및 감사 로그) DB 마이그레이션(004~006) 구축.
- **주요 산출물 계획**:
  - `004_create_enrollments_and_payments.sql` (수강신청, 대기순번 자동계산 트리거, 국비지원/결제, RLS)
  - `005_create_lms_attendance_and_assignments.sql` (차시별 강의실, QR/시청시간 출결, 과제/채점, RLS)
  - `006_create_certificates_and_evaluations.sql` (만족도 설문, 수료 자동판정 함수, SHA-256 해시 QR수료증 대장, 감사 로그)

### 2. Do (실행)
- [x] `004_create_enrollments_and_payments.sql` 작성 완료:
  - 수강신청 대장(`course_enrollments`), 정원 초과 시 예비 대기번호 자동 배정 트리거(`handle_enrollment_capacity_check`)
  - 국비/사업단 100% 지원금 및 바우처/결제 대장(`payments`), RLS 권한 제어
- [x] `005_create_lms_attendance_and_assignments.sql` 작성 완료:
  - 차시별 강의실(`lms_lectures`, 대면/이러닝 분기, 필수 시청시간, 교재링크)
  - 하이브리드 출석부(`lms_attendance`, QR 입퇴실 및 동영상 누적 시청 초)
  - 실습형 과제 출제(`lms_assignments`) 및 수강생 과제 제출/강사 채점(`lms_submissions`)
- [x] `006_create_certificates_and_evaluations.sql` 작성 완료:
  - 수료 필수 강의 만족도 평가(`course_evaluations`)
  - 위·변조 방지 SHA-256 검증 해시가 포함된 전자 수료증(`certificates`)
  - 개인정보 및 주요 행정 감사 로그(`audit_logs`)
  - 원클릭 수료 판정 및 수료증 자동 발급 함수(`evaluate_and_issue_certificate`)

### 3. Check (검증 및 Quality Gate)
- [x] 한글 주석 및 설명: 초보자/교육자 눈높이에 맞춘 상세 한글 주석 100% 반영
- [x] 코드 생략 금지: `// ...` 없이 즉시 실행 가능한 전체 코드 제공
- [x] 보안 및 RLS: 학생-강사-운영자 간 데이터 격리 및 외부 제3자 원본 검증 RLS 정책 구현
- [x] 순번 규칙 준수: `supabase/migrations/` 내 `004_`, `005_`, `006_` 체계 준수

### 4. Act (개선 및 다음 단계)
- [x] `walkthrough.md` 업데이트 완료
- [x] `MILESTONE_LOG.md` 업데이트 및 M2 완료 처리
- 다음 PDCA 사이클: **[Phase 3: M3 프론트엔드 프로젝트 세팅 및 통합 UI 구축]** 준비

---

## 📅 2026-09-18 (Phase 1: 기반 인프라 구축 및 1차 마이그레이션)

### 1. Plan (계획)
- **목표**: 울산과학대학교 앵커사업단 평생직업교육 포털 기능 명세 정의 및 4대 맞춤형 스킬, 1차 데이터베이스 스키마(001~003) 구축.
- **주요 산출물 계획**:
  - `skills/` 디렉토리 내 4개 도메인 스킬 파일
  - `supabase/migrations/` 내 001, 002, 003 마이그레이션 SQL
  - bkit 바이브코딩 프레임워크 초기화 및 Git 연동

### 2. Do (실행)
- [x] 4대 도메인 스킬 정의 완료:
  - `skills/uc-lms-domain/SKILL.md` (포털 및 LMS 도메인 가이드)
  - `skills/supabase-secure-data/SKILL.md` (000_ 순번 마이그레이션 및 pgcrypto 암호화)
  - `skills/instructor-management/SKILL.md` (강사 풀 심사 및 강사료 산출)
  - `skills/certificate-portfolio/SKILL.md` (QR 수료증 및 평생학습 포트폴리오)
- [x] 1차 데이터베이스 마이그레이션 파일 작성 완료 (생략 없는 100% 완전 코드 + 상세 한글 주석):
  - `001_create_enums_and_extensions.sql` (pgcrypto 활성화, 4대 역할/과정/수강상태/강사등급 ENUM)
  - `002_create_users_and_profiles.sql` (회원 프로필, 주민번호 AES-256 암호화/복호화 함수, 안전 뷰, RLS)
  - `003_create_courses_and_instructors.sql` (강사 풀, 강좌 테이블, 강좌-강사 매칭, RLS)
- [x] bkit 환경 설치 및 초기화:
  - Git 저장소 초기화 (`main` 브랜치)
  - `bkit.json`, `.gitignore`, `DEV_LOG.md`, `MILESTONE_LOG.md` 생성

### 3. Check (검증)
- [x] 규칙 1 준수: 모든 주석 및 설명 한국어 작성 완료
- [x] 규칙 2, 6 준수: 사용자 사전 동의 및 단계별 진행
- [x] 규칙 4, 5 준수: 교육자 친화적 설명 및 코드 생략 0% 달성
- [x] 규칙 7 준수: `supabase/migrations/` 경로 및 `000_` 접두사 3자리 순번 부여 완료
- [x] 규칙 8 준수: `pgcrypto` AES-256 양방향 대칭키 암호화 함수 및 RLS 보안 격리 정책 포함 완료

### 4. Act (개선 및 다음 단계)
- 다음 PDCA 사이클: **[Phase 2: 수강신청, LMS 출결/과제, 위·변조 방지 수료증 마이그레이션(004~006)]**
