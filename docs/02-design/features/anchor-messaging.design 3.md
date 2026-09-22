# 안내문자 관리 상세설계

2026-09-19 · 전체 설계 A10/API22/T23의 예약 관리 구현 단위

## 경계

Server Actions → 사용자 RPC → 고정 search_path 비공개 함수. COURSE_MANAGER 기관 권한으로 본인 기관 기수만 관리한다. 브라우저 직접 테이블 읽기/쓰기는 모두 회수하고 요약 RPC로 제공한다. service_role은 테스트 처리 RPC만 호출 가능하며 일반 사용자는 호출할 수 없다. 실제 네트워크 전송 코드는 없다.

기관 설정은 DISABLED(기본) 또는 TEST만 허용한다. LIVE는 이 migration에 존재하지 않는다. TEST도 수동 로컬 스크립트만 수행하며 결과는 TEST_PROCESSED다. 실제 SENT/DELIVERED로 변환하지 않는다. 업체 확정 후 운영 adapter/인증 연락처 수집/웹훅 검증/worker 배포를 별도 인수해야 한다.

## 데이터

- life_message_settings: 기관, DISABLED/TEST. 신뢰된 운영 경로만 설정.
- life_message_templates: 기관, OPERATIONS/MARKETING, 대상 조건(APPLICANTS/ACTIVE/PENDING_PAYMENT/COMPLETED), 고정 제목·본문, 승인자/근거/버전, 유효 여부. 승인 후 문안·종류·대상 불변, enabled만 변경 가능. 본문에는 {{course}}만 치환한다. 자유 입력 발송을 지원하지 않는다.
- life_private.message_contacts: 기관+사람, 매 검증/변경마다 신규 UUID, opaque recipient_ref, masked_label, verified_until, disabled_at. 본인확인 모듈이 승인된 개인정보 처리근거·검증 참조를 가지고 등록해야 한다. 전화번호 평문 수집/임시 가짜 인증 없음. 브라우저에는 마스킹과 상태만 반환. 본인 연결 해제 지원.
- life_message_marketing_policies: 승인된 MARKETING 정책 중 SMS 수신용으로 별도 지정한 정책만 허용. 일반 홍보 정책을 SMS 동의로 추정하지 않는다.
- life_message_preferences: 기관+사람, SMS 홍보 선택동의, 승인 MARKETING 정책 ID, revision. 이 기능의 정책은 SMS 목적임을 승인 등록자가 검토한다. 정책 만료 시 홍보 제외. 철회는 정책이 만료되어도 가능하다.
- life_message_consent_events: 순번, 기관/사람, 정책버전, 동의/철회, 시각. 선택동의 여부로 수강/학습을 막지 않는다.
- life_message_jobs: 기관/기수/템플릿/생성자, 본문 snapshot, 예약시각, PREVIEW/QUEUED/BLOCKED_CONFIG/CANCELLED/FINISHED, PREVIEW 15분 만료, 요청 UUID 고유(기관+생성자), 생성시각. 미리보기 후 본문/대상 추가 변경 불가.
- life_message_deliveries: job+person 고유, contact UUID snapshot, ELIGIBLE/QUEUED/SKIPPED/PROCESSING/UNKNOWN/TEST_PROCESSED/CANCELLED, 제외 사유, 고유 idempotency UUID, lease token/만료, 처리시각. 재시도도 같은 idempotency 키를 사용. 실제 번호/광고 문구를 이력 payload에 복사하지 않는다.
- life_message_events: job, actor, action, 시각. 기관 관리자만 조회.

## 판정과 잠금

대상 모집단은 해당 기수 신청자, 최대 1,000명. 승인 템플릿 조건으로 신청 유효/수강중/납부대기/확정수료를 판정한다. MARKETING 역시 모집단 밖 사람을 임의 지정하지 못한다. 계정 active+auth 연결, 검증된 기관 연락처, SMS 홍보 선택동의/정책 유효를 판정한다. 관리자에게는 집계와 최대 5개 마스킹 표본만 제공한다.

기관별 advisory transaction lock을 예약·취소·동의·연락처해제·처리 함수에 공통 사용하여 상태 경쟁을 직렬화한다. 미리보기는 요청 키로 중복 생성 방지, 동일 키의 다른 본문/기수/시각은 충돌. 미리보기→예약 시 재검사하되 새 대상은 추가하지 않는다. 연락처가 변경되면 재미리보기가 필요하다. 처리 시 생성자의 현재 기관 권한, 계정/관계/동의/연락처/템플릿을 재검사한다.

홍보 철회는 대기 중인 해당 기관 홍보 recipient를 즉시 SKIPPED로 변경한다. 테스트 처리 중인 항목도 결과 기록 시 재검사하므로 철회 후 성공 표시하지 않는다. 실제 업체 전송 직후의 철회에는 외부 전송 취소를 보장할 수 없으므로 향후 adapter 계약에서 경계를 고지한다.

예약은 현재~30일, 과거 요청은 새 미리보기 필요. DISABLED이면 BLOCKED_CONFIG. 설정 후 자동 전송/자동해제하지 않는다. 예약취소 가능, PREVIEW 만료면 새 미리보기. 일반 직원 화면에 재발송 버튼을 두지 않는다. 테스트 처리기는 QUEUED/TEST만 claim, lease 만료는 UNKNOWN으로 바꿔 자동 중복처리를 금지. 현재 token+유효 lease만 결과 기록 가능. UNKNOWN은 새 시도 대신 확인 대상으로 남긴다. 실제 공급자 재시도/결과 대사 구현은 이후 단위다.

## 화면·RPC

- /admin/messages: 문안(종류/고정 대상), 기수, 한국시간 예약 → 미리보기 저장. 집계·표본·문안·예상비용 미정, 연결 대기 고지 후 예약. 최근 100개 작업 이력, 선택 작업 상세·취소.
- /mypage/notifications: 본인 가입·신청 동의 또는 연락처/수신설정 기록이 있는 기관별 연락처 인증 상태·연결해제, SMS 홍보 원문 선택 동의/철회, 최근 동의 이력. 전화번호 등록은 본인확인 연계 준비 중이라고 명시.
- life_message_options, life_message_overview(job nullable), life_message_preview(f,t,scheduled,request_key), life_message_queue(j), life_message_cancel(j), life_notification_preferences, life_set_marketing(o,policy,accepted), life_disconnect_contact(o).
- service_role 전용 life_message_test_claim(j), life_message_test_finish(d,token). 로컬 전용 CLI가 TEST 모드만 호출. 예약시각 전 claim 차단, 비용은 null.

## 검증·운영 인수

기관/역할/타인 격리, 직접 테이블 접근, 동의 없는 홍보, 운영 안내 독립성, 미인증/만료/변경 연락처, 예약 후 철회/삭제/권한회수, 미리보기 만료·멱등성, 취소/claim 경쟁, lease 만료/오래된 결과, 동일 결과 재처리를 검증한다. 기존 127개 회귀 + build/advisors + 브라우저 사업단 예약·취소 및 학습자 동의 화면을 확인한다.

실제 발송과 개인정보 처리정책 공개 전 기관 승인/업체 계약/발신번호/단가/보유기간/인증 연계/법적 문구와 야간 광고 제한 등을 별도 확정해야 한다. 이 문서는 법정 문안이나 보유기간을 임의 확정하지 않는다.

기술 근거: [Supabase 함수](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
