# Issue 171: 과정 등록 아카데미 및 수강료 설계

계획: `docs/01-plan/features/issue-171-course-pricing.plan.md` · 2026-10-13

## 폼

- 과정 안내 수정에 쓰는 네 아카데미를 `COURSE_ACADEMIES`로 공유한다. 등록 폼을 필수 select로 바꾸고 원문/저장본의 기존 선택값을 유지한다. 네 항목 밖의 기존 값은 복원을 위해 해당 옵션을 추가한다.
- 작은 클라이언트 `DraftTuitionFields`는 `fee_type`(FREE/PAID)와 `tuition`(원)을 관리한다. 무료 입력은 읽기 전용 0원, 유료는 필수 정수 1~100,000,000원이다. 유료/무료 전환 중 금액을 유지하지만 무료 제출값은 0원이다.
- 기본은 무료이며 계획서 산식은 자동 적용하지 않는다. 유료 공개 전 환불 규정·납부 안내 설정을 안내한다.

## 검증 및 임시저장

- `OpeningValues`에 선택적 가격 필드를 추가해 기존 13개 항목 저장본을 보존한다. 새 FormData는 두 가격 필드를 포함한다.
- 가격 구분·형식·범위·무료/금액 불일치를 모델에서 검사한다. 임시저장에서는 유료 금액 미정(빈값)을 허용하고, 실제 등록에서는 양수 금액을 필수로 검사한다.
- DB `valid_opening_copy`의 기존 필수 항목과 날짜 검증을 보존하면서 같은 선택적 가격 검증을 추가한다. 새/이전 payload, revision 충돌 및 작성자 격리를 유지한다.

## 원자적 등록

- 새 `life_create_offering_with_tuition` RPC에 기존 생성 인자, integer tuition, 선택적 source_id를 전달한다. 이전 두 등록 RPC는 그대로 둔다.
- public SECURITY INVOKER가 private SECURITY DEFINER를 호출한다. private 함수는 auth.uid·최근 인증·기관 COURSE_MANAGER·금액 0~100,000,000원을 확인하고, 기존 create_offering/create_source_offering을 호출한다.
- 새 DRAFT 행의 수강료를 같은 트랜잭션에서 반영하고 audit에 기록한다. 실패 시 과정·버전·기수·원문 연결 모두 롤백한다. 입력된 기존 기수 ID를 받아 임의 변경하는 경로는 추가하지 않는다.
- 고정 search_path, PUBLIC/anon/service_role 실행 회수 및 authenticated 실행 권한을 사용한다. 기존 유료 publish/finance 검증은 그대로 둔다.

## 확인과 릴리스

모델·액션·SSR·기존 임시저장/prefill 회귀를 검증한다. 로컬 DB 트랜잭션에서 무료/유료·원문 연결·잘못된 가격·다른 기관/역할·익명·원자성·유료 공개 보호·임시저장 복원을 확인하고 롤백한다. 브라우저에서 실제 클라이언트 전환/validation과 360px 배치를 확인한다. migration은 운영 기존 데이터를 변경하지 않고 함수만 추가/수정한다. DB 적용 후 PR 검사·병합·운영 revision/health를 확인한다.

참고: [Supabase database functions](https://supabase.com/docs/guides/database/functions), 기존 `anchor-opening-working-copy.design.md` 및 `anchor-course-opening-prefill.design.md`.
