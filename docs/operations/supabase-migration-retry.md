# uc-life 마이그레이션 실패 진단과 재시도

2026-09-19 · ANCHOR / uc-life (`uoebygejgglgiivzgyks`). 로컬 수정 및 검증 후 별도 Preview에 업무 migration을 적용했다. main의 원격 복구는 수행하지 않았다.

## 실패 원인

실제 branch action `eacf9d4b607f4dc29babd4f3d54fbabf`의 migrate 단계가 DEAD였다. GET 로그에서 009의 `본인 및 관리자 프로필 조회 허용` 정책 생성이 SQLSTATE 42710으로 실패한 것을 확인했다. GitHub Supabase Preview check는 여전히 in_progress였지만 실제 작업 로그에 실패가 기록돼 있다.

원격 migration 이력은 001~008이다. 반면 009·010에서 만드는 정책 이름들은 원격 catalog에 존재했다. 수동 적용 등 어떤 경로로 불일치가 생겼는지는 확인하지 못했다. 이름 존재만으로 전체 migration 실행 완료 또는 정의 일치를 판단하지 않는다. [조회 근거](../04-report/features/evidence/migration-retry-remote-observations.md)

## 수정 내용과 적용 범위

- 009에 6개, 010에 9개의 정확한 `DROP POLICY IF EXISTS`를 보완했다.
- 기존 CREATE 조건, 역할, 함수, 뷰, 인덱스, 권한과 데이터 처리는 그대로다. 24개 정책이 최초 적용 및 재실행될 수 있다.
- 새 후속 migration만 추가해도 먼저 실행되는 009에서 중단되므로, 원격 이력에 없는 두 파일을 보완했다. 001~008과 원격 이력은 수정하지 않았다.
- 이미 009·010이 이력에 기록된 다른 환경에서는 이 수정이 자동 적용되지 않는다. 그 환경의 상태와 승인 절차를 별도로 따른다.
- 임의의 스키마 변경, 함수 반환 타입/뷰 컬럼 변경, 별도 정책 의도까지 자동 해결하지 않는다. 동명 정책에 현장 수정이 있다면 소스 정의로 덮어쓰기 전에 비교해야 한다.

## 로컬 검증

```sh
npm run test:migration-retry
```

실행 조건: Node, Docker의 로컬 Unix 소켓, `supabase_db_uc-life-core`, 원본 Git commit `1a4bf135113778ff701a31b4ad7fbac6e60dadd6` 객체가 필요하다. 검증기는 외부 DB 주소를 받지 않고 환경 파일을 읽지 않는다. 무작위 이름의 임시 DB만 만들고 정리한다. 기존 로컬 프로젝트 DB도 reset하지 않는다.

10개 검사 통과: 원본 009·010 각각 오류 재현, 실패 transaction rollback, 수정본 신규 적용과 반복 실행, 일부 정책 누락/다른 정의 복원, 무관한 정책 보존, 전체 public 테이블의 행 지문 보존, 정책·역할·함수·뷰·인덱스·컬럼·권한·RLS catalog 동일성, 임시 DB 정리. 최소 Auth fixture를 사용하므로 관리형 Auth나 전체 22개 migration의 인수 결과가 아니다.

## 실제 재시도 순서

1. 대상 프로젝트·브랜치·적용 이력·정책 정의를 재확인하고 기관의 백업/복구 수단을 확보한다. 실제 회원 자료를 개발용 파일에 복사하지 않는다.
2. 별도 Preview 대상과 인증 지원 방식을 확인한다. 현재 `preview` (`bfqwntulxabfrimcypvx`)가 생성됐고 업무용 migration 19개까지 검증했다. 인증 조건은 미충족이며 사용자는 별도 인증 서버 운영 설계를 선택했다.
3. 수정된 009·010과 이후 life_ migration을 포함한 승인 목록을 검토한다. 기존 모델의 정책/definer 뷰는 넓은 접근을 허용하므로 009·010만 적용한 상태를 운영 출시 상태로 사용하지 않는다. `20260918145727_anchor_core.sql`의 기존 API 권한 회수와 새 권한 체계까지 함께 확인한다.
4. Preview에서 migration 단위 transaction과 실패 중단이 보장되는 배포 경로로 실행한다. SQL Editor에서 DROP/CREATE를 따로 실행하지 않는다. 새 파일을 실행시키기 위해 `migration repair --status applied`로 이력만 맞추지 않는다.
5. 새 이력·정책·기존 API 차단을 확인하고 역할별 접근, 복구, MFA, 직접 Auth API 비밀번호 조건을 검증한다. 실패 시 다음 migration을 임의로 건너뛰지 않고 실패 상태를 기록한다.
6. 실제 증거로 배포 사전 검사 기록을 갱신한 뒤 운영 반영한다. 이번 소스 변경으로 이전 소스 지문은 달라지므로 과거 검사 결과를 새 빌드의 승인으로 재사용하지 않는다.

초기 재시도 수정 단계에서는 Git push, 원격 migration/이력 보정, Auth 설정 변경, 프로젝트 생성 또는 배포를 수행하지 않았다. 후속 작업에서는 승인된 Preview를 생성하고 최소 길이 12자를 설정했으며 업무 migration 11개를 공식 CLI로 적용했다. 이력 수동 보정·main 변경·Git push·앱 배포는 수행하지 않았다. [후속 검증 보고서](../04-report/features/anchor-preview-db-validation.report.md)
