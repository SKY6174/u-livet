# U-LiVE 인증 메일 포맷 점검

2026-09-27 · [설계](../02-design/features/u-live-auth-mail-format.design.md)

## 설계 일치율: 100% (8/8)

1. 회원가입 확인, 초대, 복구 메일의 공통 레이아웃과 U-LiVE 표기 적용.
2. 세 종류의 제목과 Supabase `content_path` 등록.
3. 회원가입 확인에 native `ConfirmationURL` 사용.
4. 초대 token hash fragment와 기존 `/auth/accept-invitation` 경로 유지.
5. 복구 token hash fragment와 기존 `/auth/reset-password` 경로 유지.
6. 초대·복구 15분/1회, 요청하지 않은 경우, 링크 공유 금지 안내 유지.
7. 템플릿에 사용자 메타데이터나 비밀번호 출력 없음.
8. HTML 파싱·TOML 파싱·링크 대조·`git diff --check` 통과.

운영 Supabase Dashboard 등록과 실제 수신 검증은 이번 Git 변경에 포함되지 않는다. 로컬 설정은 회원가입 이메일 확인을 켜지 않았으므로 확인 메일은 해당 설정이 활성화된 환경에서만 발송된다.
