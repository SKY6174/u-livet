# Supabase hosted 인증 사전 검증 계획

2026-09-19 · Dynamic · `anchor-hosted-auth-preflight`

Vercel + Supabase 선택 이후, 확정 인증 규칙과 hosted 서비스 사이의 차이를 확인하고 별도 Preview에서 재사용할 읽기 전용 검사 도구를 준비한다.

초기 MCP 연결에는 SKY6174의 두 프로젝트만 보였다. 사용자가 ANCHOR 안의 uc-life를 알려 주었고, CLI에서 ANCHOR/uc-life(`uoebygejgglgiivzgyks`)를 확인했다. 별도 Preview는 없고 main만 있다. uc-life의 메타데이터·migration 이력만 읽으며 실제 Preview 검증 완료와 도구 준비 완료를 구분한다.

범위: 공식 관리 API의 비밀번호 enum 및 관리형 schema 제약 조사, 비밀 비출력 Auth 설정 조회/오프라인 비교, 메타데이터만 조회하는 SQL, 로컬/합성 검증, 공급자 확인 질문과 실제 Preview 시험 순서.

비범위: 비밀번호 기준 변경, Auth 구조 재설계, 원격 프로젝트 생성/과금, schema/설정 변경, 실사용자 조회·가입·메일 전송·비밀번호 변경. `.env.local`은 읽거나 수정하지 않는다.

완료 기준: 잘못된 대상/설정·비밀 포함 응답·외부 오류를 안전하게 처리하고 예시가 통과하지 않음. SQL이 사용자 행을 읽지 않고 로컬에서 실행됨. 실제 대상 미확인 항목을 미완료로 기록함.
