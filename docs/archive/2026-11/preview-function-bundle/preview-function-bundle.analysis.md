# Preview 함수 번들 검증

2026-11-02 · [설계](preview-function-bundle.design.md)

## 설계 대비 구현

| 항목 | 결과 |
| --- | --- |
| 변경 가능한 CDN 제거 | 두 함수의 Supabase client와 PDF dependency를 정확한 npm 버전으로 고정 |
| 과도한 npm 배포 파일 제거 | 단일 ESM bundle로 minify·tree-shaking, node builtin만 external |
| 전체 글꼴·template 보존 | Brotli 복원 후 원본 2,975,032 / 2,968,028 / 77,819바이트 모두 동일 |
| API 배포 자산 | source module에 포함, static_files와 외부 asset 요청 없음 |
| 자동 회귀 방지 | source·tool lock·출력 hash와 4.8MB budget prebuild 검증 |
| 실제 Edge 제한 | 256MB memory / 2,000ms CPU에서 세 PDF와 미인증 요청 검사 통과 |
| PDF 출력 보존 | 세 PDF의 추출 텍스트 및 1,400px 렌더링의 모든 픽셀 동일 |
| 실제 Preview 배포 | bfqwntulxabfrimcypvx의 두 함수에 --use-api 배포 성공 |

구현·로컬·직접 Preview 확인 8/8 일치. PR의 자동 Preview 검사와 병합 후 운영 확인은 release 단계에서 추가한다.

## 측정 결과

- instructor-documents ESM: 4,684,912바이트, 실제 Edge eszip: 4,685,687바이트.
- operation-report-ai ESM: 218,144바이트.
- PDF 생성(원본/압축): 개인정보 동의 76/76ms, 범죄경력 동의 32/35ms, 청렴 서약 79/80ms.
- PDF 크기는 각각 29,182 / 80,066 / 30,759바이트로 원본과 같다. 합성 서명과 드문 한글도 포함했다.
- 번들된 실제 instructor-documents는 미인증 403, operation-report-ai는 401을 반환한다.
- 린트·타입 검사·Next production build·asset/manifest 검사 통과. canonical 함수의 Deno type check도 통과했다.

초기 재현에서는 CDN pako hash 불일치와 전체 npm tree가 포함된 43MB eszip를 발견했다. WOFF2 후보는 256MB 제한에서 실패해 채택하지 않았다. 최종 구현은 native Brotli로 원본 TTF를 복원하며 외부 서비스나 새 비밀값에 의존하지 않는다.
