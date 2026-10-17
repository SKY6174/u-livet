# DB 연결·관리 목록 최적화 검증

2026-10-17 · db-response-audit · 설계 구현 8/8 확인

## 구현·보안 대조

1. private 읽기 함수 2개만 수정했다. public RPC·상세 검사·서명·JSON 계약·기존 권한 헬퍼를 유지했다.
2. managed_orgs를 MATERIALIZED 처리하고 scalar subquery로 person_id를 조회당 한 번 평가한다. 활성 COURSE_MANAGER 역할과 유효기간 조건은 has_role과 같다.
3. 관리 가능한 운영 과정 범위를 물질화하고 원서/신청/과정 목록에 조인했다. 연결 원서는 과정의 기관, 미연결 원서는 원서의 기관을 기준으로 한다.
4. 기존 검증용 과정 제외, 미연결 원서 전체 이력, received/rejected 우선순위, PDF-only 및 신청 원서 중복 제거를 유지했다.
5. inactive 사람·취소 신청도 기존대로 읽는다. 정렬·검색·상태·페이지 처리 코드는 수정하지 않았다.
6. 로컬 관리자, 다른 기관, 중복·복수 기관 역할, 만료·미래 역할, SYSTEM_ADMIN 단독, MFA 부족·잘못된 세션·로그아웃에서 helper 다중집합과 두 RPC의 결과/오류가 이전과 같다(각 10개 필터).
7. 직접 private helper 권한을 열지 않았고, anon public RPC 접근도 계속 차단했다. 사람/신청/등록/과정/PDF 원본 해시가 같다. 모든 fixture와 DDL은 ROLLBACK 했다.
8. 공개 성능·workspace 회귀 로더의 누락 TS/TSX import를 보완하여 기존 assertion을 실제로 실행했다. 10 DB response + 8 workspace + 16 public performance 회귀와 lint·전체 Next 프로덕션 빌드가 통과했다.

## 측정

운영 DB 연결 18/60, 잠금 대기·장기 트랜잭션·무효 인덱스 0. 공개 /api/health, /, /courses, /auth/login 각 5회 모두 정상이며 첫 요청 제외 중앙값은 171.5/159.5/259.5/123.5ms였다. 운영 목록 최초 관측 SQL 시간은 신청 333.37ms, 수강생 562.96ms(각 1회)였고 누적 통계와 구분했다.

로컬 49개 기존 과정에 2개 fixture 과정과 신청 45건·PDF 이력을 더했다. 기존 함수 정의가 현재 운영의 두 함수 해시와 일치함을 별도 확인했다. 같은 트랜잭션·claims에서 교차 순서 8쌍, 첫 쌍을 뺀 7쌍 중앙값: 신청 **628.97→14.82ms**, 수강생 **743.74→18.48ms**. 이 수치는 DB 실행시간이며 운영 브라우저 전체 지연의 개선율이 아니다. 절대 시간은 CI 통과 조건에 넣지 않았다.

재현: `node scripts/verify-management-read-scope.mjs` (전용 supabase_db_uc-life-issues만 사용, 전체 ROLLBACK).

## 배포 검증

Preview의 전체 마이그레이션 및 운영 적용 전후 원본 86종, 기타 함수 정의 627개, 함수 ACL 629개, 관계 권한/RLS 184개, 정책 88개를 대조한다. 정확한 새 migration만 드리프트 가드와 함께 적용하고 PR 검사·운영 revision/health 및 로그인 목록을 확인한다. 최종 결과는 PR 본문에 기록한다.

Preview의 별도 Seoul DB에서 전체 **135개 마이그레이션**, FUNCTIONS_DEPLOYED와 최종 두 함수 해시 일치를 확인했다. 무효 인덱스·잠금 대기 0. 보호된 Vercel Preview는 인증 CLI로 API version HTTP 200과 소스 revision 일치를 확인했다. Preview 앱은 기존 정책대로 reviewOnly이며 DB 검증은 별도 프로젝트에 직접 수행했다. 운영 로그인 목록 각 3회 추가 표본의 변경 전 DB 실행 평균은 신청 360.12ms·수강생 363.18ms다.
