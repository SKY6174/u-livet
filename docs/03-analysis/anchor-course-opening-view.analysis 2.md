# 개설 준비 화면 설계 대조

> 2026-09-19 · Feature: anchor-course-opening-view
> [설계](../02-design/features/anchor-course-opening-view.design.md)

## 일치율: 100% (화면 연결 범위 10/10)

| 항목 | 결과 | 근거 |
|---|---|---|
| 별도 관리자 경로와 메뉴 | 충족 | `/admin/course-plan/opening`, 기존 현황 화면 안내 |
| 단일 원천·기존 자료 보존 | 충족 | 기존 14개 JSON 유지, 16개 계획서 JSON을 서버에서 읽음 |
| 집계·기존 자료 대응 | 충족 | 244명/541시간, 대응 13·추가 3·미제공 1 검증 |
| 검색·결합 필터 | 충족 | 한글 정규화·길이 제한·allowlist·coverage 검사 |
| 교내/교외·인력 구별 | 충족 | 강사·보조강사만 소속 필터에 포함, 보조인력 별도 표시 |
| 교육내용·일정·출처 | 충족 | 원문 날짜/시간·물리 쪽수·파일명·담당교수 표시 |
| 미확정 상태·수치 불일치 | 충족 | P05/P08/P10/P11 예외 보존과 HTML 출력 검사 |
| 접근 경계·자료 노출 | 충족 | loader 실행 테스트, 실제 앱 미인증 리디렉션, 클라이언트 번들 검사 |
| 반응형·폼·안전한 문자열 출력 | 충족 | 390px 가로 넘침 없음, 결합 필터 1개 결과, escape 테스트 |
| 회귀·lint·빌드 | 충족 | 새 검사 9개 + 기존 검사 14개, lint 및 격리 빌드 성공 |

## 실행 결과와 한계

- `node scripts/verify-course-opening.mjs`: 9개 통과. 실제 모듈을 실행하고 React HTML을 검증한다.
- `node scripts/verify-course-plan.mjs`: 14개 통과.
- `npm run lint`: 통과.
- 최초 타입 검사에서 신규 필터의 빈 문자열 인덱스 오류를 발견해 수정했다.
- 작업 폴더의 `.next/types/cache-life.d 2.ts` 중복 생성 파일 때문에 전체 직접 tsc는 별도 중복 오류가 있었다. 해당 파일을 삭제하지 않고 Git 파일과 변경분만 임시 디렉터리로 복사해 `PREVIEW_REVIEW_ONLY=true npm run build`를 실행했다. 앱 전체 타입 검사·정적 생성·최적화가 통과했다.
- 빌드 결과에서 원천 JSON의 상태 문자열은 server 출력에만 있고 static client JavaScript에는 없음을 확인했다.
- agent-browser: 실제 Next 앱 미인증 접근은 `/auth/login?next=%2Fadmin`으로 이동. 홈·로그인 화면 로딩 성공, 페이지 오류와 overlay 없음.
- 관리자 화면은 동일 컴포넌트·모델·빌드 CSS를 사용한 루프백 fixture에서 검증했다. 데스크톱 1280px, 모바일 390px에서 확인했고 상세 열기·GET 결합 필터를 실행했다. 실제 사용자의 MFA 로그인 성공을 가장하지 않았다.
- 골프피팅 결합 필터(로컬창업 + 교내 + 추가 자료)는 1개 과정을 반환했다. 상세를 펼친 뒤에도 `scrollWidth === innerWidth === 390`이었다.

## 남은 운영 작업

원래 `anchor-production-opening`은 Do 상태다. 이 화면 완료는 실제 개설 승인·운영 DB 등록·Production 배포 완료를 뜻하지 않는다.
최종 모집 조건과 원문 불일치를 확정한 후 기존 개설 절차로 진행한다. 별도 담당자 권한 연결은 사용자 지시대로 연기한다.
