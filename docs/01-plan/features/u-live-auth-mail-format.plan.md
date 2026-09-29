# U-LiVE 인증 메일 포맷 계획

2026-09-27 · 기준: `uc-anchor`의 `supabase/templates/recovery.html`과 `output/pdf/member-guide-email-templates.md`

## 목적과 범위

회원가입 확인, 신규 계정의 최초 비밀번호 설정, 비밀번호 재설정 메일을 UC 앵커사업단의 간결한 한국어 안내 형식에 가깝게 통일한다. U-LiVE 명칭과 현재 인증 경로를 사용한다.

- Supabase Auth의 confirmation, invite, recovery HTML 본문과 제목을 저장소에서 관리한다.
- 가입 확인은 이메일 인증이 활성화된 환경에서만 발송된다. 가입 제한·메일 발송 조건은 변경하지 않는다.
- 초대·복구 메일의 기존 token hash 경로, 15분 안내, 요청하지 않은 경우의 보안 안내를 유지한다.
- 운영 장애 대응 시 확인 메일 템플릿과 확인 화면을 함께 배포하고, 운영 Auth 템플릿에 반영한다.

## 완료 기준

- 세 메일의 제목·문안·버튼·서명에 U-LiVE 명칭을 사용하고 UC 앵커 메일과 유사한 읽기 순서를 가진다.
- Supabase 템플릿 변수와 각 링크가 올바르며 기존 초대·재설정 기능을 깨지 않는다.
- 로컬 설정에서 세 템플릿 경로와 제목을 참조하고, 정적 검증을 통과한다.
- 변경만 별도 커밋하여 원격에 push한다.
- 웹메일에서 가입 확인 링크를 연 뒤 검증 유형이 유실되어도, 앱이 `signup` 유형을 고정해 이메일을 확인할 수 있다.

## 참고

- `docs/02-design/features/anchor-initial-account.design.md`
- `docs/02-design/features/anchor-primary-domain-mail.design.md`
- [Supabase Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
