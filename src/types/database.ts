// ==============================================================================
// 울산과학대학교 앵커사업단 평생직업교육 플랫폼 - 통합 데이터베이스 TypeScript 타입 정의
// ==============================================================================
// 파일 경로: src/types/database.ts
// 설명:
//   supabase/migrations/ (001~006)에 정의된 모든 테이블, ENUM 및 관계를
//   프론트엔드와 서버에서 안전하게 타입 검사하며 개발할 수 있도록 제공합니다.
// ==============================================================================

// 1. 공통 열거형 (ENUM) 타입 정의
export type UserRole = 'LEARNER' | 'INSTRUCTOR' | 'OPERATOR' | 'ADMIN';
export type CourseType = 'OFFLINE' | 'ONLINE' | 'BLENDED';
export type EnrollmentStatus = 
  | 'APPLIED' 
  | 'WAITING' 
  | 'APPROVED' 
  | 'REJECTED' 
  | 'CANCELLED' 
  | 'COMPLETED' 
  | 'INCOMPLETE';
export type InstructorTier = 'TIER_A' | 'TIER_B' | 'TIER_C';
export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';

// 2. 사용자 회원 프로필 인터페이스 (user_profiles)
export interface UserProfile {
  id: string;                      // Supabase auth.users UUID
  email: string;
  name: string;
  phone?: string | null;
  role: UserRole;
  organization?: string | null;    // 소속 기업체명/기관명
  birth_date?: string | null;      // YYYY-MM-DD
  gender?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 3. 산업체 전문가 강사 풀 인터페이스 (instructor_profiles)
export interface InstructorProfile {
  id: string;                      // user_profiles(id) 참조
  tier: InstructorTier;            // TIER_A(명장/특급), TIER_B(고급), TIER_C(실무자)
  hourly_rate: number;             // 시간당 강사료 단가 (원)
  specialty: string;               // 전문 분야 (예: 스마트조선 선체조립)
  education?: string | null;       // 최종 학력
  career_summary?: string | null;  // 경력 요약
  bank_name?: string | null;
  is_approved: boolean;            // 사업단 승인 여부
  approval_date?: string | null;
  created_at: string;
  updated_at: string;
  user?: UserProfile;              // 조인 시 함께 조회되는 사용자 정보
}

// 4. 교육과정(강좌) 인터페이스 (courses)
export interface Course {
  id: string;
  title: string;                   // 강좌명
  category: string;                // 울산 특화산업 카테고리 (조선·해양, 친환경모빌리티, 이차전지 등)
  course_type: CourseType;         // 대면/원격/블렌디드
  description?: string | null;
  target_audience?: string | null; // 주요 대상 (재직자/구직자 등)
  capacity: number;                // 정원 (명)
  tuition_fee: number;             // 수강료 (0원인 경우 전액 무료)
  apply_start_at: string;          // 접수 시작일시
  apply_end_at: string;            // 접수 마감일시
  course_start_at: string;         // 개강일시
  course_end_at: string;           // 종강일시
  total_hours: number;             // 총 교육 시간 (시수)
  location?: string | null;        // 강의실 위치
  min_attendance_rate: number;     // 수료 최소 출석률 (예: 80.00)
  min_pass_score: number;          // 수료 최소 시험/과제 점수 (예: 60.00)
  require_survey: boolean;         // 만족도 설문 필수 여부
  is_published: boolean;           // 포털 노출 여부
  created_at: string;
  updated_at: string;
}

// 5. 강좌-강사 매핑 인터페이스 (course_instructors)
export interface CourseInstructor {
  id: string;
  course_id: string;
  instructor_id: string;
  role_in_course: string;          // 주강사, 보조강사 등
  assigned_hours: number;          // 배정된 강의 시수
  created_at: string;
  updated_at: string;
  instructor?: InstructorProfile;
}

// 6. 수강신청 및 선발 대장 인터페이스 (course_enrollments)
export interface CourseEnrollment {
  id: string;
  course_id: string;
  user_id: string;
  status: EnrollmentStatus;
  motivation?: string | null;      // 지원동기
  organization_name?: string | null;
  attachment_url?: string | null;  // 재직증명서 등 증빙파일
  waiting_number?: number | null;  // 대기 순번
  rejection_reason?: string | null;// 반려 사유
  is_completed: boolean;           // 최종 수료 여부
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  course?: Course;
  user?: UserProfile;
}

// 7. 결제 및 국비 지원금 인터페이스 (payments)
export interface Payment {
  id: string;
  enrollment_id: string;
  amount: number;                  // 결제금액 (무료는 0)
  payment_method: string;          // GOV_SUBSIDY, VOUCHER, CREDIT_CARD 등
  status: string;                  // COMPLETED, REFUNDED 등
  transaction_id?: string | null;
  receipt_url?: string | null;
  paid_at?: string;
  created_at: string;
}

// 8. 차시별 강의실 인터페이스 (lms_lectures)
export interface LmsLecture {
  id: string;
  course_id: string;
  lecture_order: number;           // 1강, 2강 등 차시 번호
  title: string;
  content?: string | null;
  lecture_date: string;            // YYYY-MM-DD
  start_time: string;              // HH:MM:SS
  end_time: string;                // HH:MM:SS
  is_online: boolean;              // 이러닝 원격 여부
  video_url?: string | null;
  required_watch_seconds: number;  // 최소 인정 시청시간 (초)
  material_file_url?: string | null;
  created_at: string;
  updated_at: string;
}

// 9. 하이브리드 출결 기록 인터페이스 (lms_attendance)
export interface LmsAttendance {
  id: string;
  lecture_id: string;
  enrollment_id: string;
  status: AttendanceStatus;
  check_in_at?: string | null;     // QR 체크인 입실 시각
  check_out_at?: string | null;
  watched_seconds: number;         // 온라인 누적 시청 초
  is_qr_verified: boolean;
  note?: string | null;
  created_at: string;
  updated_at: string;
}

// 10. 과제 및 제출 인터페이스 (lms_assignments, lms_submissions)
export interface LmsAssignment {
  id: string;
  course_id: string;
  title: string;
  description?: string | null;
  due_at: string;
  max_score: number;
  created_at: string;
  updated_at: string;
}

export interface LmsSubmission {
  id: string;
  assignment_id: string;
  enrollment_id: string;
  content?: string | null;
  submission_file_url?: string | null;
  score?: number | null;
  feedback?: string | null;
  graded_at?: string | null;
  created_at: string;
  updated_at: string;
}

// 11. 강의 만족도 설문 인터페이스 (course_evaluations)
export interface CourseEvaluation {
  id: string;
  enrollment_id: string;
  course_id: string;
  curriculum_satisfaction: number; // 1~5
  instructor_satisfaction: number;
  facility_satisfaction: number;
  overall_satisfaction: number;
  opinion?: string | null;
  is_submitted: boolean;
  created_at: string;
}

// 12. 위·변조 방지 전자 수료증 인터페이스 (certificates)
export interface Certificate {
  id: string;
  certificate_no: string;          // 예: UC-ANCHOR-2026-00001
  enrollment_id: string;
  course_title: string;
  learner_name: string;
  total_hours: number;
  attendance_rate: number;
  final_score: number;
  verification_hash: string;       // SHA-256 검증 해시
  pdf_url?: string | null;
  is_revoked: boolean;
  issued_at: string;
}

// 13. 감사 로그 인터페이스 (audit_logs)
export interface AuditLog {
  id: string;
  user_id?: string | null;
  action: string;
  target_table?: string | null;
  target_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  details?: Record<string, unknown> | null;
  created_at: string;
}

// ==============================================================================
// 14. 역할별 전용 고속 최적화 뷰 인터페이스 (010 마이그레이션 연계)
// ==============================================================================

/**
 * 수강생(학습자) 전용 마이포털 원스톱 집계 뷰 (v_learner_my_portal)
 * - 수강 강좌, 실시간 출결률, 수료증 및 디지털 배지, 장학금 정산 상태를 단일 쿼리로 제공
 */
export interface VLearnerMyPortal {
  enrollment_id: string;
  user_id: string;
  course_id: string;
  course_title: string;
  course_category: string;
  total_hours: number;
  enrollment_status: EnrollmentStatus;
  enrolled_at: string;
  attended_lectures: number;
  total_lectures: number;
  real_time_attendance_rate: number;
  certificate_no?: string | null;
  cert_hash?: string | null;
  cert_issued_at?: string | null;
  badge_code?: string | null;
  badge_name?: string | null;
  scholarship_name?: string | null;
  scholarship_amount?: number | null;
  scholarship_status?: string | null;
}

/**
 * 강사(산업체 전문가/교원) 전용 강의실 배정 및 학급 관리 뷰 (v_instructor_class_status)
 * - 담당 강좌 진행 상태, 배정 강의실(캠퍼스/호수), 정원 대비 수강생 수, 과제 미채점 건수 제공
 */
export interface VInstructorClassStatus {
  instructor_id: string;
  course_id: string;
  course_title: string;
  course_category: string;
  is_published: boolean;
  course_progress_status: 'UPCOMING' | 'RECRUITING' | 'IN_PROGRESS' | 'COMPLETED' | 'OPEN';
  capacity: number;
  current_enrolled_students: number;
  campus_type?: 'EAST' | 'WEST' | null;
  building_name?: string | null;
  room_number?: string | null;
  classroom_name?: string | null;
  pending_evaluation_count: number;
}

/**
 * 사업단(관리자/운영자) 전용 실시간 KPI 종합 현황 뷰 (v_admin_kpi_overview)
 * - 활성 강좌수, 승인 수강생수, 수료증/배지 발행 누계, 강사 심사 대기건, 장학금 총 지급액 등 요약
 */
export interface VAdminKpiOverview {
  total_active_courses: number;
  total_enrolled_learners: number;
  total_issued_certificates: number;
  total_issued_badges: number;
  pending_instructor_applicants: number;
  total_scholarship_disbursed_krw: number | string;
  total_classrooms_equipped: number;
}

