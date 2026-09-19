# Gap Analysis: Preview DB 성능

2026-09-19 · [설계](../02-design/features/anchor-preview-db-performance.design.md)

## 설계 일치율: 100% (10/10)

| 설계 항목 | 구현·검증 근거 |
| --- | --- |
| Preview 분리 확인 | persistent branch bfqwntulxabfrimcypvx 정상, Preview 환경의 DB URL 일치 |
| 실제 공개 읽기·업무 접근 차단 | anon catalog 200, applications 401/42501 |
| 공개 HTTP 반복 측정 | 변경 전후 각각 4경로 × 9회, 모두 200; health healthy |
| WorkspaceOffering 8개 속성 | org_id 추가, 실제 query builder 회귀 통과 |
| 수료 화면 조직 범위 | COURSE_MANAGER/CERTIFIER 조직으로 DB 필터 |
| 강사 화면 유효 배정 범위 | 역할 검사, 만료 배정 제외, 빈 배정 시 조회 생략 |
| 강사 후속 조회 병렬화·오류 | 과정/수업 병렬, 선행 오류 시 후속 요청 차단, 과정 오류 표시 |
| 증명 화면 조직 범위·오류 | 담당자 조직만 조회, certifier-only 빈 범위, RPC 병렬 유지 |
| 데이터가 있는 환경의 비교 | 로컬 두 권한의 결과 집합 일치, 조회 시간·전송량 감소 |
| 품질·배포 검증 | 21개 회귀, lint, 격리 빌드 통과; 4b19b54 Preview READY 및 revision 확인 |

## 측정의 범위

Preview에는 과정·신청·등록·강사 배정 데이터가 각각 0건이다. 따라서 공개 HTTP 수치는 빈 DB의 연결 상태와 지연만 설명한다. 로그인 업무의 성능 개선은 기존 로컬 합성 데이터와 동일한 권한으로 비교했으며 Preview 실데이터 개선율로 해석하지 않는다.

로컬 비교는 권한별 기존 전체 projection/개선 범위 projection을 교차 실행한 3쌍이다. 첫 쌍을 제외한 2회 중앙값을 보고했다. 최초 별도 측정 시도에서는 statement timeout이 발생했다. 후속 완결 비교에서는 양쪽 모두 성공했고 필요한 행 집합이 일치했다. 표본이 작으므로 처리량·동시 부하 보장은 아니다.

## 남은 구현 누락

이번 설계의 구현 누락은 없다. RLS·스키마·RPC 변경은 하지 않았다. Supabase Advisor의 기존 legacy 정책 경고와 INFO 인덱스 제안은 별도 과제로 유지한다. 데이터 입력 이후 동일 측정을 다시 수행하면 실제 업무량에서의 성능을 확인할 수 있다.

## 배포 확인

- 코드 commit: `4b19b54d370753143367c0efab3eed52caa71734` (`preview`)
- 배포: `dpl_7wm36xKSjBx76E8ZnJCxRMmn4Npo`, READY, hnd1
- 고정 URL: https://uc-life-5qj4v7tjs-ucsky6174.vercel.app
- Vercel의 `staging.uc-life.org` alias도 위 배포를 가리킨다.
- `/api/version`: 해당 revision, environment=preview, authProfile=managed-cloud-v1, reviewOnly=false
- 앱 로그인 세션 없이 업무 3개 경로 접근 시 `/auth/login`으로 307 이동

다음 단계: 완료 보고. 보고서만 추가하는 후속 커밋은 앱 구현을 변경하지 않는다.
