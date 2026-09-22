# Gap Analysis: anchor-operation-result-pdf-ai-import

> 2026-09-22 · 설계: `docs/02-design/features/anchor-operation-result-pdf-ai-import.design.md`

## Match Rate: 92%

기존 결과 PDF 보관 RPC를 재사용했고 과정 관리자만 가져올 수 있다. 이전에 보관된 원본도 재업로드 없이 선택해 분석할 수 있다. 최종 제출본 교체는 거부한다. PDF.js에서 본문과 운영사진을 추출하고 gpt-5.6-terra가 필드·강의표·확인사항을 제안한다. 제안을 체크해 초안에 반영하며 예산·서명·최종 제출은 현행 절차로 남긴다. 3개 원본 샘플에서 각각 사진 10/26/8장을 식별했고 압축한 전체 사진 크기가 3MB 제한 안에 드는 것을 확인했다. 린트·빌드·Deno 타입 검사 및 Preview/운영 DB 마이그레이션과 함수 배포가 성공했다.

미완료 검증: Preview에는 `OPENAI_API_KEY` secret이 없어서 실제 AI 응답을 확인할 수 없다. 운영에는 키 이름이 등록돼 있으나 모델 사용 권한까지 실제 사용자 요청으로 확인하지 못했다. 따라서 AI 제안·강의표 생성의 완전한 동작 확인은 남아 있다.

후속 로컬 검증: 합성 관리자·강사 계정으로 권한·예산·서명 회귀를 통과했다. 브라우저에서 PDF 1개를 업로드해 사진 10장을 추출하고 임시저장·재조회·7쪽 인쇄 화면에서 사진 10장을 확인했다. 보관된 원본을 다시 불러올 때 새 사진 0장으로 판정해 중복 적용 버튼이 비활성화되며, 담당 강사에게 가져오기 UI가 보이지 않고 원본 목록/AI API 모두 403을 반환했다. 로컬 AI 연결 실패는 원본·사진을 유지한 채 한국어 안내를 제공한다. 실제 `gpt-5.6-terra` 응답은 운영 키가 있는 관리자 세션에서 별도 확인이 필요하다.

다음: Preview 키를 설정한 뒤 관리자 계정으로 3개 원본 각각 가져오기, 강의표·사진 순서, 미리보기, 임시저장, 인쇄를 확인한다.

## 근거 표시 보강 · 2026-09-22

AI 구조화 응답에 필드와 강의표 행별 원문 쪽수·인용을 추가했다. Edge Function이 해당 쪽의 PDF 추출 텍스트에 인용이 실제 포함되는지 확인하며, 일치하지 않는 필드와 강의표는 화면에서 근거 확인 필요로 표시하고 자동 선택하지 않는다. 키가 없는 Preview 또는 키가 무효한 운영 환경에서는 파일·사진 보관을 유지하면서 설정 문제를 담당자에게 안내한다.

`deno check`, 원문 인용 검증 5개 사례, `npm run lint`, `npx tsc --noEmit --incremental false`, `npm run build`, `node scripts/verify-operation-documents.mjs`가 통과했다. Preview와 운영 Edge Function을 다시 배포했다. 실제 모델 생성 응답은 아직 검증되지 않았으며, 과거 `anchor-instructor-documents` 운영 검증에서 같은 운영 OpenAI secret이 `401 token_invalidated`로 거절된 기록이 있다. 유효한 OpenAI API 키를 Preview와 운영에 설정한 후 샘플 PDF로 근거 일치·강의표·사진을 최종 확인해야 한다.
