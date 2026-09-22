# 동의서 PDF 미리보기 깜빡임 검증

설계 항목 6/6 반영.

- 입력 변경 시 `bytes`를 `null`로 설정하던 경로를 제거했다. 따라서 300ms 지연과 PDF 생성 중에도 기존 캔버스가 DOM에 남는다.
- 새 `bytes`가 들어오면 `PdfPreview`가 별도 캔버스에 먼저 렌더링하고 완료 후 `replaceChildren(canvas)`로 교체한다.
- 렌더 요청의 `active` 가드를 유지해 입력 도중 완료된 이전 요청이 최신 PDF를 덮지 않는다.
- `previewPending`과 생성 오류가 있으면 작성 중 PDF 다운로드가 비활성화된다.
- 생성 오류는 기존 캔버스 위의 안내로 표시된다. 첫 생성 전 진행 문구를 유지한다.
- `npx tsc --noEmit`, `npm run lint`, `npm run build`, `git diff --check` 통과.

실제 로그인된 사용자 계정에서의 수동 브라우저 입력 확인은 수행하지 않았다. 원인을 유발하던 상태 초기화와 미리보기 언마운트 경로는 코드에서 제거했다.
