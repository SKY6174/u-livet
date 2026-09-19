# DB 응답시간 최적화 설계

2026-09-19 · [계획](../../01-plan/features/anchor-db-performance.plan.md)

## 실행 위치

`vercel.json`에 `regions: ["hnd1"]`을 지정한다. 운영·Preview Supabase가 위치한 도쿄에서 Node Functions를 실행해 미국 동부 왕복을 줄인다. Middleware의 인증 검증과 DB의 권한 정책은 그대로 유지한다. [공식 리전 설정](https://vercel.com/docs/functions/configuring-functions/region)

## 데이터 접근

- `createServerSupabaseClient`는 React `cache`로 서버 렌더 요청 안에서 재사용한다. 프로세스 전역 클라이언트·사용자 간 데이터 캐시·공유 ISR은 만들지 않는다. Route Handler에서 재사용을 보장한다고 가정하지 않는다.
- 기존 업무 화면의 `getOfferings` 계약은 유지한다.
- 공개 홈·목록 전용 `getCourseCards(featured)`는 카드에서 실제 사용하는 12개 필드만 선택한다. curriculum, 정책 본문, 내부 업무 필드는 받지 않는다.
- 홈은 DB에서 `status=PUBLISHED`, `limit=3`을 적용한다. 목록은 DB에서 `status!=DRAFT`를 적용하고 기존 검색·운영방식 필터를 유지한다. 정렬은 `created_at desc, id asc`로 고정한다.
- `CourseCard`의 입력 타입은 전체 Offering의 필요한 속성을 Pick한 `CourseSummary`로 좁힌다.
- 과정 상세는 기본 과정 확인 후 정책·수납 설정·강사 조회를 `Promise.all`로 실행한다. 신청 화면도 정책·수납 조회를 함께 실행한다. 정책 조회에는 해당 정책 ID를 전달해 불필요한 본문 전송을 줄인다.
- 오류 시 기존 빈 결과 및 unavailable 표시를 유지한다.

## 측정과 검증

- `scripts/check-db-performance.mjs`는 GET만 사용하고 응답 본문·키·쿠키를 출력하지 않는다. 환경변수는 기존 값 우선으로 읽으며 대상 site origin은 인자로 받는다. 첫 요청과 반복 요청 중앙값·p95를 분리한다. Preview 접근용 Cookie는 환경변수로만 전달한다.
- 실제 Supabase JS query builder와 합성 fetch를 사용해 필드·필터·제한·실패 처리를 검증한다. 상세 화면은 지연시킨 독립 RPC의 동시 시작을 검증한다.
- 로컬 또는 Preview DB에서 공개 조회와 개인정보 접근 거부를 확인한다. 기존 관련 회귀 검사, lint 및 build를 실행한다.
- 배포 전후 동일 클라이언트에서 최소 9회 요청한다. 빈 DB와 서로 다른 배포환경이라는 한계를 기록한다. 숫자를 DB 대용량 처리 성능이나 로그인 후 저장 성능으로 확대 해석하지 않는다.

## 변경 안전성

DB schema·RLS·인증 정책은 변경하지 않는다. 추가 인덱스는 실제 데이터에서 쿼리 계획상 필요성이 확인될 때 적용한다. 민감한 사용자 데이터·인증 토큰은 출력하거나 커밋하지 않는다. 현재 main 브랜치의 최신 이력을 유지해 일반 push를 수행한다.
