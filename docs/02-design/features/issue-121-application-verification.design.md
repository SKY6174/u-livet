# Issue #121 수강신청 연결 검증 설계

2026-10-07 · 계획: [issue-121-application-verification.plan.md](../../01-plan/features/issue-121-application-verification.plan.md)

## 현재 경로

- `src/app/offerings/[id]/apply/page.tsx`: 본인 로그인, 현재 모집·정책 확인, 필수 동의 후 `ActionForm` 제출.
- `src/app/actions.ts`: `applyForCourse`가 UUID·동의를 검사하고 사용자 세션의 `life_apply(f,policy)`를 호출한다. RPC 오류는 성공 안내를 표시하지 않는다.
- `supabase/migrations/20260918161548_anchor_finance.sql`: 현재 신청 트랜잭션의 기준. 기수 잠금, 정책·모집·신원·정원 검사, 중복 신청 재사용, 신청·동의·등록 저장을 수행한다.
- `supabase/migrations/20260918145727_anchor_core.sql`: `life_applications` 유일키, `life_roster`의 담당 기수 검사와 반환 `application_id/person_id/name/status/submitted_at`.
- `src/app/admin/offerings/[id]/manage/page.tsx`: `life_roster` 결과에 이름·상태·한국시간 신청시각을 표시한다. 실제 신청자 목록은 `/manage#applications`다.
- `src/app/mypage/page.tsx`: 본인 신청 확인 경로.

## 검증 환경·증거

전용 로컬 프로젝트 `uc-life-issues`, API `http://127.0.0.1:56321`, DB `56322`, 앱 `http://127.0.0.1:3100`. 현재 저장소의 모든 마이그레이션을 적용한다. 합성 계정은 `@example.invalid`로 제한한다. 관리자 역할은 테스트 조직에만 부여한다. 브라우저·JWT·비밀값은 증거에 포함하지 않는다.

1. 브라우저에서 수강생 계정으로 신청서를 제출한다. 제출 전 같은 수강생/기수의 신청이 없음을 확인한다.
2. DB의 신청 행과 동의 행을 조회한다. UUID·기수·수강생·UTC 시각·상태를 증거 JSON으로 저장한다.
3. 테스트 조직의 COURSE_MANAGER 계정으로 `life_roster`를 호출하여 동일한 ID·이름·상태·시각을 비교한다.
4. 관리자 화면에서 동일 과정명·수강생·한국시간 시각·상태를 확인하고 캡처한다.
5. 새 브라우저 context에서 다시 로그인하고 같은 신청을 확인한다. DB 행을 다시 읽어 유지 여부를 비교한다.
6. 중복 제출이 같은 ID를 반환하고 행·동의가 늘지 않는지 확인한다. 비담당 관리자·다른 수강생·비로그인 명단 접근 거부, 잘못된 정책·접수 종료 오류를 확인한다.

검증은 실제 Supabase Auth와 PostgREST 및 앱의 서버 액션을 사용한다. 합성 JWT나 화면 mock으로 성공을 대체하지 않는다. 운영 환경의 실사용자 신청 검증으로 확대 해석하지 않는다.

설계 대조·실행 결과는 `docs/03-analysis/issue-121-application-verification.analysis.md`에 기록한다. 기능 문제가 확인되면 이 문서에 원인·수정·추가 회귀를 먼저 갱신한다.
