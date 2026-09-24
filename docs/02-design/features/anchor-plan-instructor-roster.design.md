# 2026 운영계획서 강사 pool 및 책임강사 설계

2026-09-24 · 근거: `docs/2026년 RISE사업 평생직업교육과정 운영계획서/` MD 16개와 그 구조화 추출본 `docs/operations/2026-course-opening-plans.json`.

## 데이터

- 강의 담당 및 보조강사 43개 기재, 이름·구분·소속 조합으로 고유한 39명(교내 9명, 교외 30명). `미정` 보조강사·보조인력은 제외. 동일 이름 정영은은 소속이 다른 두 개 원문 기재이므로 분리하고 인물 확인 전 자동 병합하지 않는다. 김정현은 같은 소속의 강의·보조 기록을 하나의 인물로 묶는다.
- 신규 외부 인물만 `life_people`과 `life_private.instructor_pool`에 생성. 기존 교내 9명, Production의 조경호·우철호를 재사용. 빈 소속·직무만 원문으로 보충하고 관리자가 입력한 값과 로그인 신원은 덮어쓰지 않는다. 각 등록에 원본 출처를 메모한다.
- 원본 과정과 인물의 관계는 새 private 테이블 `instructor_plan_roster`에 과정·순서·강의/보조 구분으로 기록한다. 로그인·실제 강의 배정과 구별한다. RLS 및 직접 접근 차단. 원본 명단은 43행, 과정은 16개.
- 강사 역할이 있는 첫 교내 교원을 16개 과정의 `life_course_guides.initial_responsible_id`로 지정한다. 교외 전용 여섯 과정은 센터장을 지정한다. 실제 개설된 기수에만 `life_operation_responsibilities` 및 책임강사 출강 연결을 적용한다. 현재 Preview는 3개, Production은 16개 기수가 개설되어 있다. 운영 DB에서 조직 소속의 `CENTER_HEAD` 수동 등록 인물 하나가 명확히 있으면 그 인물을 사용하여 초기 책임강사를 정정한다. Preview에서는 기존 초기 인물 사용. 센터장은 책임강사 대상 역할·pool 분류와 기수 배정을 갖되, 원문 실강의 roster에는 넣지 않는다. 이미 다른 책임강사가 있으면 중단하고 확인한다. 제출 문서 내용·상태는 수정하지 않는다.

## 조회

- `member_affiliations()`에 pool의 조직 연결을 포함한다.
- `member_scope_for(false)`는 ACTIVE pool 인물을 강사 조회에 포함하되, `member_scope_for(true)`의 기존 관리 권한은 유지한다. pool 전용 인물을 수강생으로 분류하지 않는다.
- `member_directory()`는 pool 분류·메모를 대체값으로 사용하고 `is_pool_only`를 반환한다. `/admin/accounts?group=instructor`에서 pool 전용 인물은 ‘계정 미연결’로 표시하고 강사 마스터 상세 페이지로 연결한다. 이메일·연락처가 없으면 —로 표시한다.

## 검증

- 원본 16개/강사 기재 43개/고유 39명, pool 내부9·외부30 및 센터장1. 계획 책임은 첫 교내10·센터장6, 실제 기수 책임은 Preview 3개·Production 16개.
- Production 기존 교외2명 재사용, 기존 수동 구성원 및 제출 기록 보존. Preview와 Production 결과 비교, 수기 계정 없이 명부 조회에 pool 전용 인물이 노출됨 확인.
- 새 인물 auth link 0, 신규 교외 INSTRUCTOR 역할 0, private RLS·권한 확인. 관리자·비관리자 조회 제한 확인.
- 관련 테스트, lint, 타입 검사, build, SQL 검증, Preview·Production 적용, git push 및 배포 상태 확인.
