# 강사 서류 직접 입력·공유 검증

- 기능: anchor-instructor-document-links
- 설계 대비 12/12 항목 구현. 별도 입력 창, 자동 인증, 두 문서 탭, 링크/PIN 분리, 기관 권한, PIN 잠금, 재발급·만료, 대상 고정, 로그아웃, 안전한 삭제, 지급 기록 보존, 모바일 접근 확인.
- `verify-instructor-document-links.mjs`: 15개 검증 통과. 타 기관 발급 차단, 원문 미저장, service 전용 검증 RPC, JWT 세션 유지, 병렬 PIN 잠금, 초대 접근·암호화 초안, 재발급·만료·역할 철회·삭제 검증.
- 기존 `verify-instructor-documents.mjs` 15개, `verify-instructor-pool.mjs` 18개 통과.
- `deno check`, TypeScript, 변경 TSX/TS ESLint, `npm run build`, `git diff --check` 통과.
- 실제 로컬 브라우저: 신분증/이력서 버튼이 별도 창의 해당 탭으로 바로 진입. opener null, 중간 열기 단계 없음. 링크와 6자리 PIN 별도 필드/복사 버튼, 수정 폼, 삭제 확인 문구 확인.
- 계정 쿠키 없는 별도 브라우저에서 PIN 인증, 이력서 초안 자동 저장의 암호문 생성, 로그아웃 후 PIN 폼 복귀 확인. 390px 화면에서 가로 넘침 없음.
- 운영 migration `20260922042405_anchor_instructor_document_links` 및 Edge handler 반영. 인증 없는 session=403 FORBIDDEN, 잘못된 초대=403 INVALID_CREDENTIALS 확인.
- 신규 DB 객체에 WARN/ERROR 또는 미인덱스 FK 없음. RLS 정책 없는 테이블 INFO는 직접 접근을 모두 거부하고 제한된 RPC/service 경로로만 접근하는 의도된 설계다. 새 인덱스 unused INFO는 사용 누적 전 상태다. [Supabase RLS 진단 설명](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- AI 판독/PDF 생성 로직은 기존 GPT-5.6/PDF 1.7 설정 유지. 이번 검증은 실제 개인서류나 외부 AI 호출 없이 가상 로컬 데이터만 사용했다.
