# U-LiVET 디자인 구현 가이드

2026-10-07 (KST) · #122 · `codex/design-refresh`

## 참고와 채택 이유

참고 URL: https://anchor.hj.ac.kr/rise/main.do (2026-10-07 데스크톱 1440px, 모바일 360px 확인). 두 줄 헤더, 둥근 배너, 배너 아래 검색, 주요 서비스와 기관정보 순서를 채택한다. 모바일 전체메뉴 버튼 클릭 후 전체메뉴 영역과 카테고리를 확인했다. 참고 사이트의 픽셀 수치를 추정하거나 기관 로고·문구·사진을 복사하지 않는다.

U-LiVET은 교육과정 찾기와 신청 확인을 우선하므로 4개 공통 메뉴와 본인 권한 공간만 주 메뉴에 배치한다. 검색은 기존 `/courses?q=` 필터로 연결한다. 홈은 기존 공개 과정 조회 `getCourseCards()`를 사용해 공개·접수기간 내인 과정을 먼저 골라 최대 3개를 보여준다. 최근 3개를 먼저 자르면 모집 중인 다른 과정을 놓칠 수 있어 화면 선택 순서를 이렇게 정한다. 공지·과정 자료를 임의 생성하지 않는다. 기존 로그인 홈의 수강생·강사·사업단 업무 구성은 유지한다.

## 실제 변경 대상 파일

작성 전 아래 경로의 존재를 확인했다.

| 파일 | 변경 |
|---|---|
| `tailwind.config.ts`, `src/app/globals.css` | 글자·제목·간격·색·버튼·포커스·반응형 토큰 |
| `src/components/common/Header.tsx` | 로고·회원 메뉴와 주 메뉴 두 줄, 모바일 Escape·포커스 복귀 |
| `src/components/common/Footer.tsx` | 기관정보 보조 글자와 링크 가독성 |
| `src/app/page.tsx`, `src/components/portal/ui.tsx` | 공개 홈·실제 모집 과정·공통 카드·빈 상태 |
| `src/app/courses/page.tsx`, `src/components/course-guide/catalog.tsx` | 검색·카드·리스트 가독성, 모집 정보 표시 |
| `src/lib/course-guide/model.ts` | 이미 조회된 모집 상태·일시를 화면 모델로 전달. DB·권한 동작 변경 없음 |
| `src/app/courses/[id]/page.tsx`, `src/app/offerings/[id]/page.tsx`, `src/app/offerings/[id]/apply/page.tsx` | 필수 정보·행동을 먼저 배치, 큰 제목·입력·안내 |
| `src/components/student-learning/dashboard.tsx` | 기존 신청 목록 글자·상태·신청일·취소 버튼의 가독성 |
| `src/components/course-workspace/course-header.tsx` | 관리자 과정 제목의 30/40px과 모바일 전체 폭, 출력 링크의 기존 행동 유지 |
| `src/app/admin/offerings/[id]/manage/page.tsx` | 기존 신청 심사 목록의 이름·신청일·상태·결정 가독성 |

기능 권한 기준 `src/lib/auth/workspace-navigation.ts`의 권한·링크 생성은 그대로 사용하고, `/offerings`에서도 교육과정 메뉴의 현재 위치 표시만 보완한다. `src/components/navigation/menu-hint.tsx`는 안내 글자의 최소 16px만 보장한다. 신청 서버 액션·RPC·마이그레이션은 수정하지 않는다.

## 토큰과 반응형 기준

rem 기준 루트 16px를 유지해 브라우저 글자 확대를 따른다. 본문 1.125rem(18px), 본문 줄높이 1.6. 기존 `text-xs/text-sm`의 화면 정보도 최소 1rem(16px), `text-base`는 1.125rem. 장식 로고 이미지 내부 글자 및 인쇄 템플릿은 별도 규격을 유지한다.

| 항목 | 수치 |
|---|---|
| 주 메뉴 | 1.25rem(20px), 600 굵기, 최소 높이 3rem |
| 페이지 대표 제목 | 모바일 1.875rem(30px), 768px 이상 2.5rem(40px), 줄높이 1.2 |
| 구역 제목 | 모바일 1.5rem(24px), 768px 이상 1.75rem(28px), 줄높이 1.35 |
| 카드 제목 | 1.25rem 이상, 긴 제목은 줄바꿈 |
| 버튼·입력·select | 최소 높이 3rem(48px), 주요 버튼 글자 1.125rem·보조 행동 최소 1rem, checkbox는 1.25rem과 48px 이상 label 영역 |
| 본문/보조/브랜드 | `#1e293b` / `#475569` / navy `#0f2b5c`, teal `#115e59`, 배경 `#f8fafc` |
| 간격 | 0.5/0.75/1/1.5/2/3rem 단계. 구역 간 모바일 2.5rem, 데스크톱 4rem |
| 최대 너비·여백 | 내용 80rem(1280px), 좌우 모바일 1.25rem(20px), 768px 이상 2rem |
| 모서리 | 입력·버튼 0.75rem, 카드 1rem, 배너 1.5rem |
| 포커스 | 3px `#0066cc`, offset 3px. 색만으로 상태를 표현하지 않음 |
| 반응형 | 640px 2열 카드, 1024px 데스크톱 메뉴, 큰 과정 카드 1280px 3열. 모든 flex 자식 `min-width:0`·줄바꿈 |

