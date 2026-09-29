# U-LiVET 브랜드 표기 전환 설계

2026-09-29 · [계획](../../01-plan/features/u-livet-brand-rename.plan.md)

## 표기와 이미지

- 표준 서비스명은 `U-LiVET`, 영문 풀네임은 `Ulsan Lifelong Vocational Education & Training`이다.
- 첨부한 1360×380 투명 PNG를 바이트 변경 없이 `public/images/u-livet-logo.png`에 저장한다. 기존 파비콘 심볼은 같은 계열의 그림이므로 유지한다.
- 헤더와 소개 화면의 워드마크는 마지막 `T`만 밝은 파랑으로 표시한다. 소개 화면에는 제공된 이미지의 심볼 부분을 CSS 컨테이너로 잘라 사용하고, 워드마크와 보조 문구 `Ulsan Lifelong T-VET`은 HTML로 배치한다. 본문에는 요청한 영문 풀네임을 명시한다. 푸터의 `T`도 어두운 배경에서 보이는 밝은 색으로 표시한다.

## 적용 경계

- `src`의 사용자 노출 문자열, 메타데이터, 새 PDF 파일명·producer를 바꾼다. `/api/version`의 `application`, URL, 환경 변수, DB 식별자는 유지한다.
- `supabase/templates`와 `supabase/config.toml`의 인증 메일 브랜드 표기를 바꾼다. 운영 Auth에서는 해당 제목·본문 필드만 PATCH해 SMTP·가입·MFA 설정을 보존한다.
- TOTP issuer는 새 이름을 사용한다. 과거 `U-LIFE`, `U-LiVE` factor 명칭은 계속 내부 생성 이름으로 처리한다.
- 이미 발행된 버전별 매뉴얼 PDF와 과거 문서는 수정하지 않는다.

## 검증

- `rg`로 현재 앱과 메일 템플릿의 옛 표기 잔여 여부를 확인한다.
- 빌드와 Preview에서 헤더, 소개 화면 로고, 홈 영문 풀네임, 메타데이터를 확인한다.
- 병합 후 운영 배포 버전과 Auth 메일 제목·본문을 다시 조회한다.
