# 이용자별 로그인 변경

2026-09-20. 기존 단일 로그인 화면을 사업단, 강사(교내), 강사(교외), 수강생 네 가지로 구분했다. 교내 강사는 학교 이메일과 별도 U-LIFE 비밀번호 안내를 제공한다. 교외 강사는 카카오와 이메일로 로그인하며, 신규 가입만으로 강사 역할을 얻지는 않는다.

사업단 직책과 강사 구분은 비공개 DB에 저장하고 서버에서 판정한다. 기존 역할 부여 내역은 변경하지 않았다. `/admin/accounts`에서 시스템 관리자가 최근 MFA 확인 후 구분을 변경할 수 있다. 송경영 기존 계정의 직책은 단장으로, 스테이징 기존 외부 이메일 강사 계정은 교외로 초기화했다. 다른 사업단 구성원은 계정·역할 등록 후 직책을 지정한다.

## 검증

- `npm run build`: 컴파일·lint·타입 검사 성공.
- 서버 동작 검사 76개, 격리 DB SQL 검사 76개 통과.
- 390px 모바일·1440px 데스크톱 화면 확인. 가로 넘침 없음.
- DB migration `20260920071611_anchor_login_audiences` 운영·스테이징 적용 및 이력/권한 재조회 완료.
- Security Advisor: ERROR/WARN 없음. 직접 접근을 차단한 RLS 테이블의 ‘정책 없음’ INFO만 존재하며 새 분류 테이블도 같은 비공개 RPC 접근 모델을 사용한다. [Supabase 설명](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [설계 대조 기록](../../03-analysis/anchor-login-audiences.analysis.md)

## 준비 상태와 다음 설정

카카오 연결을 재사용한다. Google/Naver 버튼은 준비 중으로 유지한다. 개발자 앱·Secret·Supabase 제공자 연결, 네이버 응답 매핑 검증, 제공자별 동의문 승인과 스테이징 검증 후에만 개방한다. [설정 안내](../../operations/social-login-setup.md)

동일 앱 코드를 main/preview에 반영하며 기존 preview 문서 차이는 보존한다. 배포 후 각 도메인의 `/api/version`과 네 가지 로그인 화면에서 해당 커밋 반영 여부를 확인한다.
