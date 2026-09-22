# 인증 정책·복구 설계 대비 검사

2026-09-19 · `anchor-auth-recovery`

검토 대상은 로컬 Auth의 정확한 비밀번호 정책, 이메일 복구, 구정책 계정·기존 세션의 DB 접근 차단이다. 운영 배포 완료를 의미하지 않는다.

## 설계 대응

| 요구사항 | 구현·검증 |
|---|---|
| 12자·영문·숫자·특수문자, 대소문자 중 하나 | 공식 Auth custom character set. 직접 signup/update의 약한 비밀번호 거부, lowercase/uppercase/콜론/역슬래시 허용 |
| 지정된 로컬 환경만 변경 | API55321·컨테이너·라벨·네트워크·UNIX socket 확인. 설정 재실행은 변경 없이 종료 |
| 친절한 이메일 요청 화면 | 단계 안내·큰 입력/버튼·등록 여부와 무관한 동일 문구. 실제 로컬 메일 도착 확인 |
| 다른 기기에서 링크 사용 | stateless recovery client, PKCE cookie에 의존하지 않음. 로그인 없는 브라우저에서 변경 성공 |
| GET 미소비·토큰 비노출 | fragment를 읽고 주소에서 삭제. GET 전후 DB 토큰 동일. no-referrer/private no-store 확인 |
| 토큰 소유자만 변경 | type=recovery 고정, user_id/email/redirect 입력을 받지 않음. 일반 로그인 상태의 토큰 없는 화면도 입력창 미제공 |
| 조건 확인·보기 버튼 | 공통 PasswordField 재사용. 모든 조건 충족 안내·키보드 Tab·320px 넘침 없음 |
| 만료·재사용·잘못된 링크 | Auth/API 검증과 브라우저 재사용 오류 확인. 오류는 재요청 링크로 안내 |
| 구정책 계정 자료 보호 | private credential_state, metadata 위조 불가. 복구 후 같은 person 유지 |
| 재해시를 정책 준수로 오인하지 않음 | hash 변경은 일단0, 같은 transaction의 명시적 비밀번호 변경 감사 이벤트만1로 승인 |
| 기존 세션 자료 접근 회수 | DB person_id가 실제 session·변경 시각·활성 상태 확인. 이전 JWT/RPC·refresh 차단 확인 |
| 학습 기록 보존 | person 연결 유지, 로컬 가상 계정만 갱신. 기존 전체 기능 회귀 통과 |
| 검증·재현·운영 경계 기록 | README·검증 스크립트·lint/build·DB advisor·migration 적용/신규 생성 검사 |

로컬 구현 항목13/13. 이 비율은 운영 준비도나 보안 인증 점수가 아니다. 최초19개 migration 전체 재생은 이전 작업의 검증이며, 이번에는20번째 적용과 credential_state 없는 상태의 신규 DDL을 transaction 안에서 재생한 후 rollback했다. 기존 데이터를 보존하기 위해 전체 DB reset은 반복하지 않았다.

## 검사 결과

- 기존 회귀291개: core33, learning33, certificates24, finance37, messaging39, annual37, badges34, instructor33, accessible21.
- 신규 복구18개: 직접 Auth 정책, legacy 복구, metadata/재해시 우회 방지, JWT·refresh 회수, 새 비밀번호 로그인, 차단 계정, 토큰 만료·재사용·로컬 이메일.
- 감사 이벤트 보강 후 복구18개와 core33·accessible21을 다시 확인했다. 중복 실행을 추가 검사 개수로 합산하지 않는다. 고유 검사 총309개.
- 실제 브라우저: 로그인 없는 재설정→완료→새 비밀번호 로그인, 사용한 링크 오류, 등록/미등록 주소의 동일 문구, 일반 로그인만으로 재설정 불가, GET 미소비·주소 토큰 제거, 320px·키보드, 콘솔 오류 없음.
- DB security advisor warn 이상 없음. migration 목록20개. lint·production build 통과.

## 점검 중 보완

해시만 변경된 것을 정책 준수로 인증하지 않도록 같은 transaction의 Auth 감사 이벤트를 요구했다. 클라이언트 설정 오류는 안내로 처리하고, 실제 변경 후 부가 쿠키 정리 실패가 변경 실패로 표시되지 않게 했다. 새 메일 토큰으로 이동하면 폼을 다시 생성하여 이전 오류·입력을 지운다.

## 남은 운영 작업

운영 SMTP·고정 HTTPS 주소·템플릿 및 사용자 지정 정책을 지원하는 Auth 배치 결정. 해당 정책이 활성화된 뒤 DB migration을 적용해야 한다. Auth 감사 로그를 끄지 않으며 업그레이드 시 이벤트 형식과 API 정책 검사를 반복한다. service_role/DB 소유자는 신뢰된 관리 경계다.

관리자 MFA·재인증, 서비스 전반의 속도제한/봇 방어·모니터링, 실제 계정의 기관 승인 복구 절차, 카카오/네이버/PASS는 이번 구현 범위에 포함하지 않았다. 기본 Auth 속도제한은 유지하며 운영 부하·침투 검사를 수행한 것으로 표시하지 않는다.
