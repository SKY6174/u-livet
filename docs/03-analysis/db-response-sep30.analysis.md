# Gap Analysis: db-response-sep30

> 2026-09-30 · [설계](../02-design/features/db-response-sep30.design.md)

## Match Rate: 90%

설계 10개 항목 중 배포 전 완료 9개. 남은 항목은 PR 병합 후 운영 마이그레이션 적용·사후 확인이다.

## 구현·검증

1. `person_id()` 1회 평가 CTE와 기존 기관·사용자·이메일 확인 조건을 유지했다.
2. JSON 필드·기관 정렬·관리자 집계·함수 보안 속성과 일반 `member_entry_orgs()` 함수를 유지했다.
3. 운영 이력과 이름이 같은 8개 마이그레이션의 파일명만 변경했다. Git rename 유사도 100%이며 SQL 본문 수정은 없다.
4. CLI dry-run은 새 마이그레이션 1건만 예정한다.
5. 운영 DB 읽기/롤백 비교에서 기존 세션 12개와 익명 1개 결과가 13/13 일치했다. 기존 유효 세션 9개 중 기관 관리자 8개, 최고 관리자 2개가 포함됐다.
6. 유효 세션의 교차 순서 12쌍(첫 2쌍 제외)에서 기존 함수 중앙값 12.626ms, 후보 4.732ms, 결과 12/12 일치였다. DB 내부 실행시간이며 최종 페이지 지연은 아니다.
7. 마이그레이션 파일 SQL도 운영 DB 트랜잭션에서 적용 후 ROLLBACK하여 구문과 함수 정의를 확인했다.
8. lint, `test:db-latency`, TypeScript, 프로덕션 빌드 통과.

## 남은 항목

- PR 병합, 운영 마이그레이션 적용, 운영 함수 정의·권한·헬스·revision 확인.

## 별도 발견

- 기존 `test:db-response` 스크립트는 없는 `@/components/classroom/class-questions` 모듈 참조로 시작하지 못한다. 이번 SQL 변경 검증에는 사용하지 않았다.
- `pg_stat_statements`의 `life_operation_list()` 누적 평균 약 459ms는 별도 경로다. 인증 함수 개선 후 새로운 구간 통계로 재평가한다.
