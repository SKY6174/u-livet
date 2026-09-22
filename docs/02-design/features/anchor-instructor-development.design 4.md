# 강사 이력·과정 개발 상세설계

2026-09-19 · `anchor-instructor-development`. [계획](../../01-plan/features/anchor-instructor-development.plan.md).

사용자 확정: **강사 등록·자격 심사 기준은 아직 미확정 — 기준 등록 후 사용**. 예시 등급·시급·세율을 운영값으로 넣지 않는다.

## 등록 준비 상태 수정 (2026-09-20)
- 운영·Preview에 INSTRUCTOR_PRIVACY와 INSTRUCTOR_REVIEW가 모두 없는 것을 읽기 전용 조회로 확인했다. ACCOUNT_PRIVACY는 강사 이력 수집 동의를 대체하지 않는다.
- 최초 초안과 보완 새 버전은 같은 등록 컴포넌트를 사용한다. 해당 기관의 유효 개인정보 안내와 심사 기준이 모두 있을 때만 동의·제출 양식을 보여 준다. 미등록 시 누락 항목과 사업단 문의처를 표시하여 빈 필수 선택창에 갇히지 않게 한다.
- 선택 가능한 안내문이 하나이면 자동 선택하고 본문을 펼친다. 개인정보 동의 체크박스는 이용자가 직접 선택한다. 여러 문안이면 명시 선택을 유지한다.
- DB의 승인 정책·본인 동의·기관·권한 검사와 제출 후 이력 불변성은 유지한다. 검토 초안은 별도 문서로 작성하며 기관 승인 전 DB의 APPROVED 상태로 등록하지 않는다.

## 구조·접근

기존 Next Server Components/Actions → 사용자 인증 RPC → 비공개 life_private 함수 구조를 사용한다. 원장은 RLS 활성·직접 GRANT 회수, 함수 고정 search_path·최소 EXECUTE. user_metadata로 권한을 부여하지 않는다. 직접 공개되는 것은 공개 기수의 동의된 최소 강사 소개 RPC뿐이다.

- `/mypage/instructor`: 기존 강사 역할이 없는 회원도 본인 이력 등록·심사·선택 공개 설정 가능. 기관에 승인 INSTRUCTOR_PRIVACY·INSTRUCTOR_REVIEW 정책이 있을 때 신규 작성 허용.
- `/admin/instructors`: 기관 COURSE_MANAGER의 심사 목록/상세. 다른 사람의 미제출 초안은 열람하지 못한다.
- `/development`, `/development/[id]`: 기관 INSTRUCTOR 또는 유효한 본인 이력 승인자가 신규/개편 제안을 작성한다. 작성자는 자기 자료, COURSE_MANAGER는 제출된 자료를 검토한다. 역할 상실 후에도 본인 과거 자료 열람·제출 철회는 허용하며 신규 작성/수정/제출은 차단한다.
- `/admin/development`: 사업연도별 개발/개편 승인 현황. 승인된 과정 버전으로 기수 초안 개설. 실제 모집 공개는 기존 정책·수납 절차를 거친다.
- 강사 홈/나의 공간/관리자 홈 링크, 기존 `/instructor/syllabus`는 `/development`로 연결. 공개 소개는 `/offerings/[id]`에만 표시한다.

## 강사 이력 모델

`life_instructor_dossiers`: 기관+본인 유일 root, 공개여부·공개동의 정책/시각·revision. 이름은 life_people 공통 신원에서 읽고 지급정보를 저장하지 않는다.

`life_instructor_dossier_versions`: root별 version, DRAFT/SUBMITTED/CHANGES_REQUESTED/REJECTED/APPROVED/WITHDRAWN, optimistic revision, payload, 개인정보 안내/심사 기준·확인시각, 제출시각, 결정자·사유·유효일까지. 제출 이후 내용은 불변이며 보완·정정은 이전을 복사한 새 버전이다. 최신 DRAFT/SUBMITTED 하나만 허용하며 root 잠금으로 동시 새 버전을 막는다. 최신 버전만 현재 승인이 될 수 있어 새 작성 시 이전 공개·제안 자격은 재검토된다. 자기 승인/반려/보완 금지, SUBMITTED만 심사한다.

payload는 허용키만 받는다: specialty(200), introduction(2000, 심사용), public_intro(1000, 공개 후보). claims 최대20개: kind EDUCATION/CAREER/TEACHING/QUALIFICATION, title(200), organization(200), started_on/ended_on/expires_on(선택 날짜), evidence(500, 사업단 확인용 문서 참조). 기관·명칭·증빙 참조는 필수, 미래 시작/종료 및 역전 기간 금지. 최소1개 이력 근거를 제출한다. 원본 파일·주민번호·계좌·자격증 전체번호는 수집하지 않는다. 참고 문서는 문자열로 표시하며 링크를 자동 열거나 다운로드하지 않는다.

승인 담당자는 제출 이력 모두의 외부 증빙을 확인했다는 명시 확인과 심사 근거, 유효기간을 입력한다. 자격 만료보다 긴 승인 기간은 금지한다. 만료·새 버전·활성 계정/인증연결 해제·정책 무효는 현재 승인 효력을 제한한다. 자가신고 이력, 확인 완료 버전, 확인 유효기간을 화면에서 구분한다. 확인은 증빙 검토 기록이며 국가 자격기관의 자동 진위조회가 아니다.

