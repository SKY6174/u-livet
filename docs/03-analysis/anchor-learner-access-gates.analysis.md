# Gap Analysis: anchor-learner-access-gates

> Date: 2026-09-23 | Design: `docs/02-design/features/anchor-learner-access-gates.design.md`

## Match Rate: 100%

## Summary

설계한 로그인 보조 동선, 과정별 서류 자격 조회, 탭·과정 제한, 제출 RPC의 우회 방지, 오류 안내와 통합 검증을 모두 구현했다.

## Implemented Items

- [x] 소셜 로그인을 기본 영역에 유지하고 이메일 로그인을 카드 오른쪽 하단으로 이동
- [x] 개인정보 처리 안내를 같은 하단 행의 왼쪽에 배치
- [x] 승인된 수강신청원서 기반 환불 자격 계산
- [x] 현재 학사 revision·sealed 상태·수료 정책·ACTIVE 등록을 포함한 장학금 자격 계산
- [x] 과정별 자격 조회 RPC와 서버 조회 계층 구현
- [x] 자격 없는 탭 비활성화와 선행 조건 안내
- [x] 후속 서류 과정 목록을 자격 있는 과정으로 제한
- [x] 제출 RPC에서 동일 조건을 재검증해 직접 호출 우회 차단
- [x] 승인 전 차단, 원서 승인 후 환불, 수료 승인 후 장학금, 타 사용자 격리 검증

## Missing Items

- 없음

## Changed Items

- 없음

## Verification

- `node scripts/verify-learner-document-workflow.mjs`: 통과
- `node scripts/verify-learner-documents.mjs`: 세 양식 PDF 1.7 회귀 통과
- `npx tsc --noEmit`: 통과
- 변경 파일 ESLint: 통과
- `npm run build`: 통과
- 로그인 화면 시각 확인: 통과
- 로컬 인증 세션 SSR 확인: 자격 보유자는 세 탭 활성, 미보유자는 후속 두 탭 비활성

