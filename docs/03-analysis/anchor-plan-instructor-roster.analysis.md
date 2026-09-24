# Gap Analysis: anchor-plan-instructor-roster

2026-09-24 · Design: `docs/02-design/features/anchor-plan-instructor-roster.design.md`

## Match rate: 100% (10/10)

1. 원문 16개 문서에서 이름이 정해진 강의·보조강사 43건을 그대로 대조했다. 고유 인물은 교내 9명, 교외 30명이다.
2. 이름·구분·소속으로 중복을 판단하고, 동명이인 정영은은 소속별로 분리했다. 미정 보조강사와 보조인력은 생성하지 않았다.
3. 기존 강사 pool 인물을 재사용했으며 새 외부 강사에게 로그인 연결이나 강사 역할을 자동 부여하지 않았다.
4. 비공개 원문 명단 테이블은 RLS를 적용하고 `anon`·`authenticated` 직접 SELECT 권한을 거부한다.
5. 16개 과정의 초기 책임강사는 첫 교내 강사 10개, 현용환 센터장 6개로 지정했다. 기존에 다른 실제 책임강사가 있으면 이관이 중단되도록 했다.
6. 개설된 기수의 실제 책임·출강만 연결했다. Preview 3개, Production 16개가 검증됐다.
7. Production에서는 실존하는 `CENTER_HEAD` 수동 구성원을 사용했고 Preview는 기존 초기 인물을 사용했다.
8. 구성원 강사 명부 조회에 ACTIVE pool 인물을 포함하되 쓰기 권한 범위는 그대로 유지했다.
9. 계정 미연결 표시와 강사 마스터 상세 연결을 추가했다.
10. Production의 기존 결과 문서 3건 및 이미 승인된 외부 강사 2명의 역할을 유지했다.

## 검증 및 차이

- SQL 마이그레이션은 Preview·Production에 적용됐다. 각각 원문 43행, 고유 39명, pool 40명(센터장 포함), 계획상 책임강사 16개를 확인했다. 새 원문 강사에게 연결된 Auth 계정은 0개다.
- `npm run lint`, `npm run build`, `npm run test:operation-prefill`, `git diff --check` 통과.
- `npm run test:core`는 기존 로컬 MFA fixture secret이 없어 시작 단계에서 중단됐다. 이번 변경에 의한 코드 실패는 확인되지 않았다.
- Preview의 미개설 13개 과정은 계획상 책임강사만 지정돼 있다. 실제 기수 개설 시 그 기수의 책임 연결을 별도로 확인해야 한다.
- Supabase 보안 어드바이저의 새 private 테이블 알림은 기존 private 테이블과 같은 `RLS enabled, no policy` 정보 수준이다. 직접 접근 권한도 제거했다.
