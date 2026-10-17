# 수강생·강사 로딩 최적화 설계 대조

2026-10-17 · [설계](../02-design/features/learner-instructor-loading.design.md)

## 구현 및 검증

설계의 구현·로컬 검증 항목 8/8 일치. 운영 역할별 화면 측정은 로그인 세션 확보를 기다리고 있으며 배포 검증과 구분한다.

| 항목 | 결과 |
| --- | --- |
| 강사 요약 신원 1회·활성 기관 DISTINCT | MATERIALIZED CTE, 기존 role/assignment 유효기간·기관 조건과 같은 결과 |
| 본인 수료 이력 신원 InitPlan | latest run/승인/withdrawn/stale/정책/운영 제외 유지 |
| public wrapper·ACL·인증 helper·원본/쓰기 유지 | 변경은 private 읽기 함수 2개, 새 grant/policy 없음 |
| 강의실 권한 확인 뒤 질문 병렬 조회 | 실제 Supabase transport의 barrier 테스트, 거절 시 질문/본문 0회 |
| 출석/QR 병렬 조회 | 세 audience·정확한 f 매개변수·독립 실패 처리 검증 |
| 시험 화면 QR 생략 | 수강생·강사 모두 includeQr=false, exam RPC 유지 |
| 요청별 cache/실패 처리 | 사용자 공유 상태 없음, client 실패/QR 실패/FORBIDDEN 유지 |
| 기존 화면·DB 범위 회귀 | 아래 총 92개, lint·manuals·production build 통과 |

로컬 SQL 검증 17개는 기존 학적 회귀 5개와 이전/새 함수 대조·권한·원본 보존 12개를 실행한다. 복수 기관, 중복/만료/미래/경계 역할, 만료 배정, 숨김 구성원/과정, 본인 최신 승인/수강 취소/stale 이력, 타인 범위, 마감 전 시험 점수 비공개, 무효 세션과 anon 거절을 포함한다. fixture·권한·DDL은 전부 ROLLBACK 된다.

| 로컬 DB 경로 | 이전 중앙값 | 변경 중앙값 | 조건 |
| --- | ---: | ---: | --- |
| 강사 수업 요약 | 14.02ms | 5.46ms | 실제 로컬 authenticated 강사, 8쌍 교차 실행 중 첫 쌍 제외 |
| 수강생 수료 이력 | 45.98ms | 3.63ms | 실제 로컬 authenticated 수강생, 같은 학적 fixture/transaction |

강사 요약 EXPLAIN에서 반환 행 1개를 유지하고 shared hit blocks 808→248로 줄었다. 이 수치는 합성 데이터가 있는 로컬 DB 결과이며 운영 화면의 응답시간으로 해석하지 않는다. 운영 누적 통계 기준선은 계획 문서에 기록했다.

총 검증: 새 DB 17 + 새 조회 흐름 14 + 출석 UI/action 9 + 수강생 학습 6 + 출석 준비 12 + DB 성능 16 + DB 응답 범위 10 + workspace 8 = 92개. 기존 출석 회귀의 독립 모듈 로더가 현재 date-format import를 읽도록 보완하고, 이전 화면 수정에 따른 표의 줄바꿈·출력 링크 명칭을 현재 UI에 맞췄다. 제품 UI는 이 목적으로 변경하지 않았다.

## 운영 확인의 한계와 배포 절차

현재 앱 브라우저는 INSTRUCTOR가 없는 관리자 세션이다. `/instructor`의 기존 접근 거절을 확인했고 실제 역할 로그인은 사용자에게 요청했다. 관리자 빈 화면을 수강생/강사 화면 성능으로 계산하지 않는다. 권한을 운영 DB에서 추가하거나 JWT를 위조하지 않는다.

독립 data-free Preview의 전체 migration과 정확한 head의 PR 검사를 확인한다. 운영 적용 전후 원본 91종, 변경 대상 외 함수·전체 ACL·기존 relation/RLS 정책과 Advisor를 비교한다. 두 함수만 드리프트 가드·짧은 lock timeout·ledger와 함께 원자적으로 교체한 뒤 PR 병합에 따른 운영 배포의 커밋·health·로그를 검증한다. 실제 역할 UI 측정은 세션이 제공된 경우에만 추가한다.
