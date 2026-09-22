# 디지털배지 상세설계

2026-09-19 · 홈페이지 내부 배지 `U_LIFE_BADGE_V1`. [계획](../../01-plan/features/anchor-digital-badges.plan.md).

## 모델·권한

Next Server Components/Actions → 사용자 인증 RPC → 비공개 schema의 고정 search_path 함수. 새 원장/공유/이력 테이블은 RLS를 켜고 anon/authenticated 직접 GRANT를 회수한다. 공개 조회는 토큰 검증 RPC 하나만 허용한다. 서비스 키 mutation은 없다.

기존 life_issuer_authorizations(기관 명의·권자·기간·승인문서·test_only)를 재사용한다. life_issuer_delegations.kind에 BADGE를 추가하되 기존 COMPLETION/TEACHING 위임이 배지 권한을 자동 부여하지 않는다. 현재 CERTIFIER+유효 BADGE 위임으로 정의 승인·발급·취소를 한다. COURSE_MANAGER는 자신의 기관·기수 배지 정의를 작성하고 요청을 조회한다. 정의 작성자 자기 승인, 수령자 자기 발급 금지. SYSTEM_ADMIN 자동 업무권한 없음.

- life_badge_definitions: 기수별 version, issuer_id, completion_policy_id, BADGE 정책, title/description/achievement, validity_days(null=승인한 만료 없음, 1~3650), DRAFT/APPROVED, 작성/승인/철회 근거. 승인 후 변경 불가. 정정은 새 버전. 최신 DRAFT는 신규 신청/발급 차단. 새 정의 자체는 과거 배지를 무효화하지 않지만 명시적 정의 철회는 기존 배지를 취소 상태로 만든다.
- life_badge_requests: 기수·정의·본인·확인한 정책·사유·대체원본, REQUESTED/ISSUED/CANCELLED/REJECTED. 본인이 신청·철회, 위임 담당자가 반려(사유 필수). 살아있는 최초 신청 및 원본별 대체 신청의 부분 고유키로 동시 중복 방지. 철회/반려 후 재신청 가능.
- life_badge_awards: 발급번호(B-UUID), 정의·요청·기관·수령자·기수·확정 수료run·근거 hash, 발급 시각·만료시각·발급자·대체원본, 고정 native JSON 텍스트/sha256, ISSUED/REVOKED/SUPERSEDED. 승인과 원본 저장을 한 트랜잭션으로 완료. 외부 서비스·가짜 성공 없음.
- life_private.badge_shares: award_id, revision, SHA256 토큰 해시, BADGE_SHARE 정책·확인시각·활성 여부. 원문 토큰은 응답으로 1회만 반환하며 DB에 보관하지 않는다. 배지 기본 비공개.
- life_badge_events: 신청/철회/반려/발급/취소/공유생성·교체/철회/정의 승인·철회 이력. 원토큰/공개 주소를 기록하지 않는다.

## 수료·발급·정정

badge_evidence는 최신 completion_run(시간/id 정렬) 하나가 READY+승인, 현재 academic_revision, academic_sealed, ACTIVE 등록, 종강 완료, 현재 기수 completion policy와 근거 정책 일치·유효를 모두 만족할 때만 반환한다. 본인 active 및 이름·기수·기간·run/정책/승인시각을 snapshot에 고정한다. 기존 certificate_evidence의 증명 기능은 변경하지 않는다.

정의 초안은 기수 현재 수료 정책, 승인 BADGE 정책, 같은 기관의 현재 발급권을 연결한다. 신청/발급 시 최신 승인 정의·정책·권한·근거를 다시 확인한다. 배지 발급권/유효기간은 실제 기관값의 기본 설정 없이 신뢰된 DB 경로로 등록한다.

기수 → 신청 → 기존 배지 순서의 행 잠금으로 발급/중복/정정을 직렬화한다. 반복 발급 요청은 이미 생성한 동일 건 반환. 새 확정 증거가 필요하거나 기존 배지가 취소/만료된 경우 본인이 사유를 넣어 대체 신청한다. 새 배지 생성과 기존 SUPERSEDED 처리가 원자적으로 완료되며 이전 JSON을 바꾸지 않는다. 현재 유효한 배지는 별도 사유 없이 중복 대체할 수 없다.

