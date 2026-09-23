# 과정 개발·심의 연차·주관 구분 설계 대조

2026-09-24 · [설계](../02-design/features/anchor-development-year-track.design.md)

## 일치율: 100% (9/9)

1. 두 기관의 2025~2029 공식 연차와 기존 앵커 2026 행 보존: 로컬·Preview DB 확인.
2. 제안 root의 `track` 원장과 기존 NULL 자료 보존: migration 및 로컬 조회 확인.
3. 앵커 3개 센터/산학 재직자 코드 검증: 로컬 인증 RPC 검사 통과.
4. 후속 버전의 기존 주관 보존: 기존 제안 재시작 RPC 유지.
5. 목록의 기관·연차·주관 DB 필터, 100건 제한 전 필터: SQL 대조.
6. 현재 승인 개발·개편 건수의 동일 필터: SQL 대조, staff 분기 로컬 검사.
7. 관리자/강사 URL 분류와 새 제안 필수 입력: 화면 및 타입 검사.
8. 상세 화면 기관·연차·주관 표시, 미분류 기존 건 표시: 컴포넌트 대조.
9. 기존 권한·초안 비공개·직접 원장 접근 유지: 로컬 인증 RPC 검사와 Preview Security Advisor 확인.

검증: `node scripts/verify-development-classification.mjs`, 역할 메뉴 검사, lint, TypeScript, production build, `git diff --check` 통과. Preview DB에 migration 적용 후 두 기관 각각 공식 5개 연차를 읽기 전용 확인했다. 운영 반영과 배포 확인은 출시 단계에서 수행한다.
