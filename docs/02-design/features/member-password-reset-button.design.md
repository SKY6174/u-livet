# 구성원 비밀번호 재설정 메일 버튼 설계

2026-09-30 · member-password-reset-button · Dynamic

계획: [member-password-reset-button.plan.md](../../01-plan/features/member-password-reset-button.plan.md)
기반: [구성원 관리](anchor-member-management.design.md), [수동 구성원 Auth 생성](manual-member-auto-auth.design.md)

## 화면과 서버 동작
- `/admin/accounts`의 관리 열에 `재설정 메일` 버튼을 둔다. 사업단·강사·수강생 중 이메일과 연결 Auth 계정이 있고 대상 편집 권한이 있는 행만 표시한다. Auth 미연결 수동 명부와 강사 풀 행은 제외한다.
- 버튼은 행의 person ID와 현재 분류만 서버 액션에 보낸다. 제출 중 비활성화하고 결과를 해당 행의 `role=status` 또는 `role=alert`로 표시한다. 성공 문구는 메일 서비스가 요청을 수락했다는 뜻으로 표현한다.
- 서버 액션은 `memberAdmin(true)`로 SYSTEM_ADMIN을 확인하고, `life_member_directory`를 해당 person ID·분류로 다시 조회하여 대상별 `can_edit`, 이메일, 활성 명부 상태를 확인한다. 클라이언트에서 전달한 이메일이나 권한 플래그는 사용하지 않는다.
- 발송 함수는 서비스 역할 서버 클라이언트로 `life_auth_links`의 연결 Auth user ID를 조회하고 Admin API로 현재 이메일을 확인한다. 명부 이메일과 일치할 때만 `resetPasswordForEmail`을 호출하고 `/auth/reset-password`로 돌려보낸다. 기존 자동 최초 설정 메일의 활성화 완료 건너뛰기는 유지한다.
- 최근 `recovery_sent_at`이 10분 이내이면 다시 보내지 않고 중복 요청을 안내한다. Auth API 오류, 연결 부재, 이메일 불일치는 성공으로 표시하지 않는다.

## 권한과 데이터
- 새 테이블이나 DB 권한을 추가하지 않는다. 대상 조회는 기존 조직 범위·활성 상태를 검증하는 `life_member_directory`를 이용한다.
- `SUPABASE_SERVICE_ROLE_KEY`는 서버 코드에서만 사용한다. 전송 대상은 검증된 Auth user의 이메일이다.
- 사업단 최초 등록의 설정 메일, 외부 강사·수강생 초대 메일, 활성화 완료 계정에 초대 메일을 보내지 않는 기존 동작은 유지한다.

## 검증
- Auth 연결·관리 권한이 있는 행만 버튼이 보이고, 비연결/읽기 전용 행에는 보이지 않는지 확인한다.
- 서버에서 변조한 person ID·분류, 권한 부족, 이메일 불일치, Auth 오류와 10분 중복 요청을 거절하는지 확인한다.
- lint·TypeScript·빌드와 기존 구성원 회귀 검사 후 PR을 병합하고 운영 배포 SHA를 확인한다. 실제 구성원에게 진단 메일을 임의로 발송하지 않는다.
