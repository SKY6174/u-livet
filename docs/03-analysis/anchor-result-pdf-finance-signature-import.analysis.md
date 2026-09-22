# Gap Analysis: anchor-result-pdf-finance-signature-import

2026-09-23 · 설계 일치도 100% (12/12)

PDF.js가 추출한 실제 3개 원본에서 예산 행 4/4/5개와 장학금 11명·792,000원, 16명·1,344,000원, 14명·1,008,000원을 각각 정확히 읽었다. 신청·집행 합계도 원본과 일치한다. 숫자 제안은 원문 쪽수/인용을 표시하고 관리자가 선택해야 반영되며, 확정된 예산은 가져오기로 변경할 수 없다. 이 과정은 AI 키와 독립적이다.

원본 서명은 담당자가 PDF 쪽과 실제 영역을 직접 골라 `sourceSignature`로 보관한다. 현재 책임강사의 전자 서명 및 제출 검사는 그대로 유지된다. 기존 3개 PDF에는 서명이 없어 이관하지 않았다. 기존 4-key 콘텐츠와 새 5-key 콘텐츠가 모두 유효함을 Preview DB에서 확인했고, 원본 파일 연결·교체 방지 트리거를 배포했다.

운영 3개 초안에는 원본 해시와 revision을 확인한 뒤 예산·장학금을 이관했다. 이관 후 콘텐츠/예산 DB 검증, 합계 및 감사 이력을 확인했다. `npm run lint`, `npm run build`, `node scripts/verify-operation-documents.mjs`, Supabase security advisor가 통과했다.

실제 AI 서술 제안의 라이브 검증은 운영·Preview `OPENAI_API_KEY`가 유효하게 설정된 뒤 가능하다. 재무 가져오기는 해당 키 없이 검증했다.
