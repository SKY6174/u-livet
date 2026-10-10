# Issue 152 — 설계 대비 검증

작성일: 2026-10-10

## 일치율: 100% (화면·권한 설계 항목 8/8)

| 설계 항목 | 구현·근거 |
|---|---|
| 업무 메뉴 없음 안내 | `/admin/page.tsx`의 sections=[] 안내, 담당자 요청·새로고침·내 정보 링크 |
| 역할별 업무 메뉴 | 기존 officeSections 유지, 관리자 5종·복수 역할 회귀 검사 |
| 무권한 차단 | 관리자 layout·각 하위 화면 gate 유지, 모든 직책의 roles=[] 명부 fixture에서 과정 화면·기존 등록 URL 차단 |
| 권한 부족 안내 | `/admin/not-found.tsx` |
| 로딩 안내 | `/admin/loading.tsx`의 status |
| 조회 실패 안내·재시도 | `/admin/error.tsx`의 alert와 reset 버튼 |
| 데이터 없음·조회 실패 구분 | LearnerRequestAlerts 실제 컴포넌트의 requests=[]/data=null 검증 |
| 요청한 운영 역할 부여 | 활성 사업단 명부 구성원 10명에 소속 조직 COURSE_MANAGER, 신규 역할·감사 각각 10개, 누락·중복 0 |

## 실행 결과

- `node scripts/verify-role-navigation.mjs`: 27개 통과. 합성 identity로 서버 컴포넌트·데스크톱/모바일 메뉴·업무 gate·알림·경계 화면을 검증한다.
- `npm run lint`: 통과.
- `npx tsc --noEmit`: 통과.
- `npm run build`: 매뉴얼 검사, Next.js 15.5.25 컴파일·lint·type 검사·페이지 생성 통과.
- `git diff --check`: 통과.
- 운영 DB 재조회: 신고 계정 COURSE_MANAGER 확인; 명부 대상 10명 모두 유효한 역할 정확히 1개, 감사 10개, 누락 0·중복 0.
- 기존 역할을 가진 관리자와 역할이 없던 사업단 명부 계정의 차이를 운영 DB에서 확인했다. 현재 명부의 권한은 사용자의 명시적 일괄 부여 요청에 따라 보완했다.

## 검증 한계와 후속

실제 계정의 비밀번호·로그인 세션을 사용하지 않았으므로 계정별 실제 브라우저 로그인 검증을 수행했다고 주장하지 않는다. 운영 계정 검증 근거는 실제 역할 원장 재조회이며, 화면·서버 역할 경계는 해당 구조의 합성 identity 회귀 검사다. 새 역할은 새 서버 요청의 life_identity에서 읽으며 사용자는 새로고침 후 업무 메뉴를 확인할 수 있다. PR 병합 후 운영 배포 커밋·READY·HTTP 상태를 별도로 확인한다.
