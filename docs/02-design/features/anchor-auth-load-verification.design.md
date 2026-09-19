# 로그인·역할별 부하 검증 설계

2026-09-19 · [계획](../../01-plan/features/anchor-auth-load-verification.plan.md)

## 대상과 빌드 격리

`scripts/check-auth-load.mjs`는 다른 URL·인자를 받지 않는다. `supabase status -o json`에서 API가 `http://127.0.0.1:55321`인지 확인하고, 학습자 learner·강사 instructor·과정 운영자 operator의 기존 `example.invalid` 시험 계정만 사용한다. 시험 데이터 준비는 기존 `npm run test:core`로 수행한다.

Git이 추적하는 현재 파일을 새 임시 디렉터리에 복사하되 .env 파일은 제외한다. node_modules만 연결하고 로컬 공개 키·서비스 키·origin을 환경변수로 지정해 build한다. 기존 .next와 실행 중 개발 서버는 유지한다. 전용 loopback 포트에서 start하고 실제 health 응답을 검사한다.

## 인증 검증

- 역할별 native password login을 3회 측정한다. 추가 로그인 세션은 local scope로 로그아웃한다.
- 최종 세션은 설치된 @supabase/ssr의 cookie 저장으로 생성하고 기존 ensureLocalMfa로 MFA를 완료한다. 역할과 현재 identity를 확인한다.
- 빌드 manifest의 authenticate action ID와 Next.js encodeReply로 실제 로그인 Server Action을 호출한다. 학습자는 mypage, MFA가 필요한 강사·운영자는 security로 이동해야 한다. 이 세션도 정리한다.
- 학습자의 /admin·/instructor 접근 거부와 사용자별 /mypage 내용 격리를 검사한다.

## 부하 측정

학습자 /mypage, 강사 /instructor, 운영자 /admin을 각각 1회 예열한다. 각 경로를 동시 요청 1·4·8에서 각각 24회 호출한다. 최대 요청 수는 고정해 실수로 장시간 부하를 가하지 않는다. 별도의 혼합 요청으로 요청별 React cache의 세션 격리를 검사한다.

각 요청은 HTTP 200과 해당 역할 화면의 의미 있는 제목을 검증한다. 타임아웃·리다이렉트·오류 안내는 실패로 기록하고 종료 코드를 1로 반환한다. 시작부터 본문 수신까지 p50·p95·max, 처리량, 실패 건수를 기록한다. 동일 세션의 8개 요청은 서로 다른 8명의 사용자 시험을 의미하지 않는다.

## 종료 및 기록

로그아웃은 scope=local로 이번 로그인 세션만 종료한다. 이번 실행이 만든 서버와 임시 디렉터리만 정리한다. 키·쿠키·본문을 제외한 집계 JSON을 ignored ops/evidence 아래 저장하고 문서에는 집계·환경·한계를 기록한다. 운영 schema·정책·사용자·데이터는 변경하지 않는다.

측정 중 병목이 나타나면 우선 요청별 쿼리 범위와 DB 실행계획을 읽기 전용으로 확인한다. 구현이 필요한 개선은 별도 설계 보완과 bkit 사전 검사를 거친다.

## 검증에서 확인한 보완

학습자의 `/admin` 요청은 404였지만 응답 본문에 과정 등록 폼이 포함되어 있었다. 레이아웃의 역할 검사만으로 페이지의 조회·직렬화를 막지 못한 것이다. `/admin`과 `/instructor` 진입 페이지도 identity 직후 역할을 확인하고, 권한이 없으면 DB 조회 이전에 notFound로 종료한다. 기존 요청별 identity cache를 사용하므로 인증 조회는 추가하지 않는다.

회귀 검증은 404/차단 본문뿐 아니라 업무 화면 표시 문구가 전체 응답에 없는지도 확인한다. 권한이 있는 강사·운영자 경로는 별도의 실제 로그인 세션으로 계속 성공해야 한다. [Next.js 인증 가이드](https://nextjs.org/docs/app/guides/authentication)의 데이터 접근 가까이에서 권한을 검사하는 원칙을 적용한다.

## 인증 화면의 조회 범위 최적화

초기 측정 중 pg_stat_statements에서 인증된 전체 life_catalog 조회 20회 평균 4,246ms를 확인했다. 세 화면 모두 전체 과정을 받아 애플리케이션에서 걸러내고 있었다.

- getWorkspaceOfferings(column, ids)를 추가한다. column은 id 또는 org_id만 허용하는 타입이고 모든 값은 UUID로 검증한다. 빈 목록은 DB 요청 없이 정상적인 빈 결과, 잘못된 값은 unavailable로 처리한다.
- 화면에서 사용하는 id/name/status/capacity/year_label/starts_on/ends_on만 조회하며 기존 전체 getOfferings 계약은 유지한다. 정렬은 created_at 내림차순과 id 오름차순으로 고정한다.
- 학습자는 신청 목록을 얻은 뒤 해당 offering_id만 조회한다. 강사는 유효한 배정 목록을 얻은 뒤 해당 offering_id만 조회한다. 이 종속 관계는 순차 실행하고, 범위를 아는 운영자의 과정/사업연도 읽기는 병렬로 유지한다.
- 신청/배정/과정 조회 중 하나라도 실패하면 오류 상태를 표시한다. 신청이나 배정이 없으면 과정 요청을 생략한다.
- 실제 Supabase query builder 회귀검사에서 필터/필드/정렬/빈 목록/잘못된 UUID/실패 상태를 검증하고, 동일한 역할별 실제 DB 부하 검증을 다시 실행한다.
