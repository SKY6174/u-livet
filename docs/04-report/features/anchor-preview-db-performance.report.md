# Preview DB 연결·성능 점검 결과

2026-09-19 · [분석](../../03-analysis/anchor-preview-db-performance.analysis.md)

## 결과

Preview DB 연결은 정상이다. 수료 검토, 강사 강의실적, 증명 관리 화면에서 전체 과정 조회를 담당 조직 또는 유효 강사 배정 범위로 제한했다. 사용 속성 8개만 요청하고, 빈 범위의 DB 요청을 생략하며 독립 조회는 병렬 처리한다. 권한 검사와 조회 실패 화면도 회귀검사했다.

## 연결 확인

- Preview DB: `bfqwntulxabfrimcypvx`, persistent branch, ACTIVE_HEALTHY
- 마이그레이션 26개, public 테이블 94개
- 과정·신청·등록·강사 배정: 각 0건
- Vercel Preview 환경의 DB URL이 해당 ref와 일치
- anon catalog 읽기 200, 비인증 applications 접근 401/42501
- 공개 카드 조회의 anon 실행계획: planning 1.776ms, execution 27.383ms, 결과 0행
- Preview REST 직접 읽기: 9/9 성공, 첫 요청 제외 중앙값 153ms, p95 181ms

## 실제 Preview HTTP 응답

각 경로 9회 GET, 첫 요청을 제외한 8회 중앙값/p95(ms)이다. Vercel 보호 접근은 임시 쿠키를 사용했고 앱 로그인은 하지 않았다. 변경 전후 고정 배포를 따로 측정했다.

| 경로 | 변경 전 중앙값 / p95 | 변경 후 중앙값 / p95 |
| --- | ---: | ---: |
| DB health | 207.5 / 288 | 218.5 / 473 |
| 홈 | 204.5 / 248 | 207 / 248 |
| 과정 목록 | 203.5 / 272 | 199 / 311 |
| 로그인 | 145 / 174 | 147.5 / 255 |

전후 각 36회 모두 HTTP 200이며 health는 healthy였다. 공개 경로는 이번 최적화 대상이 아니며, 수치에서 공개 페이지 성능 개선을 주장하지 않는다. 데이터가 비어 있고 p95가 흔들리므로 실제 데이터 증가나 동시 부하 상황을 대표하지 않는다.

## 로컬 합성 데이터에서의 개선 효과

기존 시험 계정으로 같은 DB·권한에서 전체 조회와 범위 조회를 교차 실행했다. 3쌍 중 첫 쌍을 제외한 2회 중앙값이다. 계정 설정과 업무 자료는 변경하지 않았으며 측정에 사용한 로그인 세션을 종료했다.

| 조회 권한 | 기존 → 개선 시간 | 감소 | 기존 → 개선 행 수 | 기존 → 개선 JSON 크기 |
| --- | ---: | ---: | ---: | ---: |
| 강사 배정 범위 | 7,480 → 2,176.5ms | 70.9% | 69 → 19 | 65,432 → 5,085B (92.2% 감소) |
| 담당자 조직 범위 | 935.5 → 211.5ms | 77.4% | 93 → 84 | 86,018 → 21,716B (74.8% 감소) |

양쪽 권한 모두 기존 결과를 업무 범위로 필터한 행 집합과 개선 쿼리의 행 집합이 일치했다. 이 수치는 로컬 쿼리 비교이며 Preview 로그인 페이지 전체 응답시간이 아니다. 강사 조회에는 여전히 약 2.2초가 걸려, 실제 데이터가 준비되면 RLS 비용을 포함한 추가 측정이 유용하다.

## 검증과 반영

- `npm run test:db-performance`: 13개 통과
- `npm run test:workspace-queries`: 8개 통과
- lint 및 Preview 환경을 사용한 격리 Next 프로덕션 빌드 통과
- `git diff --check` 통과
- 코드 commit `4b19b54d370753143367c0efab3eed52caa71734`를 `origin/preview`에 push
- Vercel `dpl_7wm36xKSjBx76E8ZnJCxRMmn4Npo` READY, 실제 revision/health 확인
- `staging.uc-life.org`가 해당 배포를 가리킴을 Vercel API로 확인
- 변경한 업무 3개 경로는 로그인 없을 때 로그인 화면으로 이동

이번 변경은 main이나 Production DB를 수정하지 않았다. 키·접근 쿠키·실측 원자료는 커밋하지 않는다.

## 후속 점검

실제 Preview 업무 데이터를 준비한 뒤 역할별 화면 및 동시 부하를 측정할 수 있다. Advisor에는 기존 legacy 정책의 auth_rls_initplan 33건, multiple_permissive_policies 234건과 INFO 인덱스 제안이 남아 있다. 실행계획·업무 권한 검증 없이 인덱스나 RLS를 일괄 변경하지 않았다.

PDCA: `anchor-preview-db-performance` 구현·검증 완료, 설계 일치 10/10.
