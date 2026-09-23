# 구성원 관리 검증

2026-09-21 · anchor-member-management · 설계 요구사항 12/12 반영

## 구현
- 세 분류 버튼/분류별 수/요청된 컬럼/순번/이메일 표시
- 서버 검색·20행 페이지·페이지 범위 보정
- 직책/교내외/성명/사무실·핸드폰·문의 연락처/생년월일/비고 수정
- 강의·수강 이력의 실제 offering/application/enrollment 조회, 별도 페이지 처리
- 삭제 확인·서비스 비활성화·기존 이력 보존
- 자신의 계정 삭제 거절
- SYSTEM_ADMIN 및 관련된 모든 기관에 대한 권한 검사
- 최근 MFA 및 변경 revision 충돌 검사
- private table RLS, direct grant 차단, public invoker RPC
- 연락처 및 기존 이름 데이터의 transaction 동기화, 감사 로그
- 필요한 페이지의 상세 필드만 join, 가입동의/강의/신청 인덱스 추가
- 공통 업무 메뉴명 구성원 관리로 변경

로그인 이메일은 조회 전용이다. 관리자 이메일 변경은 사용자에게 질의했으며 답변이 없어 기본안을 적용했다. 실제 사용자 정보를 수정하거나 삭제하지 않았다.

## 검증
- 구성원 입력·서버 액션·화면 검증: 23개 통과
- 실제 PostgreSQL 검증: 37개 통과. Preview와 같은 32개 migration을 독립 로컬 DB에 구성하고 네이티브 auth.sessions/MFA 자료 및 합성 회원 32명으로 확인. transaction rollback 후 합성 회원 0명.
- SQL 검증은 잘못된 DB에서 실행되지 않도록 DB명 guard를 포함한다.
- 기존 역할별 메뉴 검증 18개, 로그인 대상 검증 46개 통과
- TypeScript, ESLint, Next.js production build, diff whitespace 검사 통과
- 1440px: 세 분류와 요청 컬럼, 문의 연락처, 수정·삭제·이력 진입 확인
- 390px: 페이지 자체 넘침 없음, 긴 표는 해당 영역 내부에서 가로 스크롤, 수정 폼 단일 열
- 브라우저의 삭제 확인 필수 체크와 성공 메시지 확인. 브라우저 UI는 실제 컴포넌트와 합성 데이터/액션 fixture로 검증했으며 운영 계정의 쓰기 E2E 테스트는 수행하지 않았다.
- SQL 목록 warm EXPLAIN: 32명 합성 데이터에서 실행 9.191ms, shared hit 250. 운영 대량 부하 시험 결과가 아니다.

## 원격 DB

Migration `20260921034041_anchor_member_management`를 Preview `bfqwntulxabfrimcypvx`에 먼저 적용·검증한 뒤 운영 `uoebygejgglgiivzgyks`에 적용했다.

두 DB 모두 적용 전후 Auth 4 / 회원 4 / 활성 4 / 권한 3 / 신청 0 / 수강 0으로 동일했다. 신규 상세정보 0행이며 기존 개인정보를 임의로 채우지 않았다. 새 RPC는 authenticated만 실행 가능, 익명 HTTP 401/42501, 상세 테이블 직접 조회 불가, RLS 활성, public 함수는 invoker다.

보안 Advisor WARN/ERROR 없음. 성능 Advisor의 267개 WARN은 기존 비사용 legacy 테이블에만 해당하며 이번 구성원 객체 관련 경고는 없다. 전역 legacy 정책 정비는 이번 구성원 관리 변경에 포함하지 않았다. [RLS 호출 최적화 안내](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan).

## 증거

Git 제외 `tmp/member-management/`에 SQL 로그, EXPLAIN, 원격 적용 전후 계수·권한 결과, Advisor 결과, 데스크톱/모바일 화면을 보관했다.


## 2026-09-23 최고관리자 명단 표시 검증

최고관리자가 소속 사업단 외 기관의 COURSE_MANAGER 역할을 함께 보유하면 모든 소속 기관 관리 조건 때문에 자신의 사업단 명부에서도 누락됐다. 신뢰된 SUPER_ADMIN 지정 기관에 한해 읽기 범위에 포함하며 쓰기 범위는 기존 조건을 유지한다. 회원/계정/역할을 새로 생성하지 않는다.

설계 대비 확인:
- 지정 사업단 명단에 기존 최고관리자를 1회 포함하고 목록 수·검색에 같은 범위를 사용한다.
- 이름/단장 직책은 기존 자료를 사용하고 최고 관리자 배지는 private 지정 정보로 판별한다.
- 수정·삭제 범위 비확대, 타 기관 및 일반 복수 기관 회원 비공개, 비활성 회원 제외를 유지한다.
- 수동 등록 인증 상태 및 기존 구성원 관리 동작을 보존한다.

수정 전 독립 PostgreSQL DB에서 최고관리자 누락을 재현했다. 새 migration 적용 후 동일 fixture 및 회귀 49개, 구성원 화면·액션 24개, 수동 등록 23개(총 96개), ESLint, 타입 검사와 production build가 통과했다. 테스트 DB는 전용 `life_chief_roster_test_20260923`이며 합성 fixture를 transaction rollback했다. 설계 비교에서 미구현 항목은 없다.

