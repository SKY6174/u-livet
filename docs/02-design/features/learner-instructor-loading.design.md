# 수강생·강사 로딩 최적화 설계

2026-10-17 · [계획](../../01-plan/features/learner-instructor-loading.plan.md)

## DB 읽기

private instructor_home_summary의 actor MATERIALIZED CTE에서 person_id를 1회 계산한다. instructor_orgs MATERIALIZED CTE는 해당 actor의 INSTRUCTOR 역할 중 valid_from<=now(), valid_until IS NULL OR >now()인 기관을 DISTINCT로 가져온다. 기존 offering_instructors의 person·배정 만료 조건과 operational_offerings를 유지하고, 행마다 has_role를 실행하는 대신 허용 기관과 조인한다. 기존 함수가 instructor_eligible을 요구하지 않으므로 자격 조건을 추가하거나 제거하지 않는다. JSON이 아닌 기존 5개 TABLE 열, count 하위 쿼리·정렬을 유지한다.

completion_history의 e.person_id=person_id()를 e.person_id=(select person_id())로 바꿔 행과 무관한 신원 조회를 1회 InitPlan으로 만든다. 운영 enrollment/offering/run/approval, 최신 run의 calculated_at/id 정렬, withdrawn·stale·승인 및 정책 유효성은 그대로 둔다. 두 함수의 서명·STABLE SECURITY DEFINER·빈 search_path·기존 ACL과 public wrapper를 유지한다. 인증 helper·RLS·원본·발급·성적 입력·판정 쓰기는 수정하지 않는다.

## SSR 읽기

두 강의실은 기존 신원·과정·수강 또는 담당 배정 확인을 완료한 뒤 질문을 5개 본문 조회와 같은 Promise.all에 넣는다. 본문 조회 실패 시 기존 오류 화면, 질문 조회 실패 시 기존 질문 영역의 별도 오류 표시를 유지한다. 권한 확인 전에는 질문/본문을 시작하지 않는다.

getAttendanceBook은 identity/UUID 확인 뒤 동일 사용자 client로 출석부와 QR를 병렬 조회한다. 두 RPC가 자체 과정·본인·담당 권한을 각각 확인한다. FORBIDDEN은 기존 notFound, 출석부 실패는 unavailable, QR 단독 실패는 정상 book+qr_unavailable이다. 선택적 boolean includeQr=true를 추가해 시험 화면 두 곳은 false를 전달한다. 시험 화면은 QR 데이터를 사용하지 않으므로 그 RPC를 생략하고 나머지 표시·exam_room 호출·기존 오류 우선순위를 유지한다. React cache는 현재 요청 안에서만 사용하며 키에는 audience와 includeQr가 포함된다.

## 검증

실제 Supabase client를 모의 transport와 연결해 권한 거절·만료 배정에서 본문/질문 0회, 질문과 본문·출석과 QR의 동시 시작, RPC 실패/throw, QR 생략을 검사한다. 기존 학습·출결·질문·DB 범위 회귀도 실행한다.

로컬 트랜잭션에서 이전 함수를 pg_temp에 복제하고 최신 운영 제외 migration+합성 학적 fixture를 사용한다. 강사 여러 기관·역할/배정 만료·미래 역할·중복 역할, 수강생 본인·미등록·MFA·anon, 숨김 구성원/과정, withdrawn·최신/구 run·승인·정책 stale을 대조한다. 8쌍 교차 실행의 첫 쌍 제외 중앙값과 EXPLAIN을 기록하고 ROLLBACK 한다. 원본 91종·기존 629 함수 ACL·RLS 정책 및 변경 대상 외 함수 해시를 배포 전후 비교한다.

독립 Preview 전체 migration과 최종 head 검사 후 드리프트 가드·짧은 lock timeout으로 정확한 migration만 운영에 적용한다. PR 생성/첨부/검사/병합 및 main 자동 배포의 revision/health/로그를 확인한다. 실제 역할 세션이 있는 경우에만 운영 화면의 이동 시작→본문 표시 4회 중 warm 3회 중앙값을 보고하며 자동화 통신 포함 지표임을 밝힌다.

참고: [Supabase RLS 성능](https://supabase.com/docs/guides/database/postgres/row-level-security#rls-performance-recommendations). 기존 강사·수강생 설계와 운영 학적 이력 보존 설계를 따른다.
