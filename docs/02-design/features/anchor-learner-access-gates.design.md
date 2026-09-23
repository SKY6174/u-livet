# 수강생 로그인·후속 서류 자격 - Design

> Version: 1.0.0 | Date: 2026-09-23 | Status: Approved | Level: Dynamic

## UI

`SocialLogin`은 소셜 로그인 버튼을 기본 영역에 유지한다. 하단 행에는 왼쪽에 개인정보 처리 안내 링크, 오른쪽에 `이메일로 로그인` 토글을 둔다. 토글을 열면 기존 이메일 폼을 같은 카드 안에 표시한다.

`LearnerDocumentEditor`는 서버에서 받은 과정별 자격을 기준으로 탭을 제어한다. 환불 탭은 승인된 수강신청원서가 하나 이상 있을 때, 장학금 탭은 승인 원서와 유효한 수료 승인이 함께 있는 과정이 하나 이상 있을 때 활성화한다. 각 후속 서류의 과정 선택 목록에는 실제 자격이 있는 과정만 표시한다.

## DB

- `life_private.learner_document_application_approved(person, offering)`은 동일 과정의 `APPLICATION` 요청 중 `APPROVED` 또는 `COMPLETED` 존재 여부를 반환한다.
- `life_private.learner_document_completion_approved(person, offering)`은 `READY` 결과, 승인 행, ACTIVE 등록, 현재 academic revision, sealed 학사, 유효한 COMPLETION 정책을 모두 확인한다.
- `life_learner_document_eligibility()`는 로그인한 수강생의 승인 원서가 있는 과정과 환불·장학금 가능 여부를 반환한다.
- `submit_learner_document`는 멱등 재시도 확인 뒤, 새 `REFUND`·`SCHOLARSHIP` 제출에 승인 원서가 있는지 검사한다. `SCHOLARSHIP`은 수료 승인도 추가 검사한다.

## 오류

| 코드 | 안내 |
|---|---|
| `APPLICATION_APPROVAL_REQUIRED` | 승인된 수강신청원서가 있는 과정만 신청할 수 있습니다. |
| `COMPLETION_APPROVAL_REQUIRED` | 수료 인정이 완료된 과정만 장학금을 신청할 수 있습니다. |

## 검증

- 승인 전 환불·장학금 제출 거부
- 원서 승인 뒤 환불 제출 성공
- 수료 승인 전 장학금 제출 거부, 유효한 수료 승인 뒤 성공
- 다른 수강생의 승인 문서로 자격을 얻지 못함
- 로그인 하단 배치, 비활성 탭, 사유 안내의 브라우저 확인
- TypeScript, ESLint, production build, DB 통합 검증