유효 상태는 저장 상태, 발급권·정의 철회, 만료, 최신 근거 hash를 다시 계산해 판단한다. 발급자의 단순 위임기간 종료는 과거 정상 발급을 소급 취소하지 않는다. 원자료 정정은 STALE 표시와 신규 공유/다운로드 제한. 취소/대체/만료/재검토 이력은 본인 화면에 남는다.

## 공유와 공개 검증

본인만 공유 활성/교체/철회. 활성은 ISSUED, 승인 BADGE_SHARE 정책 및 명시 checkbox 필요. revision을 검사하고 256bit 랜덤 토큰을 생성하며 교체는 이전 토큰을 즉시 무효화한다. 철회는 추가 승인 없이 즉시 적용한다. 기존 링크로 이미 복사한 정보의 회수는 보장하지 않는다.

/badges/verify#token 주소의 fragment를 브라우저가 읽고 주소에서 제거한다. 사용자가 확인을 누르면 POST /api/badges/verify로 전송한다. no-store/no-referrer/noindex, 본문 1KB 제한, 앱 공유/IP(명시 신뢰 프록시일 때만)/DB 전역·토큰별 제한. 토큰이 존재하고 공유가 활성, 수령자가 active, 공유 정책이 유효해야만 최소 정보를 반환한다. 공개 필드: 상태, 발급번호, 배지명·업적, 발급기관, 과정명, 첫 글자만 남긴 이름, 발급/만료시각, JSON SHA256, test_only. 이메일/연락처/내부 person/run ID/점수/철회사유/공개주소/정책원문 비공개.

공유 철회·잘못된 토큰·미존재는 동일 NOT_FOUND. 발급 취소·대체·만료·근거 변경은 공유가 유지되는 동안 정확한 비유효 상태를 표시한다. 받은 native JSON은 브라우저에서 SHA256을 비교하고 파일 자체를 서버로 업로드하지 않는다. 원본 해시 비교는 전자서명이나 Open Badges 적합성 인증이 아니다.

## 화면·RPC

- /mypage/badges: 본인 기수별 승인 정의/기준·발급 신청·대체 신청·요청 철회·배지함.
- /badges/[id]: 본인 또는 BADGE 위임자 상세/고정 원본/현재 상태/처리 이력, 본인 공유 관리.
- GET /api/badges/[id]: 같은 권한+현재 ISSUED에 한해 저장 원문 JSON 다운로드, no-store.
- /credentials/badges: 기관별 정의 초안/승인/철회·신청 승인/반려·발급 취소, 현재 근거 확인.
- /badges/verify, POST /api/badges/verify: 공유 토큰 공개검증.
- 나의 공간/수강이력/증명 관리에서 링크 연결. 카드의 고정 SVG 상징은 장식이며 그 자체가 증명 원본이라고 표시하지 않는다.

RPC: life_badge_options/board/wallet/detail/download, life_create_badge_definition/approve_badge_definition/retire_badge_definition, life_request_badge/cancel_badge_request/reject_badge_request/issue_badge/revoke_badge, life_set_badge_share/life_verify_badge. 승인/발급/취소는 사유·근거를 검사한다.

## 검증과 경계

실제 Auth/RPC로 기관·본인·발급권·배정 관계, 최신 수료·원자료 변경, 유효/만료/취소/대체, 동시 중복 발급, 정의 불변/새 버전, 신청 철회/반려, 공유 미동의·교체·철회·원문 토큰 미저장·최소공개·정책 무효·휴면계정·빈/대형 본문·속도 제한·JSON 해시를 검증한다. 기존203개 회귀, 전체 migration 재생, 로컬 security advisors, lint/build, 브라우저 역할별 발급·공유·철회·모바일 확인.

실제 기관 발급권/보유기간/공개 안내가 없으면 운영 활성화하지 않는다. 외부 전송·지갑 API·서명·표준 3.0 적합성·일괄 발급·복합 역량 조합은 후속. 현재 내부 JSON에 표준 @context나 OpenBadgeCredential 타입을 붙이지 않는다.

근거: [Open Badges 3.0 공식 사양](https://www.imsglobal.org/spec/ob/v3p0/)은 서명/검증/지갑 연동 규격을 별도로 정의한다. [Supabase 함수](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security). 2026-09-19 changelog 확인: 이번 RPC/RLS 패턴에 해당하는 breaking change 없음.
