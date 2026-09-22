# Google 로그인 정보 최소화 설계

- 기존 `anchor-login-audiences.design.md`의 2026-09-20 최소화 절을 상세 설계로 적용한다.
- 변경 대상은 `social-actions.ts`의 Google 요청 옵션이다. `queryParams.scope=openid email`, `include_granted_scopes=false`로 요청하고 `options.scopes` 추가 방식은 사용하지 않는다.
- 미지정 제공자·사업단·교내 차단, PKCE 및 callback 검증은 그대로 사용한다. 이름 입력과 미인증 휴대폰 연락처 저장도 기존 가입 절차를 따른다.
- 기존 호출 테스트에 사진 권한 미요청·과거 범위 미합산 검증을 추가한다. Preview 재배포 후 실제 Google 로그인으로 반환 정보 및 저장된 메타데이터 키를 확인한다.
- 사진 URL은 화면/학습 프로필로 복사하거나 다운로드하지 않는다. OAuth callback에서 Google identity가 있는 계정의 과거 `picture`·`avatar_url` 사용자 메타데이터가 남아 있으면 Auth `updateUser`로 두 키만 제거한다. 관리자 DB 권한을 쓰지 않으며, 계정 식별자·이메일·이름·역할·동의·수강이력은 변경하지 않는다.
- 정리 후 `refreshSession`으로 새 세션 토큰에도 반영한다. 수정·세션 갱신 실패 시 해당 새 세션을 로그아웃하고 callback 오류로 안내한다. 사진이 없는 일반 로그인에는 추가 요청을 하지 않는다.
- v3 문안은 검토용 초안이다. 실제 최소화 결과와 일치해야 하며 기관 승인 전 DB에 APPROVED로 등록하지 않는다. 새 문안 등록 이후에도 과거 이용자의 동의 기록은 보존한다.
- 오류 시 Google 버튼 설정을 되돌릴 수 있게 하고, 인증 state·토큰·사진 URL 값은 보고서나 로그에 출력하지 않는다.
