# 네이버 로그인·개인정보 안내 적용 기록

확인일: 2026-09-22 KST.

## 요청 및 적용 범위

사용자가 네이버 검수용 실제 로그인 연결과 git push를 요청했고, 이어 “개인정보 보호 규칙에서 네이버 관련 내용을 추가해줘.”라고 지시했다. 이 요청에 따라 네이버 항목을 추가했다. 별도의 최종 문안 승인 응답을 받은 것으로 기록하지 않는다.

- 운영 Supabase `custom:naver`의 기존 Client ID/Secret과 PKCE 설정을 유지했다.
- 사용자 정보 URL을 `https://uc-life.org/api/auth/naver/userinfo`로 바꾸고 `sub`/`email`만 매핑했다. scope와 추가 claim 허용 목록은 비어 있다.
- `email_verified`는 Supabase 보호 필드이므로 attribute mapping에 넣지 않는다. 네이버 응답은 확인 상태를 제공하지 않아 어댑터가 false를 반환하고 기존 이메일 확인 설정을 유지한다.
- 운영 Vercel `AUTH_NAVER_ENABLED=true`를 설정했다. 이 값은 새 배포부터 적용된다.
- 실제 Supabase 인가 응답은 네이버 `/oauth2.0/authorize`로 302, 빈 scope, state 및 PKCE 포함, callback `https://uoebygejgglgiivzgyks.supabase.co/auth/v1/callback`이다.
- 스테이징의 네이버 연동·문안은 이번 작업에서 변경하지 않았다.

## 개인정보 v5

- 최신 운영 문안은 ACCOUNT-2026-09-20-v4였다. 이연향 연구원 연락처를 포함한 기존 내용을 보존하고 네이버 설명을 추가했다.
- 새 문안: `account-privacy-v5.txt`, ACCOUNT-2026-09-22-v5. DB 본문은 파일 끝 개행을 제외한다.
- 본문 SHA-256: `6a309c2f10cebc3a5575d22cd8b6c2eef1051378bce234a555ac8877a0be51b2`.
- 운영 정책 ID: `0e9a8df2-6f60-488d-ac5f-8fdcb96d6675`, 등록·효력 시작: `2026-09-22T00:59:54.987096Z`.
- 실제 유효한 SYSTEM_ADMIN 송경영을 확인한 트랜잭션으로 새 APPROVED 버전을 등록하고 가입 정책 포인터를 변경했다. 이전 승인 문안은 수정하지 않았다.
- 동의 이벤트 7건 및 전체 행 지문 `8b5d2d8b94b761795825a1f91e50e4e6`은 적용 전후 동일하다. 기존 회원에게 새 동의를 임의로 부여하지 않았다.

## 검증

- 어댑터와 이메일 확인 callback 33개 검증 통과: 잘못된 토큰, 고정 upstream, 민감정보 미반환, 네트워크 오류, 이메일 미제공, QR 복귀.
- 기존 소셜 가입·자동 분기·로그인 대상 회귀 검사와 lint, Next.js 빌드, TypeScript 검사 통과.
- 네이버 비밀번호 입력과 이용자 동의 이후의 실 계정 로그인은 이용자가 진행한다. 모의 사용자 정보 검사나 인가 화면 도달을 실제 계정 인증 완료로 간주하지 않는다.
- 검수 캡처 순서는 `social-login-setup.md`에 있다. 인증 메일 확인이 필요하면 확인 후 다시 네이버 로그인을 진행한다.

## 복구

네이버 오류가 발생하면 운영 `AUTH_NAVER_ENABLED=false`로 재배포해 기존 로그인 수단을 제공한다. 사용자 계정·동의 기록·정책 문안은 삭제하거나 이전 내용으로 덮어쓰지 않는다. 네이버 Secret 변경은 이번 작업에 포함되지 않았다.

## 운영 배포 확인

- 코드 커밋 `5cbf9d069070d7ab3084a5696ddf021873c0f073`, 운영 배포 `dpl_5GTFUbJVd9kSZ1MjEtcgyzQGZcab` READY. `/api/version`에서 동일 revision 및 production을 확인했다.
- 운영 수강생 로그인 페이지의 네이버 버튼이 활성화되어 실제 `nid.naver.com/oauth2.0/authorize`의 “Signing in to U-LIFE 로그인” 인증 화면으로 연결됐다. 아이디·비밀번호를 입력하거나 개인 계정 인증·동의를 수행하지 않았다.
- 운영 어댑터는 헤더 없음과 실제 네이버에서 거부한 무효 Bearer 토큰 모두 401 `invalid_token`, `Cache-Control: private, no-store`를 반환했다.
- `/privacy`와 `/auth/signup`에서 v5 문안이 표시되고 가입 동의 체크박스는 미선택이다. 사업단·교내 로그인에는 네이버 버튼이 없다.
- 캡처: 로컬 `output/naver-review/01-ulife-login.png`, `02-naver-auth.png`. 첫 두 단계의 실제 화면이며 전체 가입·로그인 완료 자료를 대신하지 않는다.
- 이 운영 확인을 기록한 후속 커밋은 문서만 변경한다.
