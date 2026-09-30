# 구성원 비밀번호 재설정 메일 버튼 설계 대조

2026-09-30 · member-password-reset-button

## 구현 일치율: 100% (8/8)

1. 계정 연결 및 편집 권한이 있는 행에만 버튼 표시: `accounts/page.tsx`.
2. 행별 처리 중 비활성화 및 결과 안내: `member-password-reset-button.tsx`.
3. 서버에서 SYSTEM_ADMIN 역할 재확인: `accounts/actions.ts`.
4. person ID·분류로 조직 범위 및 `can_edit` 재조회: `accounts/actions.ts`.
5. 클라이언트 이메일 배제 및 Auth 연결·현재 이메일 일치 확인: `invitations.ts`.
6. 활성 계정에도 재설정 메일 허용, 기존 자동 설정 함수 유지: `invitations.ts`.
7. 최근 `recovery_sent_at` 검사 및 Auth 오류 구분: `invitations.ts`.
8. `AUTH_SITE_ORIGIN` 기반 기존 복구 화면으로 연결: `invitations.ts`.

## 검증
- ESLint, TypeScript, Next.js 운영 빌드 통과.
- 운영 DB 읽기 전용 점검: Auth가 연결된 사업단 수동 구성원 10명 모두 명부 이메일과 Auth 이메일이 일치.
- 실제 구성원에게 테스트 메일을 보내지 않았으므로, 새 버튼 클릭 후 수신함 도착은 운영 배포 후 사용 시점에 확인해야 한다.

## 배포 확인
- PR 병합 후 운영 `/api/version`의 배포 SHA를 확인한다.
