# 강사 필요서류 설계 대비 확인

- 기능 검증: 설계의 강사 구분, 필수서류, PDF 3종, 좌우 입력·미리보기, 별도 창, 암호화, 기관 경계, 버전 보관, 재시도 방지, 지급 검사 10개 항목 구현·확인.
- 신규 실 API/DB 검증 12개: 교내 보조 등록 거부, 교외 집계, 이력서·동의서 강제, 미선택·서명 누락 거부, 암호화 초안, 서버 PDF 생성, 재시도, 거부 응답 최신 상태, 타인·직접 테이블 접근 및 최종본 변경 거부, 세션 해제, 지급 완료 조건.
- 기존 서류 15개, 링크·PIN 15개, 대장 18개, 엑셀 18개 회귀 통과. 총 78개.
- 원본 성범죄 양식과 새 개인정보·청렴서약 PDF를 Poppler로 렌더링해 확인. 실제 서버 보관본 3종은 A4 1페이지/PDF 1.7, KoPub Dotum TTF 글꼴 내장.
- 브라우저: PIN 인증, 좌측 입력/우측 PDF 갱신, 직접 서명→실제 Edge 저장→제출 이력·대장 상태 반영, 390px 모바일 가로 넘침 없음, 사업단 대장에서 문서별 새 창 열기 확인.
- ESLint/TypeScript/Deno 타입 검사 통과. production build 통과. 최신 main의 뒤로가기 제거 변경을 통합한 최종 빌드도 통과.
- 변경 사항: KoPub OTF subset의 호환성 문제를 피하기 위해 동일 계열 KoPub Dotum TTF를 사용. Edge는 Deno의 prototype 제한을 준수하는 fontkit 2 어댑터를 사용하며, 브라우저와 서버는 같은 서식 renderer를 사용.
- 운영 migration `20260922063935_anchor_instructor_consent_forms` 적용. 새 테이블 관련 보안 WARN/ERROR 없음. RLS no-policy INFO는 직접 읽기를 차단하고 인증된 Edge만 허용하는 기존 보안 구조에 부합. [Supabase 설명](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- 새 FK/조회 인덱스의 unused-index INFO는 생성 직후 상태이며 유지. [Supabase 설명](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).
- 새 문서 처리 Edge 운영 배포 완료. 운영 endpoint의 새 consent action이 비인증 요청을 403으로 차단하는 것을 확인.
