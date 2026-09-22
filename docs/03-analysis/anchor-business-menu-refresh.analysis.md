# Gap Analysis: anchor-business-menu-refresh

> Date: 2026-09-21 | Design: anchor-business-menu.design.md v2.0.0

## Match Rate: 100% (12/12)

- [x] 데스크톱 사업단 관리 텍스트는 `/admin` 직접 링크다.
- [x] 호버·키보드 포커스 시 화면 내 2열 메뉴가 열린다.
- [x] 왼쪽은 서브메뉴명만, 오른쪽은 호버·포커스 항목의 설명을 표시한다.
- [x] 독립적인 펼침 버튼과 aria-expanded/controls를 제공한다.
- [x] Escape 복귀, 포인터·포커스 이탈 닫힘, 숨겨진 링크 Tab 제외를 처리한다.
- [x] 모바일 직접 홈 링크와 펼침 버튼을 분리한다.
- [x] 모바일 단일 열 메뉴와 화면 높이 내 스크롤을 제공한다.
- [x] 중복 OfficeNav와 layout 참조를 제거한다.
- [x] 홈 이름·역할 안내 문구를 삭제한다.
- [x] 강조 카드, 업무별 아이콘, 1/2/3열 그리드와 reduced-motion 대응을 적용한다.
- [x] 중첩 보고서 경로에서도 정확히 하나의 서브메뉴만 활성화한다.
- [x] 기존 역할별 메뉴·서버 권한·legacy redirect를 유지한다.

## Verification

- `npx tsc --noEmit --incremental false`: pass
- `npm run lint`: pass
- `node scripts/verify-role-navigation.mjs`: 18 checks pass
- `npm run build`: pass
- `git diff --check`: pass
- 브라우저: 실제 Header/Admin 컴포넌트를 합성 identity와 함께 별도 로컬 fixture로 렌더링했다. 실제 로그인 없이 UI를 확인했으며 배포 코드의 인증을 우회하지 않았다.
- 1440px: 호버 설명 전환, Escape 닫힘/상위 링크 포커스 복귀, 닫힌 링크 tabIndex=-1, Tab 진입, 포인터/포커스 이탈 닫힘 통과.
- 1024px: 열린 패널 경계 x=410.1~922.1로 viewport 안에 배치됨.
- 320/390/768/1024/1440px: 가로 넘침 없음.
- 390px: 모바일 하위 메뉴 펼침, 내부 스크롤, 링크 선택 후 닫힘 통과.
- 데스크톱/모바일 상위 텍스트 클릭의 `/admin` 대상과 보고서 링크의 `/admin/reports` 대상을 확인했다. fixture 링크 이동을 확인한 것이며 실제 서버 인증 이동의 E2E 검증은 아니다.
- 브라우저 JS 오류 없음. React hooks, 서버/클라이언트 경계, 권한별 링크, 아이콘 접근성 검토 완료.

## Evidence

로컬 비공개 검증 파일: `tmp/business-menu-refresh/desktop.png`, `menu-home.png`, `menu-report.png`, `mobile.png`, `mobile-menu.png`.

## Remaining gaps

없음. Report 단계로 진행한다.

## 2026-09-22 메뉴 닫기 포커스 회귀

- 기존 하위 링크 클릭 핸들러는 활성 링크를 둔 채 `aria-hidden`을 설정했다. 수정 후 패널 내부 포커스를 먼저 펼침 버튼으로 옮기며, 닫힌 패널에는 `inert`를 적용한다([MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert)).
- 실제 Header와 MfaPanel을 React StrictMode로 렌더링했다. 합성 역할·라우터·인증 응답만 사용하는 localhost fixture에서 확인했다.
- Escape 후 펼침 버튼 복귀, 닫힌 메뉴를 건너뛰는 Tab, 열린 메뉴 마지막 링크에서 Tab 이탈 시 외부 포커스 유지, 메뉴 재열기 통과.
- 하위 링크 선택 직후 포커스가 펼침 버튼에 있고 이후 MFA 입력칸으로 이동함을 확인했다. 합성 코드 6자리 자동 제출 및 성공 화면 이동도 통과했다. 브라우저 콘솔 경고·오류 없음.
- 역할별 메뉴 회귀 19개, MFA 회귀 50개, 전체 lint 통과.
- 최초 전체 build는 기준 커밋 `7274df2`의 별도 강사 엑셀 기능 타입 오류(`pool-excel.tsx:22`, Sheet 배열과 행 배열 불일치)로 중단됐다. 이 파일은 다른 작업에서 수정 중이며 이번 메뉴 수정에 포함하지 않았다.
- 해당 작업의 수정 커밋 `cdf2a0b`를 기준으로 다시 통합한 뒤 전체 production build, lint 및 69개 회귀 검사를 모두 통과했다. 메뉴 수정에 남은 설계 차이는 없다.
