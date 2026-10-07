# Issue #122 디자인 검수 및 설계 대조

2026-10-07 (KST) · 기준 main `919c4ad` · 브랜치 `codex/design-refresh`

구현 기준: [디자인 가이드](../02-design/features/u-livet-design-guide.md). 이슈의 8개 완료 조건을 코드·실제 브라우저·DB 증거로 대조했다. 8/8 충족, 설계 일치율 100%. 이 수치는 아래 범위의 요구사항 대조 결과이며 서비스 전체에 대한 품질 점수가 아니다.

## 완료 조건과 증거

| 조건 | 확인 | 결과 |
|---|---|---|
| 디자인 전용 브랜치·가이드 | 실제 `codex/design-refresh`, 구현 전 가이드와 작업 명세 작성 | 충족 |
| MD만으로 구현 가능 | 수치·경로·권한·화면 순서·상태·반응형·파일·재현 순서 기록 | 충족 |
| 360/768/1440 및 200% | 공개 7개 화면, 수강생·담당자·강사 화면의 document 폭/컨트롤/제목 측정 | 충족 |
| 키보드·현재 위치 | 모바일 Enter/Tab/Escape/포커스 복귀, 메뉴별 aria-current, 데스크톱 하위 메뉴·inert | 충족 |
| 비로그인/수강생/담당자/강사 | 실제 Auth 계정으로 로그인하여 각각 메뉴·페이지 확인. 권한 검사는 기존 서버 코드 유지 | 충족 |
| 신청·DB·담당자 회귀 | 실제 브라우저 제출 및 DB·담당자 RPC·화면·재접속 등 15개 통합 검사 | 충족 |
| 참고·전후 이미지 | 참고 사이트 데스크톱/모바일/전체메뉴, 360/1440 홈·과정·상세 전후, 역할·메뉴 캡처 | 충족 |
| 기존 빌드·검사 | lint, production build 및 매뉴얼 검증, 과정 16개·역할 23개 검사 | 충족 |

## 실제 실행 결과

- `npm run lint`: 경고 없이 통과.
- `npm run build`: Next 15.5.25 production 빌드·타입·린트, 매뉴얼 v1.0.0~v1.3.0 검증 통과.
- `node scripts/verify-course-catalog.mjs`: 16개 통과. 실제 모집 정보 전달과 신청기간 경계·미기재 상태 포함.
- `node scripts/verify-role-navigation.mjs`: 23개 통과. 기존 역할별 서버 gate와 메뉴 연결 포함.
- `APPLICATION_TEST_DB_DIR=/tmp/u-livet-issues-db npm run test:application-flow -- --production`: 15개 통과. [실제 신청 회귀 증거](assets/issue-122/application-result.json).
- `APPLICATION_TEST_DB_DIR=/tmp/u-livet-issues-db node scripts/verify-design-refresh.mjs`: 66개 통과. [화면 측정 및 검사 JSON](assets/issue-122/result.json).

브라우저는 Chromium, 앱은 production Next build, DB는 최신 전체 마이그레이션을 적용한 전용 로컬 `uc-life-issues`다. DB 응답이나 Auth를 mock하지 않았다. 화면 측정은 360·768·1440 CSS px와 200% 페이지 확대에 해당하는 720 CSS px, 추가 200% 루트 글자 확대를 포함한다. 각 페이지의 문서 가로 넘침, 48px 컨트롤과 30/40px 대표 제목을 검사했다. 비교표는 명명된 내부 가로 스크롤 영역을 사용한다.

수강생은 실제 합성 신청이 있는 `/mypage`와 신청 페이지, 담당자는 실제 명단과 `/admin`, 강사는 실제 배정 과정이 있는 `/instructor`를 확인했다. 모바일 메뉴를 키보드로 열고 Tab 이동, Escape 닫기와 3px 포커스 복귀를 검사했다. 데스크톱 사업단 메뉴는 정상·200% 글자 확대에서 화면 경계, Tab, Escape, 비활성 inert를 검사했다. 홈 검색은 실제 기존 `/courses?q=` 경로로 이동하고 실제 0건 안내를 확인했다.

## 변경 파일

| 파일 | 결과 |
|---|---|
| `tailwind.config.ts`, `src/app/globals.css` | rem 글자·토큰, 제목, 화면 컨트롤 최소 높이, 포커스·감소된 모션 |
| `src/components/common/Header.tsx`, `Footer.tsx` | 두 줄 헤더, 모바일 전체메뉴, 기관 정보 가독성 |
| `src/components/navigation/menu-hint.tsx`, `src/lib/auth/workspace-navigation.ts` | 안내 최소 16px, 신청 경로에서 현재 교육과정 표시. 권한 생성 유지 |
| `src/app/page.tsx`, `src/components/portal/ui.tsx` | 둥근 소개·기존 검색·실제 모집·안내·빈/실패 상태 |
| `src/app/courses/page.tsx`, `src/components/course-guide/catalog.tsx`, `src/lib/course-guide/model.ts` | 큰 카드·표, 이미 조회된 모집 상태/기간/비용 |
| `src/app/courses/[id]/page.tsx`, `src/app/offerings/[id]/page.tsx`, `src/app/offerings/[id]/apply/page.tsx` | 모바일 신청 정보 먼저, 교육·비용·접수기간, 동의 터치 영역 |
| `src/components/student-learning/dashboard.tsx`, `src/app/admin/offerings/[id]/manage/page.tsx` | 신청 과정·신청일·상태·취소/심사 가독성 |
| `src/components/course-workspace/course-header.tsx` | 관리자 제목의 모바일 전체 폭·30/40px, 기존 출력 행동 유지 |
| `scripts/verify-course-catalog.mjs`, `scripts/verify-role-navigation.mjs`, `scripts/verify-design-refresh.mjs` | 현재 화면에 맞는 기존 검사와 실제 반응형·키보드 재현 도구 |
| `docs/01-plan/features/issue-122-design-refresh.plan.md`, `docs/02-design/features/issue-122-design-refresh.design.md`, `issue-02-design-refresh.md`, `u-livet-design-guide.md` | 계획·추적 설계·요청 명세·최종 가이드 |
| 본 분석·`docs/04-report/features/issue-122-design-refresh.report.md`·`assets/issue-122/` | 검수·완료 보고·비식별 증거 |

