# U-LiVE 인증 메일 포맷 설계

2026-09-27 · [계획](../../01-plan/features/u-live-auth-mail-format.plan.md)

## 메일별 구성

UC 앵커의 복구 템플릿과 구성원 안내문처럼 `제목 → 짧은 설명 → 단일 행동 버튼 → 요청하지 않은 경우 → 기관 서명` 순서로 작성한다. HTML은 메일 클라이언트를 위해 인라인 스타일과 표 기반 너비 제한을 사용한다. 세 종류는 같은 글꼴, 여백, 버튼, 색상, 푸터를 공유하며 U-LiVE 표기를 쓴다.

| 종류 | Supabase 템플릿 | 제목 | 행동과 링크 |
|---|---|---|---|
| 회원가입 이메일 확인 | `confirmation.html` | `[U-LiVE] 회원가입 이메일 확인` | `{{ .ConfirmationURL }}`로 native 이메일 확인 |
| 최초 비밀번호 설정 | `invite.html` | `[U-LiVE] 계정 설정 안내` | `{{ .SiteURL }}/auth/accept-invitation#token_hash={{ .TokenHash }}` |
| 비밀번호 재설정 | `recovery.html` | `[U-LiVE] 비밀번호 재설정 안내` | `{{ .SiteURL }}/auth/reset-password#token_hash={{ .TokenHash }}` |

## 인증 및 안내 규칙

- ConfirmationURL은 Supabase native 확인 링크다. 공개 가입은 현재 비활성이고, 환경에서 이메일 확인이 켜진 경우에만 회원가입 확인 메일이 발송된다. 기존 가입 화면의 성공 메시지와 native 인증 설정은 변경하지 않는다.
- 초대와 복구의 token hash는 기존처럼 URL fragment에 둔다. 페이지 조회만으로 토큰을 소비하지 않고, 사용자가 새 비밀번호를 제출할 때 서버가 고정된 `invite` 또는 `recovery` 타입으로 검증한다.
- 링크는 15분·1회 사용 안내를 유지한다. 초대 메일이 의도하지 않은 경우 사업단에 확인하도록 하고, 복구 메일을 요청하지 않았다면 무시하도록 안내한다. 링크와 비밀번호를 공유하지 않도록 명시한다.
- URL을 별도 본문에 중복 표시하지 않는다. 사용자 입력·메타데이터는 템플릿에 출력하지 않는다.
- `supabase/config.toml`에 세 제목과 content_path를 선언한다. Hosted Auth Dashboard 적용은 별도 운영 작업이며 이번 push만으로 자동 반영되지 않는다.

## 검증

세 HTML 문서의 제목·링크·버튼 텍스트·브랜드 표기와 config 경로를 검사한다. 템플릿 변수는 Supabase 공식 문서의 지원 목록과 대조한다. 변경 파일에 대한 diff/HTML 검사와 필요 시 로컬 메일 렌더링을 수행한다. 실제 사용자에게 테스트 메일을 보내지 않는다.

참고: [Supabase Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates), [로컬 템플릿 설정](https://supabase.com/docs/guides/local-development/customizing-email-templates)
