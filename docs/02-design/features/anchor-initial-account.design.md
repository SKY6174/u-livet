# 최초 계정 비밀번호 설정 설계

2026-09-19 · [계획](../../01-plan/features/anchor-initial-account.plan.md)

## 구성

`/auth/accept-invitation`은 기존 `RecoveryForm`을 초대 모드로 사용한다. 목적은 컴포넌트 서버 호출 코드에 고정하며 URL/form의 `type`이나 `redirect_to`로 결정하지 않는다. `/auth/invitation-accepted`는 로그인·인증 앱 연결·사업단 권한 확인 순서를 안내한다. 두 페이지는 검색 색인에서 제외한다.

초대 템플릿 링크는 `{{ .SiteURL }}/auth/accept-invitation#token_hash={{ .TokenHash }}`다. fragment는 UI 메모리에만 유지하고 주소에서 제거한다. 페이지 조회만으로 Auth 검증을 수행하지 않는다. 임의 이동 목적지를 사용하지 않는다.

## 서버 처리

`resetPassword`는 내부 공통 처리기에 `recovery`, `acceptInvitation`은 `invite`를 고정 전달한다. 공통 처리기는 기존 길이·문자 검사, 토큰 형식 검사, reset 요청 제한을 먼저 수행한다.

검증은 쿠키를 쓰지 않는 일시적 Supabase 클라이언트의 `verifyOtp`로 실행한다. 초대 흐름은 성공한 사용자에 `invited_at`이 있는지도 확인한다. 이후 `life_auth_status.active`, 등록된 TOTP가 있으면 추가 인증, native 비밀번호 변경, 전역 로그아웃, 기존 브라우저 쿠키 제거 순서를 유지한다. 오류 시 검증된 세션은 적어도 로컬 범위로 종료한다. 세션·토큰·메일 주소·비밀번호는 로그에 남기지 않는다.

초대 수락은 역할을 생성하거나 동의를 대행하지 않는다. 최초 계정은 승인 문안과 외부에서 확보한 본인 동의에 따라 운영자가 별도 초대한다. 기존 DB 생성 트리거는 유지한다. 신규 DB 테이블·마이그레이션·공개 초대 발송 endpoint는 추가하지 않는다.

## 사용자 안내

초대 메일과 화면은 큰 글자·버튼, 이메일 링크 → 비밀번호 설정 → 로그인/인증 앱 순서로 안내한다. 새 계정의 첫 화면에 MFA 코드 입력을 요구하지 않는다. 예외적으로 이미 MFA가 있는 계정은 서버가 기존 보호를 유지하며 재설정 경로와 사업단 확인을 안내한다. 초대 만료/재사용 시 일반 복구 메일을 무조건 요청하도록 유도하지 않고 사업단의 초대 재발송을 안내한다.

## 검증과 배포

서버 액션 동작 시험: 약한 비밀번호 사전 거부, 고정 OTP 타입, 잘못된/재사용 링크 거부, 중단 계정 거부, MFA 우회 차단, 성공 시 global logout·고정 redirect. 기존 recovery 경로도 동일한 시험을 실행한다.

Preview 합성 승인 정책/계정만 사용해 native generateLink invite가 기존 DB 트리거와 호환되는지 확인한다. 초대 이메일 미인증 → verifyOtp → 비밀번호 조건 거부/수락 → 재로그인 → 역할 0개 → 토큰 재사용 거부를 검증하고 시험 데이터를 정리한다. 실제 SMTP 발송은 수행하지 않는다.

변경 파일 lint, 정리된 체크아웃 빌드, Preview 웹 서버 액션 인수 검증 후 같은 코드를 운영·Preview에 배포한다. 초대 메일 템플릿은 페이지 배포 확인 후 양 Auth 설정에 적용하며 다른 메일 템플릿·가입 제한을 변경하지 않는다. 실제 관리자 후보 계정 생성이나 메일 발송은 별도 승인 문안/본인 동의 확보 후 실행한다.

공식 참고: [Supabase inviteUserByEmail](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail), [generateLink](https://supabase.com/docs/reference/javascript/auth-admin-generatelink), [이메일 템플릿](https://supabase.com/docs/guides/auth/auth-email-templates).
