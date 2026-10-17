# 관리자 로딩 최적화 설계

2026-10-17 · [계획](../../01-plan/features/admin-loading-optimization.plan.md)

## 주차권 읽기

parking_admin_context(y,c)만 CREATE OR REPLACE 한다. 서명·STABLE SECURITY DEFINER·빈 search_path·ACL은 유지한다. 기존 입력 검사를 먼저 실행한 뒤 auth.uid/person_id/MFA를 확인하고, person의 현재 활성 COURSE_MANAGER 또는 SYSTEM_ADMIN 기관을 DISTINCT 배열로 계산한다. 기존 parking_staff가 요구하는 조건과 같으며, 빈 기관은 기존 FORBIDDEN을 낸다. 모든 기관·과정·재고·요청의 parking_staff(org) 행별 호출을 이 배열과의 비교로 바꾼다.

can_decide는 이미 허용된 요청 기관 안에서만 반환한다. 기존 parking_reviewer의 나머지 조건인 lower(auth.users.email)=centers.reviewer_email, 본인 user ID, email_confirmed_at NOT NULL, deleted_at IS NULL을 한 번 계산해 센터 배열로 둔다. null/유효하지 않은 센터의 false도 유지한다. 입력 null의 기존 처리, 연도 범위, 요청 전체 이력, 상태·정렬·JSON 필드 및 centers/stock의 센터 필터 의미를 바꾸지 않는다. parking_staff/reviewer/applicant와 모든 쓰기·발급·재고·감사 함수는 수정하지 않는다.

## 과정 메타데이터

public.life_workspace_catalog view를 security_invoker=true로 생성한다. life_offerings o JOIN life_project_years y ON y.id=o.project_year_id에서 id/org_id/name/status/capacity/year_label/starts_on/ends_on/created_at 9개 열만 반환한다. 일반 역할은 SELECT만 허용한다. anon/authenticated는 원래 life_offerings와 year의 SELECT/RLS 및 operational_offerings restrictive 정책을 그대로 거친다. private definer나 새 역할·정책을 추가하지 않는다.

기존 life_catalog는 과정 버전·과정·사업연도까지 조인한다. 현재 검증된 FK와 정책상 visible offering은 그 버전과 과정도 읽을 수 있다(각 부모 정책에 동일 offering의 read_offering EXISTS가 있음). 새 view는 이미 직접 읽을 수 있는 과정 자체 필드와 공개 연도명만 노출하며 부모의 curriculum/summary/academy를 추가하지 않는다. 상태·기수·숨김·기관 조건의 이전/새 결과 동등성을 실제 authenticated/anon RLS에서 검사한다.

getWorkspaceOfferings의 from 대상만 새 view로 바꾼다. UUID 검증·빈 scope 요청 0회·id/org_id 필터·중복 ID 제거·projection·created_at desc/id asc 정렬·오류 처리를 유지한다. 상세 및 공개 과정 카탈로그는 기존 경로를 사용한다.

## 검증과 배포

전용 로컬 단일 트랜잭션에 선행 운영 과정 분류 migration, 여러 상태·기관의 과정/등록/담당·주차권 상태와 연도·재고·심사센터 fixture를 구성한다. 기존 주차권 함수를 pg_temp에 복제해 기관·역할·유효기간·MFA·일반 사용자·센터 심사자/이메일 미확인/삭제 상태별 JSON·오류를 비교한다. 과정 view는 실제 RLS 하에서 이전/새 8열의 순서 및 scope별 결과를 대조한다. 8쌍 교차 실행의 첫 쌍 제외 중앙값과 EXPLAIN ANALYZE를 기록하며 전체 fixture/DDL은 ROLLBACK 한다. 절대 시간은 테스트 통과 조건에 넣지 않는다.

원본 86종과 주차권 5원장, 기존 함수·ACL·RLS·정책을 전후 비교한다. 좁은 Supabase 실제 query-builder 회귀와 workspace/주차권 회귀, lint·빌드·설계 대조를 통과한다. data-free Preview 전체 migration과 최종 head 검사 후 운영 DB→앱 순으로 배포하고 실제 관리자 10화면 재측정·DB 통계 차분·커밋/health를 검증한다. 화면 지표는 이동 시작→본문 표시 확인 시간이며 자동화 통신을 포함한다. 작은 표본의 변동과 DB 실행시간을 구분해 보고한다.
