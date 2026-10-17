# 운영 증명·배지 읽기 모델 설계

계획: `docs/01-plan/features/operational-credential-records.plan.md`
참고: 기존 anchor-certificates/anchor-digital-badges 설계와 certificate-portfolio 가이드. 현재 운영 신규·구형 증명/배지 원장과 발급권은 0건이다.

1. 비공개 stable/security definer/빈 search_path 함수 `operational_credential_context(offering, person, issuer)`가 기존 운영 과정 분류, 검증 인물 분류, issuer.test_only를 조합한다. null person/issuer는 아직 수령자/발급권을 정하지 않은 정의·신청에만 허용한다. issuer가 지정된 경우 실제 존재하고 test_only=false여야 한다. 일반 역할 execute는 회수한다. 기존 권한 helper에 이 필터를 넣지 않는다.
2. 원본 열을 그대로 유지하는 private security_invoker view 6개를 추가한다: operational_issuer_authorizations, operational_certificate_requests/issues, operational_badge_definitions/requests/awards. 일반 역할의 직접 접근은 전부 회수한다. 요청 view는 연결된 발급 원본의 snapshot/artifact issuer.test_only=true도 제외한다. 발급권의 현재 상태와 snapshot이 달라도 과거 검증 발급을 정상으로 재분류하지 않는다. badge 정의의 정상성은 발급권/과정으로 판단하고, 검증 인물의 신청만 제외해 정상 정의는 보존한다.
3. 기존 읽기 함수 7개(certificate_list/detail/options, badge_options/board/wallet/detail)의 public 원장 조회를 운영 view로 치환한다. 인증/기관·본인·발급 위임/추가 인증·반환형/grants/정렬은 유지한다. certificate_detail은 기존 readable 검사에 운영 원본 존재 여부를 AND한다. badge_detail은 운영 원본을 조회해 기존 FORBIDDEN 처리로 연결한다. badge_board는 운영 과정 view로 직접 기수 접근도 차단한다.
4. 목록과 집계에 동일한 운영 view를 사용한다. 현재 발급 통계 UI/별도 발급 집계 RPC는 없으며 모든 원본 0건이다. 새 지표 UI를 만들거나 과거 확정 보고서를 재작성하지 않는다. 로컬에서 정상/검증 혼합 자료의 count, 상태별 count, 과정·인물별 group 집계를 검증해 동일 필터가 적용됨을 보장한다.
5. 원장 UPDATE/DELETE/취소/재발급/원문 변경은 수행하지 않는다. QR 진위확인, 상태 판정, 다운로드, 발급/승인/worker/카운터/공유·감사 함수는 변경하지 않는다. 공개 토큰을 수집하거나 출력하지 않는다. 검증용 경고는 실제 검증 원본의 진위확인에서 유지한다. 구형 certificates/badge_assertions도 0건이며 현재 화면에서 사용하지 않는다.
6. 로컬 단일 transaction/ROLLBACK으로 정상·검증 과정/인물/발급권·snapshot-only 검증 발급·정상 취소/대체 이력을 혼합한다. 관리 목록/board/본인 wallet·상세/총수·상태별 집계·다른 기관과 비로그인·private view 차단, 정상 취소/대체 이력 유지, 이름 변경 후 검증 분류 유지와 원본 hash를 확인한다. 운영 34개 기존 항목에 발급 원장/원본 파일/토큰/카운터/배지 공유·이벤트·발급권·위임·서식을 더해 전후 count/hash를 비교한다. 보호할 원본/진위확인/쓰기 함수들의 definition hash도 보존한다.

출시: Preview 전체 migration과 보안/집계 테스트 후 push/PR/check/merge, 같은 SQL atomic 운영 적용, READY/버전/health, 관리자 증명·배지/본인 화면·모니터링 회귀, 원본/보안 advisor 비교. 생성 장애가 계속되면 처음부터 서울 임시 Preview를 생성하고 초기 실행 완료 뒤 Git 연동을 진행한다.

## 운영 화면 검증 중 추가 확인

모니터링의 기관 선택지가 사용자 역할의 모든 기관을 표시하여, 운영 과정이 모두 제외된 `[검증용] 수료 판정 시험 조직`도 남아 있었다. 해당 과정 통계에는 포함되지 않지만 선택지에서도 제외한다. `admin/monitoring`은 이미 허용된 운영 과정들의 org_id 집합에 해당하는 기관만 필터 옵션으로 전달한다. 기관 원본/역할/권한/기관 관리 명부는 변경하지 않는다. 이는 과정 필터의 실제 조회 결과 범위와 선택지를 일치시키는 수정이다. 한 TSX 파일의 작은 수정이며 새로운 테스트 파일 대신 빌드와 실제 선택지/기존 과정 표시를 검증한다.