정확한 migration `20260923090443_anchor_chief_member_roster`와 이력을 한 transaction으로 Preview 다음 운영 DB에 적용했다. Preview Auth 4 / 회원 14 / 역할 13 / claim 0을 유지했다. 운영 Auth 7 / 역할 15 / claim 0을 유지했으며 회원 수는 확인 사이 22→24로 증가했다. 이 migration은 함수 정의와 migration 이력만 변경하므로 회원 추가를 수행하지 않는다. 운영의 기존 최고관리자는 단장, 활성 상태, 계정 연결 1개로 확인했다.

운영 브라우저는 로그아웃 상태로 관리자 화면 요청 시 로그인으로 이동했다. 인증된 운영 화면의 시각 검증은 수행하지 못했으며, 렌더링 회귀에서 이름·단장·최고 관리자 배지와 권한 없는 수정/삭제 버튼 미노출을 확인했다.


## 2026-09-23 도구 모음·완료 알림 검증

수동 등록 버튼을 분류 탭 행 우측으로 옮기고 등록·수정·삭제 결과 배너를 5초 말풍선 알림으로 변경했다. 알림은 다음 링크/버튼/입력/제출, Escape, 닫기 또는 이력 이동 시 제거되며 이벤트와 타이머는 닫힐 때 해제한다. 성공 query만 소비해 분류·검색·fragment와 Next 이력 상태를 보존한다. 오류 안내와 서버 권한 검사는 변경하지 않았다.

설계 대비 브라우저 검증은 실제 페이지를 합성 자료로 렌더링한 임시 로컬 화면 및 실제 MemberNotice 컴포넌트에서 진행했다. 데스크톱에서 분류 탭과 버튼의 세로 중심·행 우측 끝이 일치했다. 390px에서는 겹침 없이 오른쪽 다음 행에 배치되고 document scrollWidth=390이었다. 등록/저장/삭제 말풍선, 자동 닫힘, 검색 입력 직후 닫힘, 닫기 버튼, Escape, 새로고침·뒤로가기 시 재표시 없음과 검색 조건·fragment 보존을 확인했다. 브라우저 오류 로그는 없었다. 임시 화면과 서버는 검증 후 제거했으며 실제 구성원 쓰기 작업은 하지 않았다.

기존 구성원 관리 24개·수동 등록 23개(총 47개) 회귀와 ESLint 통과. 알림만 Client Component로 분리하여 목록 조회·권한은 서버에 유지했고, 설계 비교에서 미구현 항목은 없었다.

최종 TypeScript 검사 및 Next.js production build 통과.


## 2026-09-23 직책 정렬·최고관리자 수정 검증

사업단 조회는 직책 7단계→미등록, 한국어 ICU 성명→ID 순으로 정렬하며 페이지 분할과 JSON 집계에 동일 순서를 적용한다. 최고관리자 본인이 지정 기관 SYSTEM_ADMIN인 경우의 사업단 정보 수정만 private 함수로 허용하고 기존 관리/삭제 범위는 그대로 둔다. can_edit를 목록·상세에서 사용하여 최고관리자 수정 진입을 허용하며 최고관리자 및 자신의 삭제 링크는 감춘다.

- 수정 전 최고관리자 can_edit가 없는 상태의 실패를 독립 DB에서 재현했다.
- SQL 69개 통과: 실제 수정 후 이름·전화·직책·비고·revision 재조회, 프로필 이름 연동, 감사 기록, 역할 비추가, MFA·revision·타 계정·타 기관 차단, 최고관리자 삭제 보호, 27명 자료의 20명 페이지 경계/동직책 가나다순/미등록 후순위/검색 검증.
- JS 49개 통과: 기존 회귀와 최고관리자 수정 링크/수정 폼 진입, 삭제 링크 미노출 및 삭제 주소 직접 접근 거절, 편집 불가 대상 직접 접근 거절. 총 118개 통과.
- ESLint, TypeScript, production build, whitespace 검사 통과. 실제 회원 정보 변경은 수행하지 않았다. 인증된 운영 화면의 저장 동작은 합성 DB 및 실제 서버 컴포넌트 검증으로 대신했다.
- 독립 DB Security Advisor WARN/ERROR 없음. 새 판별 함수는 private/search_path 고정이며 PUBLIC·anon·authenticated·service_role 직접 실행 권한을 회수했다.
- migration `20260923092459_anchor_member_rank_chief_edit`와 이력을 Preview→운영에 원자적으로 적용했다. Preview Auth 4 / 회원 14 / 역할 13, 운영 Auth 7 / 회원 29 / 역할 15를 유지했다. 두 DB의 한국어 collation 및 private 함수 직접 접근 차단을 확인했다. 운영 사업단 자료 읽기 조회에서도 직책 순서와 동일 직책 가나다순을 확인했다.

설계 대비 구현 차이는 없다. 직책순 처리는 페이지 분할 전에 수행하고 수정 예외를 삭제 또는 다른 회원에 확장하지 않는다.
