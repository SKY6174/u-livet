# 구성원 관리 설계

2026-09-21 · anchor-member-management

## 화면
- `/admin/accounts` 유지, 제목과 업무 메뉴명을 구성원 관리로 변경한다.
- 사업단/강사/수강생 링크 버튼, 분류별 전체 수, 이름·이메일 검색, 20명 단위 페이지 이동.
- 요청된 분류별 열을 가진 semantic table, 좁은 화면에서는 표 영역 내부 가로 스크롤. 순번은 검색 결과와 페이지 기준이다.
- 이름/직책/강사 구분/분류별 전화/생년월일/비고는 상세 수정 화면에서 저장한다. 로그인 이메일은 기본 조회 전용이며 관리자 변경 여부는 사용자에게 별도 질의했다.
- 강사의 연락처는 수강생 Q&A 응대용으로 별도 저장한다. 공개 사이트에 자동 노출하지 않는다.
- 강의/수강이력 버튼은 선택된 회원의 실제 과정·기간·상태를 페이지 단위로 조회한다. 역할이 겹치면 해당되는 분류마다 표시하며 신청 이력이 있는 사업단/강사도 수강생 분류에 포함한다.
- 삭제 확인 화면에 계정 비활성화와 이력 보존을 명시한다. 자신의 계정 삭제를 거부한다.

## 데이터와 권한
- `life_private.member_profiles`: person_id PK/FK, office_phone, mobile_phone, instructor_phone, birth_date, notes, revision, updated_at/by. private schema, RLS 활성, direct grants 없음.
- 이름은 life_people, 로그인 이메일은 auth.users, 직책/교내외는 account_classifications, 강의이력은 offering_instructors, 수강이력은 applications/enrollments에서 조회한다.
- 기존 learner_contacts.phone을 초기 휴대전화로 읽고, 해당 연락처가 있는 회원의 수정 시 두 저장소를 같은 transaction에서 동기화한다. 기존 필수 가입 연락처의 공란 저장은 거부한다.
- public RPC는 security invoker, private 구현만 definer/search_path=''. authenticated 실행만 허용하고 모든 구현에서 검증된 person_id와 SYSTEM_ADMIN 조직을 확인한다.
- 역할/개인정보 동의/과정 신청/강사 배정/강사 이력의 소속 기관을 합쳐 범위를 결정한다. 연결된 모든 기관을 관리할 수 있는 회원만 조회·수정·삭제한다. 소속 없는 계정을 임의로 타 조직 관리자에게 노출하지 않는다.
- 수정/삭제는 최근 MFA, 대상 행 lock, revision 충돌 검사, 감사 로그를 요구한다. 이메일과 역할 부여는 이 RPC에서 변경할 수 없다. 교내 강사는 인증된 @uc.ac.kr 이메일 조건을 유지한다.
- 삭제는 life_people.active=false. 기존 person_id/auth_status 경계로 서비스 접근을 차단하며 auth/강의/수강/증명 기록을 물리 삭제하지 않는다.

## 성능
- 목록/전체 수/분류 수는 단일 RPC. 필수 열만 반환하고 서버에서 검색/정렬/limit/offset 처리한다.
- 이력은 별도 요청에 최대 20개씩 조회한다. 전체 회원마다 이력 RPC를 호출하지 않는다.
- active(name,id), instructor(person_id,offering_id), consent(person_id,policy_id) 등 기존 인덱스를 확인하고 필요한 누락 인덱스만 추가한다.
- UI에는 raw DB 오류·임의 통계를 노출하지 않는다. 빈 결과와 조회 실패를 구분한다.

## 검증/적용
- 실 DB transaction/rollback 합성 fixture: 익명·강사·타 기관 접근 거절, 관리자 분류 목록/검색/페이지, 조회/수정/이력/삭제, 자기삭제·revision·MFA·입력 거절, 삭제 후 이력 보존.
- TypeScript/ESLint/기존 역할·로그인 회귀/빌드. 브라우저에서 세 분류, 검색, 수정/삭제 화면, 모바일 넘침을 확인한다.
- 기존 연결 대상은 운영 uoebygejgglgiivzgyks, Preview bfqwntulxabfrimcypvx. 이전 상태를 읽고 정확히 새 migration만 적용한다. 실제 사용자 정보 수정·삭제 검증은 하지 않는다.

## 2026-09-23 최고관리자 명단 표시
- 검증된 `member_entry_operators`의 SUPER_ADMIN 계정은 지정된 소속 사업단의 읽기 명부에 포함한다. 다른 기관의 COURSE_MANAGER 역할이 있다는 이유로 사업단 명부에서 제외하지 않는다.
- 이름/직책/이메일은 기존 계정 자료를 조회하며 새 구성원이나 역할을 생성하지 않는다. 목록 성명 옆에 ‘최고 관리자’를 표시하고 집계·검색·페이지 처리에 같은 조회 범위를 적용한다.
- 예외는 `member_scope_for(false)`의 명부 조회에만 적용한다. `member_scope_for(true)`의 전체 소속 기관 관리 조건, 타 기관 일반 회원 비공개, 최고관리자/자기 삭제 방지, 최근 MFA 조건은 유지한다. 여러 기관에 걸친 대상은 권한이 충분하지 않으면 수정·삭제 버튼을 표시하지 않는다.
- 회귀: 지정 최고관리자에게 타 기관 운영 역할이 있어도 소속 사업단 명부에 1회 표시, 운영자도 조회 가능, 타 기관에서는 지정되지 않은 최고관리자를 조회할 수 없음, 편집 범위 비확대, 일반 복수 기관 회원 비노출, UI 배지·이름·직책과 집계 검증.

참고: [Supabase 함수 권한](https://supabase.com/docs/guides/database/functions), [사용자 데이터 관리](https://supabase.com/docs/guides/auth/managing-user-data).
