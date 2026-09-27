# DB 상태 확인 경량화 설계

2026-09-27 · [계획](../../01-plan/features/anchor-db-health-latency.plan.md)

## 현재 동작

`src/app/api/health/route.ts`가 Supabase 서버 클라이언트로 `life_catalog` 뷰의 `id` 1건을 읽는다. 성공 시 `{ "status": "healthy" }`와 200, 실패 시 `{ "status": "unavailable" }`와 503을 반환한다. 모든 응답은 `Cache-Control: no-store`다.

## 변경

같은 클라이언트의 조회 대상을 `life_course_guides`로만 교체한다. `select("id").limit(1)`과 오류 판정, 응답 규격은 그대로 둔다. 이 테이블은 `anon`/`authenticated`에 SELECT 권한이 있고 공개 행만 RLS로 읽힌다. 빈 결과도 기존처럼 정상 연결로 판단한다. 별도 migration·설정·비밀키 변경은 없다.

## 검증

1. 운영 공개 REST에서 기존 뷰와 새 테이블의 읽기 권한·상태코드 확인.
2. lint·TypeScript·빌드 확인.
3. 배포 전후 `/api/health`의 상태·응답시간 비교. 표본과 네트워크 변동을 함께 보고한다.
4. `/courses`와 `/auth/login` 등 변경되지 않은 공개 경로의 정상 응답 확인.
