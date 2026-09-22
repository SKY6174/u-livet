# Preview 업무 DB 검증 및 별도 인증 서버 운영 설계

2026-09-19 · `anchor-preview-db-validation`

ANCHOR/uc-life의 독립 Preview에 업무 migration 11개를 추가 적용했다. 최종 이력은 19개이며 main은 001~008 그대로다. 사용자가 선택한 별도 인증 서버의 운영 설계도 작성했다.

## 실제 적용과 검증

| 항목 | 결과 |
|---|---|
| 대상 | preview / `bfqwntulxabfrimcypvx` / ACTIVE_HEALTHY |
| 적용 방법 | CLI 2.115.0, 전용 작업 폴더, 파일 SHA-256 확인, dry-run 후 push 종료 0 |
| 적용 목록 | 009·010 + core부터 instructor_development까지 업무용 9개 |
| 제외 목록 | auth_recovery / admin_mfa / auth_abuse 3개 |
| RLS | public life_ 73개 + life_private 11개 모두 활성 |
| 기존 API | anon/authenticated의 기존 관계 객체·definer 함수 접근 회수 확인 |
| 서버 전용 함수 | 증명서 claim/fail/finish만 public definer, service_role 전용·고정 search_path |
| Advisor | WARN/ERROR 0건, RLS 정책 없음 INFO 61건. 기본 거부/RPC 접근 구조 |
| 실제 익명 API | 공개 과정 조회 200/빈 배열, 신청 RPC 및 기존 프로필 조회 각각 401/42501 |
| 데이터 | 회원·학습자·신청·수강·파일 0건. 기본 조직/사업연차 각각 1건 |
| main | migration 8개, Auth 6자/문자 조합 없음 유지 |

Management API의 SQL 역할 전환은 권한 제한으로 거부되어 실제 REST 검사로 대체했다. 인증된 사용자 세션이나 전체 역할별 업무 시험까지 통과한 것은 아니다. 승인된 개인정보 정책도 아직 없다.

## 별도 인증 서버 설계 결과

[운영 설계](../../operations/self-hosted-auth-design.md)의 기본안은 **Vercel 홈페이지 + 별도 인프라의 Supabase Auth/업무 PostgreSQL**이다. 현재 코드는 Auth 사용자 외래키와 같은 DB의 감사·세션·MFA를 사용하므로 공동 운영이 기존 구조를 유지하는 데 유리하다. Cloud 업무 DB를 유지하는 대안에는 인증 어댑터·세션/MFA 상태·JWT/RLS 변경이 필요하다.

설계에는 정확한 비밀번호 조건, HTTPS/비밀 관리, SMTP/CAPTCHA, 환경 분리, 담당 업무, 백업·복구 목표 초안, 업데이트와 전환 순서, 실제 인수 표를 포함했다. 운영 버전·DB 위치·담당자·도메인·서버/백업 예산은 후속 확정 사항이다. 사용자 설계 선택을 실제 DB 이관 승인으로 해석하지 않았다.

## 현재 한계와 다음 작업

Cloud Preview는 최소 12자만 적용되어 있고 영문·숫자·특수문자 조합은 강제되지 않는다. Auth 후속 3개는 미적용이며, 앱 연결·복구·MFA·실제 메일/CAPTCHA 인수는 완료되지 않았다. 새 서버 구매·프로비저닝·DB 이관·Vercel 배포·Git push는 수행하지 않았다.

다음 작업은 self-hosted용 배포 검사와 운영 구성 파일을 준비하고, 배치·도메인·담당자·예산이 확정된 시험 환경에서 인증과 역할별 업무를 검증하는 것이다. 이번 결과만으로 운영 가입을 개방하지 않는다.

## 기록

- [설계 대조 및 검증 범위](../../03-analysis/anchor-preview-db-validation.analysis.md)
- [적용 파일 SHA-256 목록](evidence/preview-business-manifest.json)
- [비밀값을 제외한 검증 요약](evidence/preview-business-validation.json)
- [Preview 운영 기록](../../operations/supabase-preview.md)
- [인증 서버 운영 설계](../../operations/self-hosted-auth-design.md)

이번 단계에서 앱 소스나 원본 SQL을 추가 수정하지 않았다. 기존 파일 사본으로만 원격 적용했으므로 로컬 앱 회귀·빌드를 반복하지 않고, 실제 대상의 이력·catalog·REST 경계를 검증했다. 문서 10개·로컬 링크 27개·JSON 기록 2개를 검사했고 `git diff --check`도 통과했다. 적용용 임시 폴더는 파일 지문을 기록한 뒤 정리했다. `.env.local`은 읽거나 수정하지 않았다.