360px, 768px, 1440px에서 검수한다. 200% 확대는 1440px 브라우저의 유효 너비 720 CSS px로 확인하고 실제 글자 200% 확대도 추가 검사한다. 메뉴와 신청 버튼은 본문 폭을 넘지 않는다. 폭이 필요한 비교표는 명명된 가로 스크롤 영역에만 둔다.

## 메뉴·권한·키보드

| 메뉴 | 경로 | 표시 대상 |
|---|---|---|
| 앵커사업 소개 | `/about` | 전체 |
| 운영절차 | `/operation-procedure` | 전체 |
| 수강안내 | `/terms` | 전체 |
| 교육과정 소개 | `/courses` | 전체, 신청 주 진입점 |
| 나의 학습 | `/mypage` | 수강생 |
| 사업단 관리 | `/admin` | 현재 workspace-navigation의 사업단 구성원 |
| My Room | `/instructor` | 강사 역할 |
| 내 정보 | `/mypage` | 강사 역할이 없는 사업단 계정 |

상단 1행은 기존 U-LiVET 로고와 로그인/본인·로그아웃. 2행은 주 메뉴. 모바일 1024px 미만은 상단 전체메뉴 버튼을 사용한다. 버튼에 `aria-expanded/controls`, 메뉴에 접근 가능한 이름, 현재 링크에 `aria-current`를 유지한다. 모바일 메뉴 Escape는 메뉴를 닫고 토글 버튼으로 포커스를 돌린다. 데스크톱 사업단 하위 메뉴의 기존 클릭·Tab·Escape·focus 이동을 유지하고 48px 토글을 제공한다. 메뉴 숨김은 권한 검사를 대체하지 않는다.

## 화면별 구성과 상태

- 공개 홈: 헤더 → 둥근 서비스 소개·교육과정 보기 → 기존 과정 검색 → 실제 모집 중 교육과정 → 신청/나의 학습/수강안내 진입 → 기관정보 footer. 모집 중인 과정이 없으면 준비 안내와 전체 과정 링크. 조회 실패는 실패 안내로 구분한다.
- 과정 목록: 대표 제목 → 기존 검색·운영방식 필터 → 결과 수·보기 방식 → 카드/비교표. 카드에 과정명·모집상태·교육기간·신청기간·수강료·상세 링크를 표시한다. 연결된 모집 정보가 없으면 `모집 안내 확인`, `별도 안내`, `수강료 미기재`처럼 확인 상태를 명시한다. 검색 0건은 검색어/필터 변경 안내.
- 과정 상세: 과정명·소개 → 교육/신청 기간·장소·정원·비용·신청 진입점 → 교육내용·강사·수료 안내. 1024px 미만에는 신청 정보가 먼저 보이도록 한다. 모집 마감·보관 과정은 신청 링크 대신 해당 상태 안내를 보여준다.
- 신청: 제목·과정명 → 교육기간·접수기간·수강료 → 기존 정책·필수 동의 → 기존 신청서 제출 → 나의 신청 현황. 신청 불가 안내를 명확히 하고 disabled 동작을 유지한다. 입력 오류는 기존 `role=alert`, 성공은 `role=status`, 처리 중은 기존 버튼 안내.
- 나의 학습: 기존 학습 구조를 유지하고 신청 과정·상태·신청일·취소 행동을 큰 글자로 표시한다. 관리자 명단: 기존 과정 헤더 → 설정 → 신청 심사 카드. 신청자·신청일·상태를 명시적인 label로 보여주고 결정은 기존 ActionForm을 유지한다.
- 로딩: 서버 페이지는 실제 조회 완료 후 표시한다. 검색·신청 처리 중은 기존 동작을 유지한다. 존재하지 않는 데이터나 작동하지 않는 버튼을 추가하지 않는다.

## 화면 증거와 구현 순서

참고·변경 전·변경 후 이미지: `docs/03-analysis/assets/issue-122/`. `reference-desktop.png`, `reference-mobile.png`, `reference-mobile-menu.png`; `before/after-home-360.png`, `before/after-home-1440.png`, `before/after-courses-360.png`, `before/after-courses-1440.png`, `before/after-offering-360.png`, `before/after-offering-1440.png`. 이미지를 보지 않아도 위 토큰·구조로 구현할 수 있다.

구현 순서: 토큰·헤더 → 공개 홈 → 카드·상세·신청 → 신청 목록 → 역할/키보드/반응형 및 DB 회귀 → 문서 갱신. 변경 파일 목록·실행 결과·최종 캡처와 남은 사항은 `docs/03-analysis/issue-122-design-refresh.analysis.md`에 기록한다.

검수 체크리스트: 화면 너비·200% 확대, 버튼 48px, 보조 글자 16px, 키보드 메뉴·포커스·활성 메뉴, 비로그인/수강생/담당자/강사 메뉴, 기존 검색 결과·빈 결과, 실제 신청·DB·담당자 조회·재접속, lint/build/관련 회귀. 운영 화면 배포의 commit/health를 확인한다.

재현: `npm ci`, `npm run build`, `node scripts/setup-application-test.mjs` 후 출력된 전용 DB 디렉터리를 `APPLICATION_TEST_DB_DIR`로 지정한다. `npm run test:application-flow -- --production`으로 실제 로그인·신청 fixture를 생성한 다음 `node scripts/verify-design-refresh.mjs`를 실행한다. 비밀번호·세션은 `/tmp`의 비공개 파일만 사용하며 PR에 포함하지 않는다. 디자인 검사 도중 계정·권한·DB를 조작하거나 응답을 mock하지 않는다.
