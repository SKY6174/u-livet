# Gap Analysis: anchor-db-performance

2026-09-19 · [설계](../02-design/features/anchor-db-performance.design.md)

## 설계 대조: 9/9 완료

| 항목 | 검증 결과 |
|---|---|
| DB와 Functions 리전 일치 | 운영 배포 `bd67399` READY, hnd1. 이전 배포 iad1 |
| 요청별 서버 클라이언트 재사용 | React cache 사용, 전역 세션·결과 캐시 없음 |
| 홈 조회량 제한 | 실제 로컬 DB에서 PUBLISHED 최대 3건, 회귀검사 통과 |
| 목록 카드 필드 축소 | 12개 필드만 선택, curriculum 제외, DRAFT 제외 |
| 기존 업무 데이터 계약 | getOfferings의 전체 레코드 조회 유지, 회귀검사 통과 |
| 상세·신청 병렬 조회 | 지연 응답 barrier 검사로 3개·2개 독립 조회의 동시 시작 확인 |
| 정책 범위 축소 | 해당 UUID·종류·APPROVED 필터, 없는 정책은 쿼리 생략 |
| 실패·인증·권한 유지 | 오류·설정 누락 상태 검사, 로컬 업무·권한 33개 통과, 운영 /admin 로그인 이동 |
| 측정·Git·운영 검증 | 읽기 전용 측정 도구 추가, main push 및 운영 화면·연결·리전 확인 |

## 같은 시간대 교차 측정

2026-09-19 12:55 KST, 한국 개발 환경의 동일 Node fetch 클라이언트에서 이전 운영 배포 `50da969`와 새 운영 배포 `bd67399`의 고정 URL을 교차 요청했다. 두 배포는 같은 운영 DB를 사용한다. 각 경로·배포당 9회, 요청 순서를 번갈아 바꾸고 첫 요청은 통계에서 제외했다. 아래는 8회의 본문 수신 완료시간 중앙값과 p95다. p95는 작은 표본에서 최대값과 같다.

| 경로 | 이전 중앙값 | 이후 중앙값 | 감소 | 이전 p95 | 이후 p95 |
|---|---:|---:|---:|---:|---:|
| /api/health | 692ms | 154ms | 78% | 933ms | 170ms |
| / | 532ms | 178.5ms | 66% | 960ms | 238ms |
| /courses | 528ms | 178ms | 66% | 946ms | 205ms |
| /auth/login | 291.5ms | 149.5ms | 49% | 308ms | 207ms |

모든 교차 요청은 HTTP 200이었다. 응답 헤더에서 실행 경로가 `icn1::iad1`에서 `icn1::hnd1`으로 바뀐 것을 확인했다. 첫 요청도 별도로 기록했으며 이는 새 인스턴스의 cold start를 보장하는 수치가 아니다.

운영 도메인 `uc-life.org`도 실제 새 revision과 `healthy`를 확인했다. 도메인에서 시간대를 나눠 수행한 첫 전후 측정은 직접 DB 조회·로그인 지연에 네트워크 편차가 있어, 개선율은 고정 배포 교차 측정 결과로 보고한다. 두 측정 모두 비로그인·빈 운영 카탈로그 기준이다.

## 실제 데이터 및 회귀 검사

- 로컬 DB에서 공개 과정 64개를 조회해 UTF-8 JSON 60,782 → 23,418바이트(61% 감소)를 확인했다. 전체 레코드와 카드 레코드의 행 수가 일치한다. 홈은 공개 과정 3건이다.
- 성능 회귀 9개 + 로컬 DB 업무·권한 33개 + Preview 설정 29개 + Managed Cloud 28개 + release-readiness 111개 = 210개 통과.
- lint, 타입 검사를 포함한 Next.js 프로덕션 build, git diff --check 통과.
- agent-browser에서 운영 홈 화면, 과정 검색의 특수문자 입력과 ONLINE 선택 유지, 빈 목록 안내, 비로그인 /admin의 로그인 이동 확인.
- 새 배포를 대상으로 최근 10분 error 로그 조회 결과 0건. 이후 전체 운영 기간의 무오류를 보장하는 검사는 아니다.

## 남은 운영 과제

운영 DB가 비어 있어 대규모 실제 과정·동시 접속·로그인 후 업무 지연은 측정하지 않았다. 검색·전체 목록의 기존 동작은 유지했다. 데이터 증가 시 서버 검색·페이지 나누기와 RLS 실행계획을 별도로 확인한다.

성능 Advisor의 WARN 33개(auth_rls_initplan)와 234개(multiple_permissive_policies)는 life_ 이전 테이블에서 발생한다. 현재 공개 화면의 지연 원인과 분리해 후속 검토한다. 권한 의미를 바꾸는 정책 통합은 이번에 수행하지 않았다. [RLS initplan 설명](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan), [중복 정책 설명](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies)

## 운영 데이터 재측정 준비 상태 — 2026-09-19 22:10 KST

운영 `/api/version`에서 revision `404b43c26388ab7ec6faeb369e0718461f778138`, production, managed-cloud-v1, reviewOnly=false를 확인했다. `/api/health`는 200/healthy다.

현재 도메인에서 경로별 GET 9회(첫 요청 제외, 표본 8개)를 순차 실행했다. 요청 시작부터 본문 수신까지의 시간이며 36회 모두 HTTP 200, health 오류 0건이었다. 직접 PostgREST 측정과 인증 쿠키는 사용하지 않았다.

| 경로 | 중앙값 | p95 |
|---|---:|---:|
| /api/health | 145.5ms | 183ms |
| / | 145ms | 206ms |
| /courses | 151.5ms | 171ms |
| /auth/login | 125ms | 194ms |

운영 DB 집계: 과정·기수·신청·수강·강사 배정 모두 0건. 이메일 인증 계정, SYSTEM_ADMIN, COURSE_MANAGER는 각각 1명이고 두 역할은 TOTP 등록을 확인했다. 현재 사업연도는 1개다. 승인된 수강신청·수료·환불 정책 및 수료 규칙은 모두 0개다. 등록된 TOTP는 실제 로그인 세션 검증을 대신하지 않는다.

실제 운영 데이터 성능 측정은 아직 진행할 수 없다. 첫 개설 과정, 모집 시작·마감, 대상·수강료·선발 방식, 확정 차시표, 신청·수료 규정과 승인 담당자의 정보가 필요하다. [운영 개방 준비표](../operations/production-course-opening.md)의 후보 3개와 누락값을 기준으로 사용자에게 확인을 요청했다. 기존 PDF 편성표는 실제 개설 과정이나 실적 데이터로 취급하지 않는다.

이번 점검은 읽기 전용이다. 원본 집계는 Git 제외 `ops/evidence/production-performance/public-latency.jsonl`에 저장했다. 수치는 비로그인·빈 카탈로그 기준이며 로그인 후 업무 성능 또는 동시 사용자 수용량을 나타내지 않는다. 제품 코드 변경이 없어 기존 로컬 부하 검증·빌드를 반복하지 않았다.
