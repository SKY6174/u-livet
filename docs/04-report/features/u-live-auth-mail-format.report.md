# U-LiVE 인증 메일 포맷 완료 보고

2026-09-27 · [계획](../../01-plan/features/u-live-auth-mail-format.plan.md) · [설계](../../02-design/features/u-live-auth-mail-format.design.md) · [점검](../../03-analysis/u-live-auth-mail-format.analysis.md)

UC 앵커의 간결한 안내 형식을 참고해 U-LiVE 회원가입 확인, 최초 비밀번호 설정, 비밀번호 재설정 메일의 제목·본문·버튼·서명을 통일했다. 기존 초대 및 복구 token hash 경로는 유지했다.

검증: Python HTML/TOML 파싱으로 세 링크·설정 경로·브랜드 표기를 확인했고 `git diff --check`를 통과했다. 설계 일치율은 8/8이다.

운영 Supabase Dashboard의 템플릿 등록과 실제 수신 확인은 별도 운영 적용이 필요하다. 로컬 회원가입 확인 발송 설정은 변경하지 않았다.

## 2026-09-30 비밀번호 재설정 메일 새 창 적용

대학 xClick 메일보기 팝업에서 재설정 링크가 프레임 안에 열려 `X-Frame-Options: DENY`에 차단되는 사례를 확인했다. 복구 메일 버튼에 `target="_blank"`와 `rel="noopener noreferrer"`를 추가하고, 메일 클라이언트가 이를 무시할 때 새 탭에서 여는 방법을 안내했다. 링크의 SiteURL·경로·TokenHash fragment는 유지했다.

운영 Supabase의 Reset password 템플릿을 저장했고 성공 알림을 확인했다. 설정 화면을 다시 연 뒤 새 창 속성과 안내 문구가 저장된 것을 확인했다. 실제 xClick에서 새 메일을 수신·클릭하는 검증은 아직 수행하지 않았다.
