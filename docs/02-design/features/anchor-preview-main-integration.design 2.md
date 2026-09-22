# Main → Preview 통합 설계

- 기능: `anchor-preview-main-integration`
- 작성일: 2026-09-19
- 기준: `anchor-preview-main-integration.plan.md`
- 기존 설계: `anchor-db-performance.design.md`, `anchor-course-content.design.md`, `anchor-course-reports.design.md`

## 병합 방식

- preview에서 origin/main을 일반 merge하여 양쪽 이력을 보존한다.
- 사전 `git merge-tree` 결과는 충돌 없음이며 공통 파일의 의미적 결합을 확인한다.
- 코드 기능, 테이블, RPC, 공개 API를 새로 정의하지 않는다.

## 반드시 유지할 동작

1. `src/app/admin/page.tsx`: COURSE_MANAGER 역할 검사, `getWorkspaceOfferings("org_id", orgs)` 조회, 과정별 결과보고서·출력 링크.
2. `src/lib/portal/data.ts`: 필요한 필드만 읽는 공개/사용자별 과정 조회, 유효한 소속/과정 ID 제한, 오류 상태 구분.
3. `src/lib/supabase/server.ts`: 서버 렌더 요청 내 클라이언트 재사용과 기존 세션·쿠키 동작.
4. `vercel.json`: Tokyo `hnd1` 리전과 기존 Vercel 빌드 명령.
5. `/admin/course-plan`: 14개 과정, 원문 합계 차이와 미확인 인력 구분 보존.
6. `/admin/offerings/[id]/reports` 및 `/reports/print`: 기존 권한 검사와 6종 출력 유지.

## 검증과 반영

- 병합 커밋을 별도 체크아웃에서 lint, Next.js build, DB 성능·과정 편성표·MFA 회귀 스크립트로 검증한다.
- 과정 편성표·보고서 파일은 병합 전 preview와 비교하여 변경되지 않았음을 확인한다.
- 공통 관리자 목록과 데이터 조회 연결을 직접 검토하고 기존 설계 대비 누락 여부를 기록한다.
- 검증 완료 후 정상 fast-forward 푸시로 preview만 갱신하고 원격 커밋을 확인한다.
- 호스팅된 Preview에서 실제 사용자 흐름 검증은 전환 절차 2단계로 구분한다.
