# 수강생 내 정보 - 설계

## 화면과 흐름
- 헤더의 수강생 이름은 `/mypage/profile` 링크이며 모바일에도 동일하다. 법적 이름은 읽기 전용이다. 세션 만료 후 로그인해도 내 정보 주소로 돌아온다.
- 상단 요약에 현재 연락처를 표시한다. 필수 전화번호, 선택 별명·캐릭터를 한 번에 저장한다. 이메일은 별도 인증 요청으로 처리하고 확인 전에는 기존 주소와 대기 주소를 구분한다.
- 개인 사진은 선택 업로드/삭제. JPG·PNG·WebP, 2MB 이하이며 비공개 보관한다. 실패 시 기존 사진은 유지한다.

## 데이터·권한
- 전화번호의 원본은 `life_private.learner_contacts`; 프로필 화면과 수강생 서류가 동일 RPC로 읽는다. 번호 수정 시 확인 일시는 null로 유지한다.
- 별명, 캐릭터, 사진 경로는 신규 `life_private.learner_profile_preferences`에 사용자당 한 행으로 저장한다. 별명은 최대 24자, 캐릭터는 허용 목록으로 제한한다.
- 사진은 비공개 `learner-profile-photos` 버킷의 `<auth.uid()>/<uuid>.<ext>`에 저장. RLS가 본인 폴더의 업로드·조회·삭제만 허용한다. 공개 URL은 사용하지 않고 짧은 유효기간의 signed URL만 렌더링한다.
- `life_my_learner_profile`, `life_save_learner_profile`, `life_set_learner_photo`는 호출자 세션·연결된 수강생 계정을 검사하고 본인 데이터만 읽고 쓴다. 별명/캐릭터는 권한 판단에 사용하지 않는다. 직접 테이블 권한은 부여하지 않는다.
- 이메일 원본은 Auth 사용자. 변경은 `auth.updateUser({email}, {emailRedirectTo})`로 요청하며 인증 후 Auth가 원본을 바꾼다. `public.user_profiles.email`은 Auth 이메일 변경 트리거로 동기화한다. 다른 회원의 이메일·연락처 접근은 금지한다.

## 서버 구성
- `/mypage/profile`: 서버에서 Auth 사용자와 프로필 RPC를 조회. 프로필 사진은 signed URL을 생성한다.
- `src/app/mypage/profile/actions.ts`: 연락처/선택 필드 저장, 이메일 인증 요청. 서버에서 필수값·허용 목록·길이를 재검증하고 오류를 친절하게 반환.
- `/api/mypage/profile/photo`: POST는 인증 후 파일 MIME·매직 바이트·용량 검사, Storage 업로드, 사진 경로 RPC 저장 후 이전 파일 정리. DELETE는 경로 null 저장 후 기존 파일 정리. 요청자 ID를 경로에 사용하고 사용자 입력 경로는 받지 않는다.
- `getLearnerDocumentProfile`는 같은 RPC 연락처를 우선 사용해 서류 자동 입력을 최신화한다.

## 검증
- 빈 번호/잘못된 번호·별명 길이·허용되지 않은 캐릭터 거절.
- 세션 없는 요청, 다른 사용자 경로, 파일 형식 위장, 2MB 초과 거절.
- 사진 교체와 삭제, 이메일 확인 전/후 표시, 수강생 서류 번호 연동.
- lint, TypeScript, 빌드, DB 정책/함수 확인, 배포 검증.
