# 재설정 메일 송경영 전용 권한 설계

2026-09-30 · member-reset-song-only · Dynamic

계획: [member-reset-song-only.plan.md](../../01-plan/features/member-reset-song-only.plan.md)

## 권한
- 기존 `life_identity`의 `is_super_admin`은 `member_entry_operators`의 지정된 `SUPER_ADMIN` 슬롯에서 계산된다. 세션 서버의 `getSessionIdentity`는 Supabase `getUser()`로 현재 Auth 이메일을 검증해 반환한다.
- 공용 서버 도우미는 `is_super_admin === true`, 현재 이메일 `kysong@uc.ac.kr`, 활성 `SYSTEM_ADMIN` 역할을 모두 요구한다. 표시 이름이나 `user_metadata`로 결정하지 않는다. 환경마다 다른 Auth UUID는 코드에 넣지 않는다.
- 목록 화면은 이 도우미가 참일 때만 버튼을 렌더링한다. 서버 액션도 발송 함수 호출 전에 도우미를 다시 실행한다. 다른 관리자는 변조한 form 제출로도 발송할 수 없다.

## 화면 및 검증
- 버튼 텍스트를 `재설정 메일 발송`으로 변경한다. 대상별 `can_edit`, 연결 계정, 이메일 검사는 유지한다.
- 송경영·다른 SYSTEM_ADMIN·일반 구성원에 대한 서버 권한 결과와 버튼 표시 조건을 검증한다. lint, TypeScript, 빌드 및 운영 배포 SHA를 확인한다. 실제 메일은 임의 발송하지 않는다.
