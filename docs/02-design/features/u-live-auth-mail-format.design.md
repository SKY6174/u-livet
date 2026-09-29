# U-LiVE 인증 메일 포맷 설계

2026-09-27 · [계획](../../01-plan/features/u-live-auth-mail-format.plan.md)

## 메일별 구성

UC 앵커의 복구 템플릿과 구성원 안내문처럼 `제목 → 짧은 설명 → 단일 행동 버튼 → 요청하지 않은 경우 → 기관 서명` 순서로 작성한다. HTML은 메일 클라이언트를 위해 인라인 스타일과 표 기반 너비 제한을 사용한다. 세 종류는 같은 글꼴, 여백, 버튼, 색상, 푸터를 공유하며 U-LiVE 표기를 쓴다.

| 종류 | Supabase 템플릿 | 제목 | 행동과 링크 |
|---|---|---|---|
| 회원가입 이메일 확인 | `confirmation.html` | `[U-LiVE] 회원가입 이메일 확인` | `{{ .SiteURL }}/auth/confirm-email#token_hash={{ .TokenHash }}` |
| 최초 비밀번호 설정 | `invite.html` | `[U-LiVE] 계정 설정 안내` | `{{ .SiteURL }}/auth/accept-invitation#token_hash={{ .TokenHash }}` |
| 비밀번호 재설정 | `recovery.html` | `[U-LiVE] 비밀번호 재설정 안내` | `{{ .SiteURL }}/auth/reset-password#token_hash={{ .TokenHash }}` |

## 인증 및 안내 규칙

- 가입 확인 링크는 앱의 `/auth/confirm-email` 화면으로 연다. 메일 클라이언트가 Supabase native 링크의 `type` 쿼리 값을 유실시키는 경우를 피하기 위해 토큰 해시만 fragment에 전달한다. 화면은 주소 표시줄에서 fragment를 즉시 지우고 사용자의 버튼 입력 후에만 서버에서 `verifyOtp({ token_hash, type: "signup" })`을 호출한다. 확인 완료 후에는 기존 로그인 화면으로 안내하고 인증 세션은 브라우저에 저장하지 않는다.
- 가입 확인 토큰은 형식과 길이를 클라이언트와 서버에서 검사한다. 만료되었거나 이미 사용한 링크에는 같은 안내를 표시한다. 공개 가입은 현재 비활성이고, 환경에서 이메일 확인이 켜진 경우에만 회원가입 확인 메일이 발송된다.
- 초대와 복구의 token hash는 기존처럼 URL fragment에 둔다. 페이지 조회만으로 토큰을 소비하지 않고, 사용자가 새 비밀번호를 제출할 때 서버가 고정된 `invite` 또는 `recovery` 타입으로 검증한다.
- 링크는 15분·1회 사용 안내를 유지한다. 초대 메일이 의도하지 않은 경우 사업단에 확인하도록 하고, 복구 메일을 요청하지 않았다면 무시하도록 안내한다. 링크와 비밀번호를 공유하지 않도록 명시한다.
- URL을 별도 본문에 중복 표시하지 않는다. 사용자 입력·메타데이터는 템플릿에 출력하지 않는다.
- 대학 웹메일처럼 링크를 메일 보기 프레임 안에서 여는 클라이언트에서는 사이트의 `X-Frame-Options: DENY` 때문에 복구 화면이 표시되지 않는다. 재설정 버튼에 `target="_blank"`와 `rel="noopener noreferrer"`를 지정하고, 클라이언트가 새 창 속성을 무시할 때는 버튼을 우클릭하거나 길게 눌러 새 탭에서 열도록 안내한다. 프레임 차단 헤더와 토큰 URL 형식은 유지한다.
- `supabase/config.toml`에 세 제목과 content_path를 선언한다. 앱 경로를 먼저 운영 배포하고 Hosted Auth Dashboard의 확인 메일 템플릿을 갱신한다. 기존에 발송된 메일은 이전 링크를 포함하므로 새 확인 메일을 요청해야 한다.

## 검증

세 HTML 문서의 제목·링크·버튼 텍스트·브랜드 표기와 config 경로를 검사한다. 템플릿 변수와 `verifyOtp`의 `signup` 유형은 Supabase 공식 문서와 타입 정의에 대조한다. 앱 빌드와 확인 화면을 검사하고, 운영 반영 후 새 메일의 링크와 확인 결과를 검증한다.

참고: [Supabase Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates), [로컬 템플릿 설정](https://supabase.com/docs/guides/local-development/customizing-email-templates)
