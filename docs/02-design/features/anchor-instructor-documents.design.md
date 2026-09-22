# 강사 서류 제출 설계

## 원본 및 화면
- 원본: uc-anchor `ExpertDocumentAdminPortal`, `advisory-external-submission`, `committee-vote`의 expert document 분기.
- 사업단 관리의 독립 메뉴 `전문가 관리`(`/admin/instructors`)에서 이력 심사와 서류 제출 현황으로 이동한다. COURSE_MANAGER에게만 노출하며, 강사·수강생에게는 관리 메뉴를 제공하지 않는다. 강사의 본인 서류 제출은 My Room에 둔다.
- `/admin/instructors/documents`: 기관별 강사 서류 제출 현황. 관리권한 RPC로 이름/제출 여부만 반환(이름순 최대 200명); 민감정보/파일경로는 제외한다.
- `/mypage/instructor/documents`: 본인 서류. `/admin/instructors/documents?person=UUID&org=UUID`: 담당 기관 강사 서류.
- uc-life 로그인으로 전용 30분 세션 발급. 토큰은 메모리에만 보관한다. 만료/인증 해제 시 화면과 민감 입력을 제거한다.
- 원본 React 제출/분리/미리보기/PDF 코드를 재사용하고 Next.js 클라이언트 전용 로딩, PDF worker와 지역 CSS를 적용한다.

## Supabase
- `life_instructor_private_profiles`, `life_instructor_private_profile_drafts`: person_id FK, encrypted_resume, resume_iv, resume_version, 완료/수정 시각.
- `life_instructor_private_documents`: ID_COPY/BANK_COPY, private object_path, SHA-256, 크기/MIME, 암호화 추출값과 일치 상태.
- `life_instructor_generated_documents`: IDENTITY_BANK_PDF/RESUME_PDF.
- `life_instructor_document_sessions`: token_hash, actor_user_id, person_id, org_id, expires_at, revoked_at.
- 모든 저장 테이블 RLS 활성화. anon/authenticated 직접 접근 회수. 서비스 역할은 Edge Function 내부에서만 사용한다.
- 비공개 `instructor-private-documents` 버킷. 원본 1 MiB 최적화 이미지, 생성 PDF 최대 10 MiB. signed URL 300초. 기존 파일은 메타데이터 성공 후 참조 검사하여 정리한다.
- `life_instructor_document_access` RPC는 현재 계정/MFA/기관 역할을 확인한다. 본인은 강사 또는 해당 기관 이력서 소유자, 타인은 COURSE_MANAGER 권한과 대상의 해당 기관 소속을 모두 확인한다.
- `instructor-documents` Edge Function은 세션 발급 및 매 요청 때 JWT와 RPC를 재검증한다. 임의 대상 ID나 이름 매칭으로 권한을 주지 않는다.

## 암호화와 AI
- 원본과 동일한 AES-256-GCM, 무작위 12바이트 IV. 별도의 `ADVISORY_PII_KEY`를 uc-life Edge secret으로 설정한다.
- 사용자 요청에 따라 이력서 읽기·그림 영역 인식·신분증/통장 정보 추출의 기본 모델을 OpenAI `gpt-5.6`(Sol)로 통일한다. OpenAI 실패 시 기존 Gemini 대체 분석을 유지한다. 키는 서버 secrets에만 둔다. 원문/토큰/AI 응답을 로그에 남기지 않는다.
- 이름/문서타입/MIME/매직바이트/파일크기 검증. AI 출력은 원본 검증기로 검증하고 사용자 검토 후 저장한다.
- 별도 초안 테이블은 제출 완료 집계에서 제외한다. PDF 생성 실패는 이미 저장된 원본을 삭제하지 않는다.

## 검증과 배포
- SQL는 CLI 생성 migration에 기록하고 지정된 uc-life 프로젝트에 적용한다.
- 실제 개인정보 대신 가상자료로 권한/RLS/암호화/저장/복원/기간 만료를 검증한다.
- 체크 성공 후 변경 파일만 커밋/push. 비밀값과 기존 미추적 복제 파일은 제외한다.
