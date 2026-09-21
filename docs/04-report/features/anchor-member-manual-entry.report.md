# 구성원 수동 등록 반영 결과
2026-09-21 · anchor-member-manual-entry · 현용환 계정 연결 대기

- 구성원 수동 등록 버튼과 세 분류 등록 폼 추가. 등록 성공 시 DB 저장 후 목록으로 이동. 수동 명부 등록은 로그인 계정 발급과 구분한다.
- 수강생 표에 올해 수강과목 추가, 기존 전체 수강이력 유지.
- 송경영 kysong@uc.ac.kr 인증 계정만 최고 관리자. 이연향 yhlee4@uc.ac.kr은 이메일 인증 가입 후 수동 등록 권한 연결. 현용환은 사용자 이메일 답변 전까지 비활성 슬롯.
- DB migration: 20260921041014_anchor_member_manual_entry. 적용 대상 Preview bfqwntulxabfrimcypvx 및 운영 uoebygejgglgiivzgyks.
- 180개 검증, TypeScript/ESLint/build 통과. 개인정보·권한 원본 레코드 삭제 및 테스트 데이터의 원격 삽입 없음.

## 후속
현용환의 확인된 로그인 이메일을 받은 후 OPERATIONS 슬롯을 별도 migration으로 설정하고 기존 인증 계정 또는 향후 인증 가입 계정에 연결한다. 현재 이 항목 때문에 전체 권한 설정 완료로 표시하지 않는다.
