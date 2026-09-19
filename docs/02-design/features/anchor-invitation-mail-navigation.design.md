# 초대 메일 새 창 열기 설계

2026-09-19

`supabase/templates/invite.html`의 기존 버튼에 `target="_blank"`와 `rel="noopener noreferrer"`를 추가한다. href의 SiteURL, 경로, TokenHash fragment는 그대로 둔다. 버튼 아래에 브라우저 새 탭에서 열기·모바일 길게 누르기 안내를 추가한다.

보안 헤더나 초대 검증 코드는 변경하지 않는다. Supabase 설정은 `mailer_templates_invite_content` 하나만 PATCH하며 운영·Preview 각각 readback으로 정확한 본문을 대조한다. 기존 제목·SMTP·공개 가입·유효시간도 읽어 변경 없음을 확인한다.

실제 수신자에 대한 최초 동의·승인 기록을 참조한다. 계정이 아직 이메일 미인증이고 기존 초대가 만료된 경우 기존 계정을 대상으로 inviteUserByEmail을 한 번 호출한다. 재시도는 자동화하지 않으며, 요청 전후 시각·사용자 ID 불변·역할 부재·발송 상태를 비공개 실행 기록에 남긴다.

검증은 템플릿 파싱으로 목적지·target·rel을 확인하고 운영 URL의 정상 HTTP 응답과 프레임 차단을 확인한다. 실제 초대 토큰을 검사 목적으로 열거나 로그로 출력하지 않는다. 받은편지함에서의 본인 설정 완료는 후속 확인으로 남긴다.
