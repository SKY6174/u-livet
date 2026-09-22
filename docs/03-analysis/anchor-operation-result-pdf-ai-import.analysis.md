# Gap Analysis: anchor-operation-result-pdf-ai-import

> 2026-09-22 · 설계: `docs/02-design/features/anchor-operation-result-pdf-ai-import.design.md`

## Match Rate: 92%

기존 결과 PDF 보관 RPC를 재사용했고 과정 관리자만 가져올 수 있다. 최종 제출본 교체는 거부한다. PDF.js에서 본문과 운영사진을 추출하고 gpt-5.6-terra가 필드·강의표·확인사항을 제안한다. 제안을 체크해 초안에 반영하며 예산·서명·최종 제출은 현행 절차로 남긴다. 3개 원본 샘플에서 각각 사진 10/26/8장을 식별했고 압축한 전체 사진 크기가 3MB 제한 안에 드는 것을 확인했다. 린트·빌드·Deno 타입 검사 및 Preview/운영 DB 마이그레이션과 함수 배포가 성공했다.

미완료 검증: 사용자 MFA 세션으로 실제 업로드→AI 응답→저장·인쇄까지의 브라우저 흐름을 실행하지 못했다. Preview에는 `OPENAI_API_KEY` secret이 없어서 Preview AI 호출은 503을 반환한다. 운영에는 키 이름이 등록돼 있으나 모델 사용 권한까지 실제 사용자 요청으로 확인하지 못했다. 따라서 이 분석은 사용자 환경의 완전한 동작 확인을 뜻하지 않는다.

다음: Preview 키를 설정한 뒤 관리자 계정으로 3개 원본 각각 가져오기, 강의표·사진 순서, 미리보기, 임시저장, 인쇄를 확인한다.
