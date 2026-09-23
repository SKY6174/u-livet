# 강사 수업 현황과 수강생 질문 설계

2026-09-23 · [계획](../../01-plan/features/anchor-instructor-home-questions.plan.md)

## 데이터와 권한
- `life_private.class_questions`: UUID, offering_id, learner_id, visibility(PRIVATE/COURSE), 질문 본문·작성시각, 답변 본문·담당 강사·답변시각. 본문 길이와 답변 열의 일관성을 DB 제약으로 확인한다. private schema의 RLS를 켜고 직접 table 접근을 회수한다. 과정/작성자/미답변 인덱스를 둔다.
- `life_private.class_questions(f)`는 현재 담당 강사에게 해당 과정 전체, 활성 수강생에게 본인 질문과 공개 질문만 반환한다. 다른 수강생의 ID·이름은 공개하지 않고 '수강생'으로 표시한다. 작성자에게는 '내 질문', 강사에게는 실명과 공개 범위를 표시한다.
- `life_private.ask_class_question(f,body,visibility)`는 인증된 활성 수강만 허용한다. 기본 공개 범위는 UI에서 PRIVATE, DB에서는 지정된 두 값만 허용한다. 공백 제거 뒤 1~2000자, 과정당 시간당 10건 제한을 둔다. 등록 후 공개 범위는 변경하지 않는다.
- `life_private.answer_class_question(q,body)`는 질문의 과정에 현재 배정되고 해당 기관 INSTRUCTOR 역할을 가진 계정만 허용한다. 공백 제거 뒤 1~5000자; 기존 답변 수정도 가능하며 변경을 감사 기록에 남긴다. 질문 작성자·다른 수강생의 답변은 거부한다.
- public RPC는 security invoker 래퍼, private 함수는 definer와 빈 search_path로 구현한다. authenticated만 public RPC와 그 내부에서 호출되는 private 함수를 실행할 수 있다. private 스키마는 Data API에 노출하지 않고 각 함수 안에서 사용자·과정 권한을 확인한다. anon·PUBLIC 실행은 회수한다. 사용자/과정 권한은 life_private.person_id/enrolled/teaches를 재사용한다. 감사에는 질문 본문을 기록하지 않는다.
- `life_private.instructor_home_summary()`는 현재 본인이 맡고 실제 INSTRUCTOR 역할이 유효한 과정의 ID, 활성 수강생 수, 종료된 정상 차시 수, 종료 차시의 출결 기록 수, 미답변 질문 수만 반환한다. 작성자 개인정보나 다른 강사의 과정은 반환하지 않는다. 강사 `/`와 `/instructor`가 이 요약을 재사용한다.

## 화면과 액션
- 강사 `/`는 공개 과정 조회를 생략하고 담당 과정별 수강생·종료 차시·출결 기록·미답변 질문 요약을 상단에 표시한다. 각 수업의 운영 화면·출석부·질문으로 바로 이동한다. 배정 없음과 조회 실패를 구분한다.
- My Room은 담당 수업 요약을 기존 업무 단계 안내보다 앞에 배치한다. 기존 계정 정보·과정 카드·QR·출석 경로는 유지한다.
- 수강생 `/learning/[id]`는 활성 수강 검사를 통과한 뒤 질문 작성 폼과 접근 가능한 질문/답변을 표시한다. 공개 범위 선택은 1:1 비공개를 기본값으로 한다. 강사 `/instructor/offerings/[id]`에는 미답변 질문과 답변 폼을 표시한다. 같은 강좌의 다른 수강생에게는 공개 질문과 답변만 보인다.
- Server Action은 UUID·본문·공개 범위를 선검증하고, DB RPC의 권한 검사를 다시 통과해야 저장한다. 성공 후 해당 강의실과 강사 화면을 재검증한다. 조회 실패를 빈 목록이나 0건으로 표현하지 않는다.

## 검증과 배포
- 로컬 격리 DB에서 활성/철회 수강생, 현재/만료 강사, 타 기관·타 과정·비로그인, 공개/비공개 읽기, 질문/답변 변경, 길이·속도 제한, 감사 본문 비노출을 확인한다.
- 역할별 홈 렌더링에서 관리자·강사 공개 과정 조회 생략, 수강생 기존 과정 카드 유지, 강사 배정 과정 범위와 실패/빈 상태를 검증한다. 수강생/강사 강의실 폼, 공개 범위, 답변 표시, 모바일 배치와 lint/type/build를 확인한다.
- 새 migration 하나를 Preview에 먼저 적용하고 검증한 뒤 운영에 적용한다. 앱 배포는 두 DB에 필요한 RPC가 준비된 후 진행한다. 실제 질문·출석·수강 자료는 테스트에 사용하지 않는다.
