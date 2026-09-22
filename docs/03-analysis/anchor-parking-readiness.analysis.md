# 주차권 운영 준비 안내 — 설계 대조

> 2026-09-22 · [설계](../02-design/features/anchor-parking-readiness.design.md)

일치율 **100% (6/6)**. 기존 관리자 RPC의 과정·재고·센터 응답을 활용했고, 조회 연도 미지정 과정 목록, 총 재고, 입력 위치 앵커, 세 지정 승인자, 계정 안내, 구성원 목록 링크를 구현했다. 계정 준비 완료 여부를 추정하거나 DB의 과정 소속을 변경하지 않았다. 기존 발급 RPC와 권한은 변경되지 않았다.

`npx eslint src/app/admin/parking/page.tsx --max-warnings=0`, `npm run build`, `git diff --check` 통과. 실계정이 없는 상태여서 승인 실행 자체는 이 변경에서 재검증하지 않았다.
