# 비밀번호 복구·인증 정책 적용 결과

2026-09-19 · `anchor-auth-recovery` · 로컬 구현

비밀번호를 잊은 이용자는 이메일을 입력하고 한국어 재설정 메일의 링크에서 새 비밀번호를 만들 수 있다. 보기/숨기기와 실시간 조건 체크를 제공하며 다른 기기에서도 링크를 사용할 수 있다. 비밀번호를 바꿔도 기존 학습·강의·증명 기록과 계정 연결은 유지된다.

## 이용 흐름

1. 로그인 화면의 **비밀번호를 잊으셨나요?** 선택.
2. 가입 이메일 입력. 계정 등록 여부와 무관하게 같은 접수 안내.
3. 메일의 **새 비밀번호 만들기** 선택. 링크는15분간 유효하며 한 번만 사용.
4. 새 비밀번호 입력·조건 확인·변경. 새 비밀번호로 다시 로그인.

로컬 확인: [비밀번호 찾기](http://127.0.0.1:3100/auth/forgot-password), [로컬 메일함](http://127.0.0.1:55324).

## 보안 적용

- 사용자 선택인 **12자 이상+영문·숫자·특수문자, 영문 대소문자 중 하나**를 화면과 직접 Auth API에 동일 적용했다.
- 이메일 링크를 여는 GET만으로 토큰을 소비하지 않는다. 토큰은 fragment에서 읽고 주소에서 제거하며 서버 URL에 보내지 않는다.
- 재설정 토큰으로 확인된 계정만 변경한다. 사용·만료·잘못된 링크는 거부한다.
- 구정책 계정은 새 비밀번호 설정 전 자료에 접근하지 못한다. 사용자 metadata나 단순 저장 해시 변경으로 이를 우회할 수 없다.
- 비밀번호 변경 이전 또는 로그아웃된 세션은 유효기간이 남은 JWT여도 DB/RPC 자료에 접근하지 못한다. native logout으로 갱신 토큰도 회수한다.

## 검증

| 항목 | 결과 |
|---|---|
| 기존 기능291개 + 신규 복구18개 | 고유 검사309개 통과 |
| 브라우저 복구·재로그인·재사용 거부 | 통과 |
| GET 미소비·주소 토큰 제거·일반 로그인 우회 방지 | 통과 |
| 320px·키보드·보기 버튼·조건 안내 | 확인 |
| lint / production build | 통과 |
| 로컬 DB security advisor | warn 이상 없음 |
| DB 변경 | 20번째 migration 적용, 신규 테이블 상태 재생·rollback 확인 |

전체19개 migration 재생은 이전 작업에서 검증했으며 이번에 전체 DB를 초기화하지 않았다. 감사 이벤트 보강 후 관련 복구18·core33·accessible21을 재실행했다. 모든 계정과 메일은 로컬 가상 자료다. 실제 사용자에게 메일을 발송하지 않았다.

증거: [복구18개](evidence/recovery-checks.txt), [기존 core](evidence/recovery-core.txt), [인증21개](evidence/recovery-accessible.txt), [빌드](evidence/recovery-build.txt), [DB 점검](evidence/recovery-security.txt), [신규 DDL 검사](evidence/recovery-migration-fresh.txt), [브라우저 기록](evidence/recovery-browser.txt).

![모바일 비밀번호 찾기](evidence/recovery-request-mobile.png)

## 운영 준비와 한계

원격 Supabase와 실제 서비스에는 적용하지 않았다. 로컬 Auth는 공식 사용자 지정 문자 집합으로 정확한 조건을 지원하지만 hosted 관리 화면의 기본 프리셋과 같다고 가정할 수 없다. 운영에는 해당 설정을 지원하는 Auth 배치 또는 공급자의 동등한 통제를 확인해야 한다. 로컬 start/reset 후 `configure-auth-local.mjs`를 적용하며 `dev:local`도 자동 검사한다.

운영 SMTP·고정 HTTPS SiteURL/AUTH_SITE_ORIGIN·동일 메일 템플릿과 인증 정책을 먼저 설정한 후 DB migration을 적용한다. 기존 실제 계정은 본인이 복구를 요청하며 일괄 비밀번호 변경·자동 대량 발송은 하지 않는다. Auth 감사 로그 이벤트에 의존하는 정책 기록은 엔진 업그레이드 때 재검증한다.

관리자 MFA/재인증, 운영 속도제한·봇 방어, 카카오/네이버/PASS는 후속이다. 다음 구현 권장 항목은 **관리자 MFA와 민감 업무 재인증**이다.

[설계](../../02-design/features/anchor-auth-recovery.design.md) · [설계 대비 검사](../../03-analysis/anchor-auth-recovery.analysis.md) · 실행 절차는 [README](../../../README.md) 참고.