신청 액션·Auth·서버 권한 gate·RPC·스키마·마이그레이션 변경 없음. 홈은 이미 있는 공개 과정 조회 결과에서 실제 접수 중인 과정을 먼저 고른다. 기존 검색·링크·동의/제출·취소/심사 행동을 연결한다.

## 참고와 전후 화면

참고: https://anchor.hj.ac.kr/rise/main.do, 2026-10-07 확인. 아래 이미지는 검수 자료이며 제품에는 해당 기관의 로고·사진·문구를 복사하지 않았다.

| 내용 | 이미지 |
|---|---|
| 참고 데스크톱 | [reference-desktop.png](assets/issue-122/reference-desktop.png) |
| 참고 모바일·실제 전체메뉴 | [reference-mobile.png](assets/issue-122/reference-mobile.png), [reference-mobile-menu.png](assets/issue-122/reference-mobile-menu.png) |
| 홈 360/1440 전후 | [전 360](assets/issue-122/before-home-360.png), [후 360](assets/issue-122/after-home-360.png), [전 1440](assets/issue-122/before-home-1440.png), [후 1440](assets/issue-122/after-home-1440.png) |
| 과정 360/1440 전후 | [전 360](assets/issue-122/before-courses-360.png), [후 360](assets/issue-122/after-courses-360.png), [전 1440](assets/issue-122/before-courses-1440.png), [후 1440](assets/issue-122/after-courses-1440.png) |
| 상세 360/1440 전후 | [전 360](assets/issue-122/before-offering-360.png), [후 360](assets/issue-122/after-offering-360.png), [전 1440](assets/issue-122/before-offering-1440.png), [후 1440](assets/issue-122/after-offering-1440.png) |
| 역할 화면 | [수강생 360](assets/issue-122/learner-360.png), [담당자 360](assets/issue-122/manager-360.png), [강사 360](assets/issue-122/instructor-360.png). 각 1440 캡처도 같은 폴더에 보관 |
| 메뉴 | [모바일 수강생](assets/issue-122/mobile-menu-learner-360.png), [모바일 담당자](assets/issue-122/mobile-menu-manager-360.png), [데스크톱](assets/issue-122/desktop-admin-menu.png), [글자 200%](assets/issue-122/desktop-admin-menu-text200.png) |

전후 캡처는 전용 로컬 DB의 공개 과정 자료와 `[검증용]` 합성 과정·계정을 사용한다. 반복된 합성 테스트 과정은 운영 모집 정보가 아니다. 테스트 비밀번호·토큰·세션과 운영 개인정보를 포함하지 않는다.

## 검수 중 보완과 한계

관리자 갱신 버튼의 기존 40px utility가 공통 높이를 덮던 부분을 화면 컨트롤 규칙으로 보완했다. 확대 시 사업단 하위 메뉴는 헤더 기준 중앙에 두고 hover 이동 구간도 연결한다. 신청 상세에서도 교육과정 메뉴가 현재 위치를 보여준다. 모바일 Escape 포커스를 추가했다. 캡처를 직접 확인해 좁은 모바일 검색창과 관리자 제목을 전체 폭으로 보완했고 250px 이상의 실제 너비를 회귀 검사에 추가했다.

기존 회귀 도구의 SSR tooltip 기대값, 현재 계정 정보 화면·과정 SYSTEM_ADMIN gate, catalog alias mock을 현재 코드에 맞췄다. 제품 권한을 바꾸거나 거부 검사를 제거한 것이 아니며 기존 gate의 허용/거부를 실행한다.

React 품질 점검: 기존 서버 데이터·권한 검사, client Header의 조건 없는 hook, 브라우저 이벤트 포커스, 서버 과정 표시·명시적 빈/실패 상태를 유지했다. 인쇄 문서의 별도 pt 규격과 매뉴얼 산출물은 수정하지 않았다.

미충족된 이슈 요구사항은 없다. 신청 검증은 전용 로컬 최신 스키마에 한정되며 운영 실신청 검증으로 확대 해석하지 않는다. 기존 `npm ci` 의존성 audit 경고는 이번 디자인 변경에서 의존성을 변경하지 않았고 별도 범위다. 기존 `test:core`는 다른 로컬 `uc-life-core:55321`에 쓰는 도구여서 그 DB를 변경하지 않고 새 전용 DB 통합 검증을 실행했다.

다음 단계: PR 검사 통과 후 승인된 squash merge와 Vercel Git 연동 production 배포, 실제 commit·health 및 공개 화면 확인.
