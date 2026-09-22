# 네이버 로그인 검수 테스트 설계

작성일: 2026-09-22. 기존 `anchor-login-audiences`와 `anchor-social-auto-routing` 설계를 확장한다.

## 실제 인증 흐름

기존 네이버 버튼 → 서버 액션 → Supabase `custom:naver` → 네이버 인증·정보 제공 동의 → Supabase callback → U-LIFE callback → 기존 회원의 목적지 또는 최초 가입 정보·동의 화면.

- 기존 Client ID/Secret은 Supabase 설정에서 유지한다. 비밀값을 Git·브라우저·로그에 복제하지 않는다.
- Supabase가 호출하는 GET `/api/auth/naver/userinfo`는 Bearer 토큰을 고정된 네이버 `/v1/nid/me` HTTPS 주소로 검증한다. 임의 URL·query token·쿠키를 사용하지 않는다.
- 5초 제한, 리다이렉트 금지, no-store. 응답은 `resultcode=00`이고 유효한 문자열 `response.id`와 이메일이 있어야 한다.
- 성공 응답은 `sub`, `email`, `email_verified:false`만 포함한다. 네이버는 확인 상태를 제공하지 않으므로 확인 여부를 조작하지 않는다. 이름·사진·성별·생년월일 등은 저장하거나 반환하지 않는다.
- 인증되지 않은 토큰은 401, 네이버 장애·잘못된 응답은 502, 이메일 미제공은 422로 일반화한다. 원문·토큰은 로그에 남기지 않는다.
- 사용자 정보 매핑은 평탄한 `sub`/`email`을 사용한다. 보호 필드 `email_verified`는 매핑하지 않고 응답의 false를 그대로 읽는다. 네이버에 불필요한 OIDC scope를 요청하지 않는다.
- Supabase `provider_email_needs_verification`은 취소와 구분해 이메일 확인 후 재로그인을 안내한다. 메일 인증 설정을 느슨하게 바꾸거나 기존 계정의 이메일 확인을 강제하지 않는다.
- 회원 가입 완료·역할·MFA·QR next 검사는 기존 서버 경로를 유지한다.

## 개인정보 안내

- 새 `ACCOUNT-2026-09-22-v5` 문안에 네이버 회원 식별자·동의한 이메일, 목적, 처리자, 동의 거부 대안, 네이버 정책 링크와 연결 해제를 추가한다.
- 실제 SYSTEM_ADMIN을 확인하고 새 승인 버전을 추가한 뒤 운영 가입 포인터만 바꾼다. 이번 사용자 요청을 변경 근거로 기록하며 별도 문안 검토 응답을 받았다고 기록하지 않는다.
- 이전 승인 문안과 동의 이벤트를 유지한다. 새 동의는 가입자가 가입 화면에서 직접 한다.

## 검증과 배포

- 변환 경로: 정상·잘못된 인증·정보 누락·네트워크 실패·원문 미노출·정보 최소화 검증.
- OAuth callback: 이메일 확인 안내, 취소, 신규·기존 회원, QR 복귀 및 역할 제한 회귀 검사.
- lint/빌드 후 설정과 운영 배포를 적용하고 실제 네이버 로그인 화면 및 `/privacy` v5 노출을 확인한다.
- 실 계정 비밀번호 입력·동의 이후 검증 여부는 인증 화면 도달 확인과 분리하여 기록한다.

공식 근거: https://developers.naver.com/docs/login/profile/profile.md · https://developers.naver.com/docs/login/api/api.md · https://supabase.com/docs/guides/auth/custom-oauth-providers · https://github.com/supabase/auth/blob/master/internal/api/provider/custom_oauth.go
