# anchor-migration-retry 설계

작성: 2026-09-19. 계획: `docs/01-plan/features/anchor-migration-retry.plan.md`.

## SQL 변경

- 009의 누락된 6개, 010의 누락된 9개 동명 정책에 `DROP POLICY IF EXISTS`를 추가한다.
- 기존 옛 이름 제거문은 유지한다. 각 CREATE 앞에서 같은 테이블·정책 이름만 지정한다.
- CREATE 본문, 함수, 뷰, 인덱스, GRANT, 데이터 조작은 변경하지 않는다.
- 신규 후속 migration만 추가하면 009에서 먼저 실패하므로 원격 이력에 없는 두 파일을 제한적으로 보완한다. 이미 기록된 환경에서 자동 재적용되지는 않는다.
- 동명 정책을 승인된 소스 정의로 복원하는 방식이다. 원격의 정책 내용이 별도 수정된 경우에는 적용 전 차이를 검토해야 한다. 임의의 스키마 불일치를 해결하지 않는다.

## 로컬 검증기

`scripts/verify-migration-retry.mjs`는 Docker 로컬 소켓과 `supabase_db_uc-life-core`만 사용한다. 외부 DB URL·환경 파일을 사용하지 않는다. 자동 생성한 `uc_life_retry_<random>` DB만 생성/삭제하며 정상·오류 시 모두 정리한다.

- Auth 최소 fixture: auth.users(id, email, raw_user_meta_data), auth.uid(). 네이티브 Auth 호환성 시험이 아님을 명시한다.
- 기존 001~008을 적용하고 가상 계정 데이터를 넣는다. 원격 데이터를 가져오지 않는다.
- 원본은 고정 Git commit `1a4bf135113778ff701a31b4ad7fbac6e60dadd6`의 009·010을 사용한다.
- 원본 최초 적용 후 각각 재실행하면 42710으로 실패하는지 확인한다. psql 단일 transaction 및 ON_ERROR_STOP으로 실패 시 rollback한다.
- 수정본 재실행, 일부 정책 누락 및 다른 정의 존재 상태, 빈 DB 최초 적용을 검사한다.
- 원본 최초 적용과 수정본의 정책 정의/대상 역할, 함수, 뷰, 인덱스, 컬럼, 테이블 권한, RLS 상태가 일치하는지 비교한다.
- public의 모든 기존 테이블 데이터 지문 및 무관한 추가 정책이 재실행 후 유지되는지 확인한다.
- 소스 차이는 주석·공백 및 누락된 정확한 DROP만 허용하는 검사로 한정한다.

## 운영 자료

실제 branch action의 009 실패 로그, migration 이력과 객체 존재의 불일치, 비밀값 없는 Auth 설정 요약을 보관한다. 운영 지침에 재시도 전 조건과 인증 구성 선택지를 추가한다. 아직 전체 migration 적용, 관리형 Auth 지원, 별도 Preview 행동 시험이 완료되지 않았으므로 배포 준비 검사를 통과시킨 것으로 기록하지 않는다.
