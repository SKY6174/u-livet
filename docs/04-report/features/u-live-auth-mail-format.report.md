# U-LiVE 인증 메일 포맷 완료 보고

2026-09-27 · [계획](../../01-plan/features/u-live-auth-mail-format.plan.md) · [설계](../../02-design/features/u-live-auth-mail-format.design.md) · [점검](../../03-analysis/u-live-auth-mail-format.analysis.md)

UC 앵커의 간결한 안내 형식을 참고해 U-LiVE 회원가입 확인, 최초 비밀번호 설정, 비밀번호 재설정 메일의 제목·본문·버튼·서명을 통일했다. 기존 초대 및 복구 token hash 경로는 유지했다.

검증: Python HTML/TOML 파싱으로 세 링크·설정 경로·브랜드 표기를 확인했고 `git diff --check`를 통과했다. 설계 일치율은 8/8이다.

운영 Supabase Dashboard의 템플릿 등록과 실제 수신 확인은 별도 운영 적용이 필요하다. 로컬 회원가입 확인 발송 설정은 변경하지 않았다.
