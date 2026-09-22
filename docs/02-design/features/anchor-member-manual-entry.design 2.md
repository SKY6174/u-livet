# 구성원 수동 등록 설계
2026-09-21 · anchor-member-manual-entry

## 권한
- private.member_entry_operators: 조직별 세 개 슬롯(SUPER_ADMIN/OPERATIONS/RESEARCH), 지정 성명, 확인된 auth_user_id. 검증된 kysong@uc.ac.kr 계정은 즉시 연결한다. 사용자가 확인한 이연향 이메일 yhlee4@uc.ac.kr은 이메일 소유권 인증 후 auth.users trigger로 한 번만 계정 ID에 연결한다. 현용환 슬롯은 이메일 확인 전까지 비활성 예약한다.
- 권한은 실제 연결된 인증 계정으로 판단한다. 이름/클라이언트 입력/프로필 메타데이터로 권한을 판정하지 않는다. 최고 관리자 여부와 수동 등록 가능 여부를 life_identity에서 반환한다. 지정 운영자는 사업단 로그인과 MFA를 적용하고 사업단 명부에 포함한다.
- 수동 등록은 최근 MFA 및 활성 인증 계정 필수. 새로운 권한은 명부 조회/등록에 한정하며 기존 수정·삭제의 SYSTEM_ADMIN 권한 경계를 유지한다. 기존 관리자도 지정 운영자가 아니면 등록할 수 없다.
- 공개 RPC invoker/private definer와 빈 search_path, RLS 활성/direct grants 없음. 감사 로그, 조직 범위 검증, 최고 관리자 타인 삭제 금지.

## 수동 등록
- /admin/accounts/new?group=... 세 분류 입력. 선택한 조직, 성명, 이메일, 직책/교내외, 분류별 전화, 생년월일, 비고. 등록 버튼 저장 성공 후 목록 표시.
- private.manual_members(person_id PK,org_id,member_group,email,request_id UNIQUE,request_fingerprint,created_by,created_at). 실제 auth 계정을 만들거나 메일을 발송하지 않는다. 명부 등록으로 로그인/업무 권한이 부여되지 않는다.
- life_people, manual_members, member_profiles, account_classifications, audit를 한 transaction에 저장. 정규화 이메일 중복 거부, 동일 요청 재시도는 기존 id 반환. 미인증 수동 강사의 교내 구분은 명부 분류이며 학교 계정 인증을 대신하지 않는다.
- 기존 목록/검색/이력/수정/삭제에 수동 명부를 포함하고 가입 계정과 구분한다. 수동 명부 소속을 scope에 포함, 모든 소속을 관리 가능한 경우만 표시. 기존 인증 계정의 이메일은 그대로 조회 전용.

## 올해 수강과목
- DB Asia/Seoul 현재 연도. 해당 연도와 운영 기간이 겹치는 ACTIVE enrollment 과목만 반환(철회/신청 대기/미선발 제외). 과거 수강이력은 기존 전체 연도 조회 그대로 유지.
- 현재 페이지 최대 20명의 과목만 batch 조회; 목록 RPC 한 번으로 반환. 배열 이름 목록과 연도 안내 표시.

## 검증
- 로컬 격리 DB rollback 테스트: 권한 allowlist/동명이인/다른 관리자/타 조직/MFA, 세 분류 등록/DB 재조회/중복 요청/이메일 중복/잘못된 입력, 수동 수정·삭제, 올해/작년/미래/철회 과목 및 전체 이력.
- UI/action 테스트, 기존 124개 회귀, lint/type/build, 데스크톱/모바일 브라우저 확인. Preview 먼저 적용 후 운영, 사용자/역할/수강 이력 수 변화 없음 확인.
