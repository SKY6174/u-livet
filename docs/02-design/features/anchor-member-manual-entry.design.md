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

## 2026-09-23 직책 확장과 인증 계정 연결
- 직책은 단장(DIRECTOR), 본부장(DIVISION_HEAD), 센터장(CENTER_HEAD), 운영팀장(OPERATIONS_HEAD), 책임연구원(PRINCIPAL_RESEARCHER), 선임연구원(SENIOR_RESEARCHER), 연구원(RESEARCHER) 순서로 표시한다. 생성/수정/이전 클라이언트 RPC/DB 제약에서 같은 값을 검증한다.
- 수동 등록의 기존 원자적 DB 저장, 지정 운영자·최근 MFA·조직 범위·중복 요청 검사를 유지한다. 자동 계정 연결 대상은 사업단과 교내 강사만이며 교내 강사의 등록 이메일은 @uc.ac.kr이어야 한다.
- 로그인 화면의 ‘등록된 구성원 계정 활성화’에서 등록 이메일, 본인이 정한 비밀번호, 연락처, 개인정보 동의로 기존 이메일 가입 절차를 시작한다. 관리자가 비밀번호나 이메일 인증 완료 상태를 대신 생성하지 않는다.
- 네이티브 이메일 가입 시 활성 수동 명부와 이메일이 일치하면 새 person을 만들지 않고 private pending claim에 동의 정책/연락처를 보관한다. email_confirmed_at이 확인된 후에만 기존 person_id에 auth 링크·동의·연락처를 원자적으로 연결한다. 이름·직책·강의 배정 등 기존 관리 자료를 보존한다. 소셜 로그인, 교외 강사, 수강생은 자동 연결 대상에서 제외한다.
- 실제 auth.users 이메일·이메일 인증 시각·삭제/차단 상태와 private 명부를 신뢰한다. 사용자 메타데이터의 역할/직책/회원 ID를 연결 근거로 사용하지 않는다. 이메일 변경·비활성 명부·이미 연결된 계정/회원은 연결을 거부한다. 확인 전 링크와 업무 역할은 생성하지 않는다.
- 교내 강사는 인증 후 해당 조직의 INSTRUCTOR 역할로 연결한다. 사업단은 검증된 manual member_group으로 사업단 로그인·표시·MFA를 적용하되 직책만으로 COURSE_MANAGER/SYSTEM_ADMIN 등 업무 권한을 부여하지 않는다. 기존 역할별 권한과 RLS를 유지한다.
- 인증 대기/인증 완료 상태를 구성원 목록에 표시한다. 기존 명부 전체에 대한 임의 계정 병합·메일 발송·인증 우회는 하지 않는다.
- 회귀: 7직책 저장, 서버/DB 잘못된 직책 거부, 미인증 연결 거부, 이메일 인증 후 동일 person 연결과 기존 정보 보존, 재인증 멱등성, 교외/수강생/소셜 제외, 삭제·이메일 불일치 차단, 교내 도메인 검사, 사업단 MFA와 권한 비승격. 격리 로컬 DB에서 실제 SQL로 검증 후 Preview/운영에 적용한다.
