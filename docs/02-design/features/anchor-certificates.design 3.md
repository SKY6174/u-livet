# 이수증·강사 경력증명 상세설계

2026-09-19 · 전체 설계 API19–21, D05, T20–22 구현

## 신뢰와 범위

CERTIFIER 역할 외에 기관·유효기간·문서종류가 제한된 발급 위임이 있어야 승인한다. 발급권/서식/직인 자료는 기관 확인문서 reference와 별도 승인자를 가진 신뢰된 DB 관리 경로에서 등록한다. 웹에서 스스로 발급권을 만들 수 없다. D05는 미확정이며 실제 설정 기본값은 없다. 발급 설정은 승인 뒤 원문 불변, 철회는 별도 revocation 필드만 허용한다.

두 문서종류 COMPLETION(이수증), TEACHING(강의경력증명서). 기관별 승인된 고정형 v1 서식, 승인 문구·명의·직인 이미지(PNG) 또는 명시 승인된 직인생략 근거를 사용한다. 복잡한 서식 편집과 직인 업로드 UI는 후속이다. 로컬 설정 test_only는 PDF·상세·진위조회 모두 검증용이라고 표시한다.

## 모델·상태

- life_teaching_logs: 회차+강사 고유키, 실제 강의분·내용·revision, 제출/승인. 담당강사만 제출, 과정담당의 별도 승인. 자기실적 승인 금지. 재제출은 승인 해제, 이전/변경 값 감사기록. 휴강·회차시간 변경 시 승인 근거도 재검토 필요.
- life_issuer_authorizations: 기관·사업단장 직함/성명·유효기간·승인근거·승인자·직인생략근거 또는 private seal_id·test_only.
- life_issuer_delegations: 발급권+처리자+문서종류+유효기간. 현재 CERTIFIER와 함께 검증한다.
- life_certificate_templates: 기관·종류·서식버전·제목·본문·승인/철회, 허용 고정 레이아웃 v1.
- life_certificate_requests: 기수·본인·종류·대체원본·사유, REQUESTED/GENERATING/ISSUED/REVOKED. 본인 신청만 허용하며 현재 요청 재전송은 기존 건 반환. 대체 신청은 근거 변경 또는 취소된 원본에 대해 사유 필수.
- life_certificate_issues: 요청 고유키, 번호, 승인자·발급권·서식·고정 스냅샷, 근거 fingerprint, GENERATING/ISSUED/REVOKED/SUPERSEDED, 파일 해시, 생성 lease/token, 실패 안내. 문서번호는 기관/종류/KST연도 카운터 원자 증가.
- private.certificate_files: issue_id 고유키, PDF bytea(최대 2MB). SHA256은 life_certificate_issues에 저장한다. 초기 범위에서는 비공개 DB에 원본 저장하여 파일과 완료 상태를 한 트랜잭션으로 확정한다. 원본 파일은 일반 테이블 API에 노출하지 않으며 대규모 운영 시 private object storage로 이관한다.
- private.certificate_tokens: 생성 중 원문 토큰, 완료 시 삭제. issue에는 SHA256 해시만 남김. PDF에 256bit 토큰 QR 포함.

## 근거와 정정

이수증: 최신 수료 승인·기수 academic_revision 일치·활성 수강등록·유효 수료정책. 확정 스냅샷의 과정명/기간/이름 및 승인 시점 근거 고정. 강의경력: 취소되지 않은 종료 회차의 제출 revision과 승인 revision이 일치하는 실제 강의일지 합계. 예정시간은 증명하지 않는다.

근거 fingerprint는 현재 확인된 원자료의 정규화 JSON hash. 승인 시 고정하고 PDF 완료/다운로드/진위조회 시 비교한다. 출결·성적·실적 정정으로 달라진 원본은 재검토 상태로 조회하며 다운로드를 차단한다. 원본을 삭제하지 않고 정정 신청→새 승인→새 번호·PDF를 발급한 뒤 기존 원본을 SUPERSEDED로 만든다. 같은 원본의 재다운로드는 같은 바이트/번호. 취소는 발급 위임자만 사유와 감사기록을 남긴다.

## 생성·진위확인

사용자 권한으로 신청/승인을 DB 트랜잭션 처리한다. 서버 전용 서비스 자격증명은 승인된 건의 생성 job만 claim한다. lease 120초, nonce 일치, 이미 완료된 건 재생성 금지. 서비스 함수는 대상 권한/상태/근거/발급권의 현재 유효성을 다시 확인한다. 실패는 GENERATING+오류로 남겨 승인 화면에서 재시도한다. 성공은 실제 PDF 바이트·SHA256·발급상태 원자 저장. 서비스 비밀키는 서버 전용이며 로컬 실행에서는 로컬 키만 주입한다.

PDF는 Next.js Node 런타임에서 pdf-lib + 한글 임베드 폰트 + QR로 생성한다. 고정 입력 길이·줄바꿈·복수 페이지 대응으로 잘림을 방지한다. 승인된 직인은 서버 생성에만 전달하며 자산 다운로드 기능은 두지 않는다. PDF 원본 조회는 사용자 세션과 객체 권한을 재검사하고 no-store/attachment로 반환한다.

/verify는 토큰을 URL fragment로 받아 POST로 조회한다. GET 쿼리/서버 로그에 원문을 넣지 않고 no-referrer/no-store, index 제외. 익명 RPC는 토큰 hash별·전체 DB 제한을 적용하고 전체 원장 SELECT는 금지한다. 앱은 기본 공유 제한을 사용하며 신뢰된 프록시 설정을 명시한 경우에만 IP별 제한을 사용한다. API는 Content-Length 없는 요청도 실제 읽은 바이트를 1KB로 제한한다. 반환은 발급번호·종류·기관·발급일·마스킹 이름·현재 상태·PDF해시·test_only만. 조회 불일치는 확인불가이며 위조로 단정하지 않는다. 등록 해시 비교는 원본 대조 보조이며 PDF 전자서명 인증으로 설명하지 않는다.

## 화면과 검증

/mypage/certificates: 본인 신청·상태·상세·다운로드·정정 신청. /instructor/records: 회차별 실적 제출. /credentials: 기관 실적 승인·증명 승인·생성 재시도·취소. /certificate/[id]: 본인/인가 발급담당만 상세. /verify: 공개 최소정보 조회.

SQL/Auth/Data API 테스트와 기존 66개 회귀, 실제 서버 PDF 생성 실패/재시도·sha 일치, 브라우저 흐름, PDF 텍스트/QR/렌더 이미지 점검 후 범위별 보고한다. 운영 MFA·공식 문안·보유기간·외부 전자서명은 기존 운영 준비 과제다.