본인만 공개 설정을 켜고 끈다. 활성화는 현재 승인·유효 INSTRUCTOR_PUBLIC 정책·명시 동의·revision 필요. 철회는 승인 없이 즉시 허용한다. 공개 RPC는 기수 공개 상태, 실제 배정·INSTRUCTOR 역할 유효, 현재 이력 승인·활성 인증 계정·공개 정책을 확인하여 이름/specialty/public_intro만 반환한다. 과거 개인정보·claims/증빙/연락처/내부 ID는 공개하지 않는다. 동의 철회·정책 만료·배정 해제 시 즉시 숨긴다.

이력 승인으로 INSTRUCTOR 역할·위촉·계약을 자동 생성하지 않는다. 실제 위촉 확인 후 기존 신뢰된 DB 역할 등록과 과정담당의 기수 배정을 사용한다. 강의 경력증명은 기존 확정 강의실적만 사용한다.

## 과정 개발 모델·흐름

`life_course_proposals`: 기관/작성자/사업연도, NEW 또는 REVISION, 개편 대상 course_id(동일 기관, 강사가 열람할 수 있는 실제 과정), 생성일. 개발 유형·귀속연도는 root 고정.

`life_course_proposal_versions`: root별 version·revision·상태·payload·DEVELOPMENT/COMPLETION 정책·제출확인, 결정 근거·시각·담당자, 생성된 course_version_id, 철회시각/사유. DRAFT → SUBMITTED → APPROVED/CHANGES_REQUESTED/REJECTED, 본인 WITHDRAWN. 제출 이후 내용 불변, 새 버전 복사. 최신 버전 하나만 작성/제출, 이전 미결 초안을 건너뛰지 않는다. 승인 후 새 버전은 같은 과정의 후속 개편이다. 승인 취소는 기존 기록을 남기고 신규 기수 개설/공개를 차단하며 이미 운영된 기수를 지우지 않는다.

payload: title(200), academy(100), summary(3000), rationale/target/outcomes/prerequisites/assessment/materials/budget 각 최대2000, capacity(1..1000), theory_minutes/practice_minutes(0..60000, 합계1..60000). sessions 최대60개, 각 title/content/equipment/assessment 문자열과 minutes(1..1440), method THEORY/PRACTICE. 총 차시시간과 이론/실습 시간 합계가 정확히 맞아야 제출 가능하다. 강사의 평가안은 제안이며 실제 수료 산식은 기존 별도 승인 절차를 따른다.

제출/승인은 유효 DEVELOPMENT/COMPLETION 정책과 작성자의 현재 제안 자격을 다시 확인한다. 과정담당 본인이 작성한 제안은 승인할 수 없다. 승인 트랜잭션은 root·과정 행을 잠그고 NEW이면 course 생성, 같은 course의 다음 버전 생성, 제안 결정까지 함께 수행한다. 반복 승인 호출은 같은 course_version_id를 반환한다. 승인 과정 version의 summary/curriculum/정책은 불변이다. 기존 직접 개설 방식은 유지하며 개발 심의 이력을 소급 생성하지 않는다.

`life_development_openings`: 요청 UUID·제안 승인본·기수·개설자·시각. 현재 승인본을 선택해 이름·사업연도(제안 귀속연도와 별도 선택 가능, 동일 기관)·기간·장소·모집 방식을 넣으면 DRAFT 기수를 생성한다. 정원은 승인안 이내, 교육일은 선택 사업연도 안, 접수 마감≤개강일의 다음날. 요청 UUID 중복은 같은 기수를 반환한다. 같은 승인 과정을 여러 기수로 운영해도 개발 건수로 중복 집계하지 않는다.

기존 publish 흐름에 연결된 개발 승인본의 유효성·수료정책 일치를 검사한다. 개발본은 승인자를 덮어쓰지 않는다. 전체 공식 연차지표 산식은 변경하지 않고 사업연도별 승인 개발/개편 버전 원장을 내부 참고로 제공한다. 새 기수 이름과 기존 과정 원본 제목을 구분한다.

`life_instructor_development_events`: 기관/주체/대상/행위/사유/시각의 변경 불가 이력. 신청·공개 동의·결정·개설 이력. 본인과 기관 담당자에게 해당 건만 제공한다.

## RPC와 검증

이력: instructor_options/dossier, start/save/submit/decide/withdraw_dossier, set_instructor_public, public_instructors. 과정: development_board/detail, start/save/submit/decide/withdraw/revoke_development, open_development. 공개 wrapper는 life_ 접두어 security invoker, 실제 비공개 함수에서 auth·기관·본인·현재 역할을 검사한다. DB 입력 검증은 Server Action을 우회한 직접 RPC에도 동일 적용한다.

실제 로컬 Auth/RPC로 다른 기관/본인/초안 침범, JSON 미허용키·기간·차시시간, 최신revision충돌, 제출불변·보완이력, 자기승인, 정책/계정/역할 만료, 공개철회·비공개필드, 승인과정 불변·개편·동시승인·멱등개설·기수수와 개발수 분리를 검사한다. 기존237개 회귀,19개 전체 migration 재생, security advisor, lint/build, 브라우저 등록→보완→승인→제안→승인→기수개설과 모바일 확인.

운영 원격 변경·실제 정책 등록·문자 발송·강사료/계약·외부 조회·파일 업로드·파기 작업은 수행하지 않는다. 큰 목록은 최근100개+더 있음 안내로 제한하고, 대용량 검색/페이지네이션은 후속이다.

근거: [Supabase 함수](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security). 2026-09-19 changelog 확인, 이번 RPC/RLS 사용에 해당하는 breaking change 없음. 기존 프로젝트의 CLI 생성 timestamp migration 규칙을 유지한다.
