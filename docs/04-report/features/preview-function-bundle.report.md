# Supabase 함수 413 수정 결과

2026-11-02 · [계획](../../01-plan/features/preview-function-bundle.plan.md) · [설계](../../02-design/features/preview-function-bundle.design.md) · [검증](../../03-analysis/preview-function-bundle.analysis.md)

한글 글꼴 static file과 전체 npm tree 때문에 서버 측 배포 제한을 넘던 함수를 단일 ESM bundle로 변경했다. 글꼴과 PDF template는 native Brotli로 무손실 보관하고 원본 바이트를 복원한다. 변경 가능한 CDN import를 제거하고 버전·integrity를 고정했다.

동의서 함수의 실제 eszip는 4,685,687바이트로 5MB 제한보다 작다. AI 함수는 218,144바이트다. source·build lock·출력 hash 및 크기 검사를 prebuild에 추가해 오래된 생성물과 크기 초과를 차단한다.

실제 hardened Edge Runtime의 256MB·2초 CPU 제한에서 세 종류 PDF 생성과 미인증 요청 차단을 확인했다. 생성 PDF는 원본과 추출 텍스트·렌더링 픽셀이 모두 일치했다. 기존 renderer, 서명, 인증·권한 처리, DB schema와 AI 동작은 변경하지 않았다.

Preview 프로젝트 bfqwntulxabfrimcypvx에서 두 함수의 서버 측 API 배포가 성공했다. 린트, 타입 검사, 앱 production build와 자산·manifest 검사도 통과했다. [운영 가이드](../../operations/edge-function-bundles.md)에 재생성 및 검증 절차를 기록했다.

PR 자동 Supabase/Vercel 검사 후 병합하고 Supabase main 함수 상태, 운영 endpoint 및 Vercel 버전·health를 확인한다. 최종 PR·배포 근거는 완료 응답과 PR 설명에 남긴다. 실제 사용자 문서나 데이터는 생성·변경하지 않는다.
