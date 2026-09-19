# Preview DB 성능 점검 설계

2026-09-19 · [계획](../../01-plan/features/anchor-preview-db-performance.plan.md)

## 대상과 측정

Preview ref는 bfqwntulxabfrimcypvx, Git 브랜치는 preview, 앱은 staging.uc-life.org이다. 기준 고정 배포는 fca24a9의 uc-life-ev137j7zf-ucsky6174.vercel.app이다. 보호 접근 쿠키와 Preview 공개 키는 도구에서 얻어 ignored 증거 폴더에 0600으로 보관하고 종료 시 제거한다. 운영 ref로는 DB 쓰기·인증·부하를 실행하지 않는다.

공개 페이지, health, 버전을 실제 GET으로 확인한다. PostgREST에서도 공개 읽기와 인증 없는 업무 접근 차단을 확인한다. 반복 측정은 9회, 첫 요청 제외 8회 중앙값/p95다. 기존 check-db-performance를 재사용하며 키·본문·쿠키는 로그에 포함하지 않는다. Preview 데이터가 비어 있는 한 공개 결과를 데이터 증가 시 성능이나 로그인 업무 성능으로 설명하지 않는다.

## 불필요한 업무 조회 수정

기존 수료 목록, 강사 실적, 증명 관리가 전체 life_catalog를 읽는 것을 확인했다. 앞선 getWorkspaceOfferings의 필터·작은 projection을 재사용한다.

- WorkspaceOffering에 org_id를 포함해 총 8개 필드를 읽는다. 기존 7개 속성은 유지한다.
- 수료 목록은 COURSE_MANAGER/CERTIFIER 역할의 org_id 범위로 직접 조회한다.
- 강사 실적은 INSTRUCTOR를 페이지 진입부에서 검사한다. 기록과 배정 목록을 병렬 조회한 다음, 유효 배정 ID의 과정과 완료된 예정 수업을 병렬 조회한다. 배정 조회 실패 시 후속 조회 없이 기존 오류 화면을 반환한다. 과정 조회 오류도 오류 화면으로 표시한다.
- 증명 관리는 필요한 기존 RPC들과 COURSE_MANAGER 조직의 과정 조회를 병렬 유지한다. CERTIFIER만 있고 COURSE_MANAGER가 없으면 과정 요청을 생략한다. 역할별 실적 필터는 유지하고 과정 읽기 오류도 표시한다.

RLS, DB schema, 업무 RPC, 기존 전체 getOfferings 계약은 변경하지 않는다. Advisor의 기존 legacy 정책 경고와 INFO 인덱스 제안은 이번 수정 대상으로 자동 확대하지 않는다.

## 검증

- 실제 Supabase query builder 회귀를 확장해 org_id 필드를 포함한 범위별 읽기를 확인한다.
- 페이지 컴포넌트를 실행해 권한 거부·빈 배정·만료 배정·DB 오류·후속 병렬 조회·조직 범위 유지가 실제로 동작하는지 검사한다.
- 기존 로컬 합성 DB에서 같은 로그인 권한의 전체 조회와 범위 조회를 교차 측정한다. 데이터 행 집합 일치와 줄어든 전송량을 함께 확인한다. 기존 시험 계정의 설정/업무 자료를 변경하지 않으며 이번 로그인 세션만 종료한다.
- lint, 관련 회귀검사, 격리 프로덕션 빌드를 수행한다. 현재 작업 폴더의 빌드 산출물은 변경하지 않는다.
- preview push 이후 배포 revision/health, 실제 DB 대상, 보호 상태, 반복 응답을 확인한다. Git 푸시가 발생시키는 자동 Preview 배포를 검증하며 main 병합은 하지 않는다.
