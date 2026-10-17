# 환불 안내 운영 문안 설계

2026-10-17 · Feature `operational-refund-notices`
Plan: `docs/01-plan/features/operational-refund-notices.plan.md`

## 안내와 자료 보존

공통 서버 컴포넌트 RefundNotice를 과정 소개·상세·신청 화면에서 사용한다.
수강료 0원은 ‘수강료가 무료이므로 환불할 수강료가 없습니다’와 기존 나의 공간의
신청 확인·교육 시작 후 사업단 문의 경로를 안내한다. 자격시험·발급비 등 별도 비용은
해당 기관 안내를 확인하도록 구분한다. null(미기재)이나 공개 offering이 없는 소개는
‘수강료 정보가 등록되지 않았습니다’로 표시하며 무료라고 단정하지 않는다.
양수 수강료는 valid이며 운영 문안인 승인 환불 정책만 제목·버전·본문을 표시한다.
유효 규정이 없으면 확인 중 안내를 표시하고 신청을 비활성화한다.

기존 정책·수강료·자격발급비 규정·제출 문서·청구·입금·환불 자료는 수정하지 않는다.
현재 유료 과정과 환불 정책이 없으므로 새 환불 비율이나 정책 승인을 만들지 않는다.

## 연결 보호

기존 정책 문안 helper에 REFUND 작성 요령 두 줄과 isOperationalRefundPolicy를 추가한다.
제목·버전·본문의 검증용/Issue숫자/dummy-숫자/fixture 및 작성 요령만 있는 본문을 제외한다.
관리자 수강료 설정의 REFUND 선택지에 같은 필터를 적용하고 서버 액션 오류를 번역한다.

private SECURITY INVOKER·빈 search_path 트리거를 life_offering_finance의 INSERT/UPDATE
정책 연결과 offering의 이름·상태 변경에 적용한다. 명시적 `[검증용]` 과정은 허용하되
실제 이름으로 변경하면 검사한다. finance 연결 검사 때 offering을 FOR SHARE로 잠가
동시 이름 변경과 직렬화한다. 공개 API와 추가 실행 권한은 만들지 않는다.
원문 불변·계산 조항·다른 담당자의 환불 승인·은행 지급 절차는 기존대로 유지한다.

## 검증과 배포

- 공통 컴포넌트: 무료·미기재·정상 유료·만료/검증/작성 요령 정책을 구분하고 유해 원문을 노출하지 않는다.
- 로컬 실제 DB 롤백: TS/SQL 분류 일치, 설정 insert/update, 합성 과정명 변경, 정상 규정,
  실제 MFA 수강료 설정 RPC 및 정책·청구·입금·환불 이력 불변, 트리거 비공개 권한.
- lint·형 검사·기존 모집/수료 회귀 및 Preview 검사. 설계 대조 결과를 문서화한다.
- 운영 migration과 ledger 원자 적용 전후 DB 전체 내용 해시·advisor 비교.
- 공개 소개 16개·운영 상세 5개에서 환불 안내와 미기재/무료 구분을 확인한다.
- PR·push·병합·운영 READY·version SHA·health·실제 화면·최근 오류 로그를 확인한다.
