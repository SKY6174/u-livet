# 모집 안내 운영 문안 교정 설계

2026-10-17 · Feature `production-recruitment-notices`
Plan: `docs/01-plan/features/production-recruitment-notices.plan.md`

## 실제 운영 문안

실버푸드전문가과정 `be13635d-2625-4f81-ab2d-7f30551289d3`의 기존 정책은
`de334781-f135-4cdc-a85a-f109d4cc0f3f`이다. 기존 원문은 승인 후 불변으로 보존한다.
`docs/operations/silver-food-enrollment-2026-10-17.txt`를 관리자 화면에서 새
ENROLLMENT 버전 `SILVER-FOOD-2026-10-17-v1`으로 작성·승인한다.
본문은 DB의 2026-09-04~10-16, 30시간, 장소 1-302/1-331, 정원 10명,
접수 7월 4일~9월 2일 23:59(KST), 무료·선착순 정보와 기존 원서 개인정보 안내를 따른다.
SQL은 승인자를 대입하지 않는다. 승인·유효일·제목·LF 정규화 SHA-256을 확인한다.
대상이 없는 Preview는 교정을 건너뛰고, 기존 연결이 바뀌면 실패한다.
연결과 academic_revision만 교정하고 감사 이벤트를 한 번 기록한다.

## 재발 방지

제목·버전·본문에 `검증용`, `Issue숫자`, `dummy-숫자`, `fixture`가 있는 정책과
기존 ENROLLMENT 작성 요령 3줄만 들어 있는 정책을 운영 선택지에서 제외한다.
DB의 BEFORE INSERT/UPDATE(enrollment_policy_id, name, status) 트리거로
같은 검사도 적용하여 RPC와 직접 쓰기 경로를 보호한다. SQL 함수는 private
schema, security invoker, 빈 search_path이며 호출 권한을 공개하지 않는다.
이름이 `[검증용]`으로 시작하는 명시적 합성 검증 과정은 허용한다. 검증 정책이
연결된 합성 과정을 실제 과정명으로 변경하는 경우에는 검사가 적용된다.
기존 정책 자체나 동의 이벤트를 자동 변경하지 않는다. 오류는 관리자에게
실제 운영 안내를 새 버전으로 작성·승인하도록 안내한다.

## 검증

- 로컬 합성 SQL 롤백: 교정·재실행·문안/승인/연결/이름 검사와 증빙 불변.
- 트리거: 검증 제목/버전/본문, 작성 요령만 있는 정책, INSERT/UPDATE,
  합성 과정명→실제 과정명 변경 차단 및 정상 정책·명시적 검증 과정 허용.
- TS 필터와 실제 DB 분류 일치, 서버 액션의 사용자 오류 안내 검증.
- 공개 안내 16개 HTTP와 실제 화면 확인; 미공개·보관 과정의 상태·접수 기간은 보존.
- lint·Preview 빌드·마이그레이션, 운영 advisor 비교, 운영 SHA·health·로그 확인.
