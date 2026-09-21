# 계정 구분 관리 리스트 설계

2026-09-21 · anchor-account-list-layout

- 대상: `/admin/accounts`의 계정 분류 화면. 기존 역할별 메뉴 설계의 SYSTEM_ADMIN 검사와 life_manageable_accounts, saveAccountClassification을 유지한다.
- '교내 강사는 학교 이메일과 U-LIFE 전용 비밀번호…' 안내 박스 전체 제거. 페이지 제목·짧은 소개는 유지.
- 계정 목록은 한 개의 테두리 안에 ul/li 행과 구분선을 사용한다. 데스크톱에서는 이름·이메일 / 구분 선택 / 저장 버튼 순서로 정렬. 모바일에서는 한 행 안에서 위아래로 자연스럽게 배치한다.
- 각 행에 기존 ActionForm을 유지하며 hidden person_id, role 조건에 따른 office_position/instructor_kind, required/defaultValue, resetOnSuccess=false를 보존한다.
- ActionForm에 optional className만 추가한다. 미지정 폼은 기존 space-y-4 그대로 사용하고, 이 화면에서 grid 배치·상태 메시지 전체 폭을 지정한다.
- 여러 역할을 가진 계정은 직책과 강사 구분을 모두 표시한다. 긴 이메일은 줄바꿈, 저장 성공/실패 메시지는 해당 행 내부에 표시한다.
- 낮은 영향의 표시 수정이므로 새 자동 테스트는 작성하지 않는다. 기존 역할 검증과 production build, 합성 계정으로 데스크톱·390px 모바일 배치 및 기존 폼 저장/선택 유지 동작을 확인한다. 실제 사용자 계정 구분은 변경하지 않는다.
