# 내 정보 확장 설계

## 화면
- 사업단과 강사에 공통 `AccountInfo` 카드를 사용한다. 이름·계정 구분·로그인 이메일과 6개 상세 항목을 표시한다.
- `내 정보 수정`을 열면 현재값을 채운 폼이 표시된다. 저장 성공·실패를 알리고, 실패 시 입력을 유지한다.
- 번호·이메일·소속·직책은 선택 입력이며 빈값 저장으로 지울 수 있다. 이름과 로그인 이메일은 읽기 전용이다.
- 모바일은 한 열, 넓은 화면은 두 열로 배치한다. 강사 카드의 기존 업무 링크와 교외 주차권 링크는 유지한다.
- 수신 설정은 수강생만 표시한다. 직접 URL 접근도 역할에 따라 본인 공간으로 돌려보낸다. 동의 이력 상세 목록은 렌더링하지 않는다.

## 데이터와 권한
- `life_private.account_profiles`: person_id PK/FK, school_email, personal_email, affiliation, job_title, updated_at. RLS 활성, 직접 접근 권한 없음.
- 기존 `member_profiles`의 mobile_phone·office_phone를 원본으로 사용한다. 저장 시 revision 증가, updated_by 기록. 강사의 instructor_phone도 같은 번호로 갱신해 강사 명부 연락처와 일치시킨다.
- 학교·개인 이메일은 연락용으로 저장하며 Auth 이메일 변경은 하지 않는다. 미입력 학교/개인 이메일과 직책 초기값은 로그인 이메일 도메인/기존 직책을 통해 보여준다. 프로필이 저장된 이후 명시적인 빈값은 유지한다.
- 직책은 자유 입력 표시값이며 account_classifications·역할·승인된 직책을 변경하지 않는다.
- 공개 RPC는 SECURITY INVOKER wrapper, 내부 SECURITY DEFINER 함수는 빈 search_path·현재 person_id를 검사한다. 대상 person_id를 사용자 입력으로 받지 않는다. 익명·service_role의 실행 권한은 회수하고 authenticated만 wrapper 호출 가능하다.
- DB와 서버 모두 휴대폰·전화·이메일 형식, 이메일 254자, 소속 100자, 직책 100자를 검사한다.
- 저장 후 관련 화면과 명부를 재검증한다. 등록 번호가 인증 전화번호나 홍보 수신 동의로 간주되지 않는다.

## 검증 및 운영
- DB 트랜잭션 내 가상 본인 2명·익명 역할로 저장·수정·빈값·입력 거절·격리·직책 권한 불변 검증하고 rollback한다.
- 컴포넌트 렌더링과 브라우저로 사업단·교내/교외 강사의 상세 표시·수정 폼·버튼 제거·모바일 넘침을 확인한다.
- lint, TypeScript, production build 통과 후 PR 병합. 운영 DB에는 추가 마이그레이션만 적용한다.
- 배포의 Git SHA, READY, 운영 `/api/version` 및 응답 상태를 검증한다.
