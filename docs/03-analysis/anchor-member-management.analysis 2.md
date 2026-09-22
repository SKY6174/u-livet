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
