# 사업단 메뉴·업무 홈 개선 결과

> Date: 2026-09-21 | Feature: anchor-business-menu-refresh | Status: Complete

사업단 관리 클릭은 업무 홈으로 이동하며, 데스크톱 호버 메뉴는 이름 목록과 오른쪽 설명 패널로 구성했다. 모바일은 홈 이동과 펼침 버튼을 분리했다. 중복 가로 메뉴와 홈의 이름·역할 안내를 삭제하고, 과정 운영 강조 카드와 아이콘을 적용한 반응형 업무 카드로 정리했다.

기존 권한별 업무 경로, 서버 접근 제어, legacy 과정 개설 redirect를 유지했다. 타입 검사·린트·18개 회귀 검사·프로덕션 빌드를 통과했다. 실제 컴포넌트와 합성 identity를 사용한 브라우저 fixture에서 호버, 키보드, 모바일 동작과 320~1440px 가로 넘침을 검증했다. 실제 로그인 기반 E2E 검증은 수행하지 않았다.

상세 검증은 [갭 분석](../../03-analysis/anchor-business-menu-refresh.analysis.md)에 기록했다. 사용자의 요청에 따라 현재 main 브랜치에 커밋하고 origin/main으로 push한다.
