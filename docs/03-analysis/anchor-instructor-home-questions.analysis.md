# 강사 홈·수강생 질문 설계 대조

2026-09-23 · [설계](../02-design/features/anchor-instructor-home-questions.design.md)

| 설계 항목 | 구현·검증 | 결과 |
| --- | --- | --- |
| 관리자 홈은 관리 현황, 강사 홈은 담당 수업 현황 | 역할별 `/` 분기와 합성 렌더링 16건 | 일치 |
| 강사 수강생·종료 차시·출결·미답변 수 | 권한 제한 요약 RPC와 `/`, My Room 카드 | 일치 |
| 수강생 공개/비공개 선택, 강사 답변 | 두 강의실 UI, Server Action, RPC | 일치 |
| 비공개 권한·철회/만료 차단 | 격리 DB 질문 조회·쓰기·답변 권한 테스트 | 일치 |
| 조회 실패와 빈 상태 구분 | 홈/질문 컴포넌트 및 렌더링 테스트 | 일치 |
| 배포 순서 | Preview migration 적용·검증 후 운영 migration 적용·검증. 코드 배포는 두 DB 준비 후 진행 | 일치 |

원격 두 DB에서 신규 질문 0건, anon RPC 실행 불가, authenticated 실행 가능, 질문 테이블 RLS 활성 상태를 확인했다. 실제 사용자 질문이나 출석 데이터는 테스트에 사용하지 않았다. TypeScript, 수정 파일 ESLint, production build를 통과했다. bkit gap 도구는 기본 작업 폴더에서 설계를 찾기 때문에 이 격리 worktree의 설계를 인식하지 못했다. 위 표는 worktree 설계와 구현을 직접 대조한 결과다.
