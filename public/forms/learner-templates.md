# 수강생 작성 서식 템플릿

사용자가 제공한 `(양식)(개종강)수강신청원서&장학금지급신청서.pdf`의 1·2페이지와 `1. 수강료환불신청서.pdf`의 1페이지를 사용한다. 원본 크기는 모두 595 × 842 pt이다. 원본의 표, 색상, 글꼴, 고정 문구, 여백은 변경하지 않았다.

- `learner-application.pdf`: 원본 1페이지, 수강신청원서
- `learner-scholarship.pdf`: 원본 2페이지, 학습활동 우수 장학금 지급신청서
- `learner-refund.pdf`: 환불 신청서 원본 1페이지

수강신청·장학금 템플릿은 예시 과정명과 작성일을, 환불 템플릿은 미리 입력된 하단 연도를 입력 영역에서만 제거했다. 배경을 포함한 다른 내용은 그대로 보존한다.

- 기존 두 서식: `python3 scripts/prepare-learner-templates.py /path/to/original.pdf`
- 환불 서식: `python3 scripts/prepare-learner-refund-template.py /path/to/refund.pdf`

웹 작성기는 새 PDF 1.7 문서로 이 페이지를 복사하고, 한글 글꼴을 내장하여 값을 채운다. 서명을 포함하는 사용자의 입력값은 이 템플릿 파일에 저장하지 않는다.
