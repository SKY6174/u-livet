# 강사 비공개 서류 제출 적용 보고

2026-09-22 · feature: `anchor-instructor-documents`

## 사용 경로
- 사업단 관리 → **전문가 관리** (`/admin/instructors`) → 강사 서류 제출 현황.
- 사업단 COURSE_MANAGER는 담당 기관 강사의 제출 여부를 확인하고 서류를 입력·보관할 수 있다. 다른 사업단 역할은 자동으로 민감서류 관리권한을 얻지 않는다.
- 강사는 My Room → **강사 서류 제출** (`/mypage/instructor/documents`)에서 본인 서류를 제출한다.
- 신분증·통장사본과 이력서는 최초 제출 후 변경 시 갱신한다. 서류함을 연 뒤 **보관 PDF 확인**으로 저장본을 다운로드한다.

## Supabase 적용
- 운영 프로젝트: `uoebygejgglgiivzgyks` (uc-life).
- 적용 migration: `20260922021343_anchor_instructor_documents`, `20260922021843_anchor_instructor_document_directory`.
- 배포 함수: `instructor-documents`. 게이트웨이 JWT 검증은 끄고 함수 내부에서 Supabase Auth 사용자 및 역할 RPC를 매 요청 검증한다.
- 비공개 버킷: `instructor-private-documents`. 브라우저의 직접 테이블/Storage 접근권한 없음. 서버가 300초 다운로드 URL을 발급한다.
- uc-anchor와 같은 AES-256-GCM 암호화 방식과 문서 구조를 사용하되 uc-life 전용 암호화 키·별도 저장소를 사용한다. 기존 anchor 자료는 자동으로 가져오거나 공유하지 않는다.
- 서버 secrets: `ADVISORY_PII_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `INSTRUCTOR_DOCUMENT_ALLOWED_ORIGINS`. 키는 저장소나 클라이언트에 포함하지 않았다.
- 운영 허용 Origin은 `https://uc-life.org`, `https://www.uc-life.org`만 남겼다.

## 검증
- 설계 대조: `docs/03-analysis/anchor-instructor-documents.analysis.md`.
- `node scripts/verify-instructor-documents.mjs`: 전용 로컬 Supabase에서 14개 검증 통과. 실행 전 최신 migrations와 기존 로컬 인증 fixture가 필요하다.
- `node scripts/verify-role-navigation.mjs`: 19개 검증 통과.
- `npx tsc --noEmit --incremental false`, 변경 파일 ESLint, `npx -y deno check supabase/functions/instructor-documents/index.ts`, `npm run build` 통과.
- 브라우저 입력·암호화 보관·A4 PDF 생성·복원·다운로드를 운영 백엔드와 가상 데이터로 확인했다. 운영 검증 계정·기관·서류·Storage 객체를 삭제했다.
- 실제 AI 요청은 Gemini 대체 분석 성공을 확인했다. OpenAI 성공 응답 및 실제 신분증 OCR 정확도는 별도 확인 범위이다.

## 운영 유의점
- 암호화 키는 변경하면 기존 이력서/판독정보를 해독할 수 없으므로 백업과 명시적인 재암호화 절차 없이 교체하지 않는다.
- 원본 이미지 최대 1 MiB(클라이언트 최적화), 생성 PDF 최대 10 MiB. 암호화 임시저장과 제출 완료는 구분한다.
- 세션은 30분, 다운로드 링크는 5분 후 만료된다. 서류 원본/PDF는 비공개 Storage에, 이력서 구조화 개인정보는 암호문으로 저장한다.
- 담당자와 강사는 AI 추출 결과를 확인한 뒤 저장한다. 분석 실패 시 안내에 따라 재시도하거나 직접 내용을 입력할 수 있다.

프런트엔드는 main push에 연결된 Vercel 자동 배포로 반영한다.

## GPT-5.6 모델 변경
- 사용자 요청으로 이력서 분석, 문서 이미지 영역 인식, 신분증·통장 정보 추출의 OpenAI 모델을 `gpt-5.6`으로 통일했다. 공식 모델 문서상 GPT-5.6 Sol의 별칭이며 이미지 입력과 구조화 출력을 지원한다: https://developers.openai.com/api/docs/models/gpt-5.6-sol
- 모델 문자열은 Edge Function의 `OPENAI_DOCUMENT_MODEL` 상수 한 곳에서 관리하고 UI 분석 안내와 응답 타입도 변경했다. 기존 Gemini 실패 대체 경로는 유지한다.
- 실제 API 호출은 `401 token_invalidated`(API key invalidated)로 거부되었다. 운영 `OPENAI_API_KEY` secret의 digest가 시험에 사용한 키와 일치함을 확인했다. 유효한 키 갱신 전에는 GPT-5.6의 실제 응답을 확인할 수 없고 기존 Gemini 대체 경로가 작동한다.
- TypeScript, 변경 파일 ESLint, Deno 타입 검사를 통과했다. 키 갱신 후 가상 문서·이미지로 실제 GPT-5.6 응답을 재검증해야 한다.
