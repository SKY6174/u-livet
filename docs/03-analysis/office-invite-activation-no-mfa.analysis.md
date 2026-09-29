# 사업단 등록 계정 활성화 및 MFA 중단 설계 대조

> 2026-09-29 · 설계: `docs/02-design/features/office-invite-activation-no-mfa.design.md`

## 일치율: 100% (6/6)

| 설계 항목 | 구현·검증 |
| --- | --- |
| 관리자 수동 등록과 Auth 계정 자동 연결·재시도 | `createMember`와 단회성 nonce 허가·Auth 트리거. 동일 person의 기존 링크 확인 및 DB 요청 ID 재사용. |
| 이메일 확인, 동의, 첫 비밀번호 전 업무 접근 차단 | 복구 OTP, 개인정보 동의 RPC, credential version 0→1. 로컬 Auth 통합 검사 통과. |
| 사업단·교내 강사 가입 차단, 수강생·교외 강사 공개 가입 옵션 | 서버 액션과 가입 화면 분리, 구성원 UI 검사 25개 통과. |
| MFA 요구 중단, 기존 세션·권한 조건 유지 | DB MFA 함수와 로그인 이동 변경. 합성 사업단 계정으로 `life_identity`, 로그인 구분, 보안 상태 확인. |
| 신규 TOTP 등록 중단, 기존 factor 보존 | 로컬 Auth 설정에서 등록 비활성화, 기존 factor 삭제 없음. |
| 로그인 아래 활성화 순서와 버튼 | 사업단·교내 강사 화면 모두 3단계 설명과 신규 비밀번호 설정 버튼 제공. |

## 추가 확인

- 로컬 Supabase에서 사업단 계정의 Auth 생성→복구 링크→동의→비밀번호 설정→MFA 없는 로그인 통과.
- 교내 강사의 Auth 연결·구분·역할 확인 통과.
- TypeScript, ESLint, 프로덕션 빌드, `git diff --check` 통과.
- 운영 Supabase migration·Auth 설정과 실제 SMTP 메일 발송은 Git 푸시만으로 검증되지 않는다. 배포 시 해당 환경에서 확인해야 한다.
