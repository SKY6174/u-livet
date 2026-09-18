# Supabase Cloud 전환 및 동일 버전 배포 결과

2026-09-19 · `anchor-managed-cloud-release`

사용자의 변경된 요청에 따라 별도 인증 서버 대신 Supabase Cloud를 사용한다. 메일 설정은 후속으로 남겼다. 기존 `uc-life.vercel.app`의 운영 소스는 `1a4bf13`(이전 화면)이었으며, 이번 ChatGPT/Codex 개발 소스 `1688558`로 교체했다.

## 배포 검증 기록

| 환경 | 주소 | 기능 배포 ID |
|---|---|---|
| Production | https://uc-life.vercel.app | `dpl_DAjrbdeXd16GuxyYTRMq9LQoTN8i` |
| Preview | https://uc-life-git-preview-ucsky6174.vercel.app | `dpl_CpMfSuuWXt29FE7gm7FRXEBFfAmQ` |

두 배포는 Ready이며 기능 커밋 `16885581d2876e796836b009fc81b890641a0a51`과 `authProfile=managed-cloud-v1`, `reviewOnly=false`가 `/api/version`에서 일치했다. `/api/health`는 모두 200이다. 운영 브라우저에서 “지금의 배움이, 내일의 일로.”와 비밀번호 보이기 전환을 확인했다. 이 기록을 추가하는 문서 커밋도 양 브랜치에 동일하게 push하며 최종 SHA는 `/api/version`이 기준이다.

## 변경·검증

- 12자 이상 + 영문 대문자·소문자·숫자·특수문자 필수. Cloud native 정책과 UI/서버 검사를 맞췄다. 유출 비밀번호 차단을 켰다.
- 인증·MFA·RLS·관리자 과정 저장·비밀번호 변경 세션 회수 실제 Preview 검사 20개 통과. 생성한 합성 계정/자료는 정리했으며 메일을 보내지 않았다.
- 설정 검사 232개, lint, 깨끗한 체크아웃 Node 24 빌드 및 두 Vercel 빌드 통과.
- 배포된 양쪽의 실제 로그인 server action은 요청 제한 RPC와 native Auth까지 도달했다. 미등록 합성 이메일은 정상적인 로그인 거부 안내를 받았다. 가입/복구 server action은 메일 미설정 안내로 차단됐다.
- 운영 DB는 기존 8개에서 23개로 변경 적용했고 Preview도 23개다. 운영 legacy 자료는 삭제하지 않았다. 사전 public schema/data 백업은 Git에서 제외하여 제한 권한으로 보관했다. 실제 복원 훈련 완료를 의미하지 않는다.
- 양 DB security advisor의 경고/오류는 0개이며, 정책 없이 의도적으로 접근을 막은 RLS 테이블의 INFO 안내만 있다.

## 남은 운영 준비

1. SMTP 발신 도메인과 가입/복구 메일 설정·수신 검증. 현재 회원가입/복구 기능은 비활성이다.
2. 실제 최초 관리자 계정, MFA와 업무별 역할, 기관/연차 및 승인 개인정보 문안 등록. 실제 운영 계정과 공개 과정은 현재 0개다.
3. 승인 환불·감면·강사 심사 기준과 실제 교육과정 등록. 미확정 기준을 임의 승인하지 않았다.

[운영 가이드](../../operations/managed-cloud-release.md) · [설계 대조 결과](../../03-analysis/anchor-managed-cloud-release.analysis.md)
