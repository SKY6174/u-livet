# 운영대상별 매뉴얼 상세설계

2026-09-22 · anchor-operation-manuals · 계획: ../../01-plan/features/anchor-operation-manuals.plan.md

## 콘텐츠와 범위
8종 문서는 learner, internal-instructor, external-instructor, course-operator, certification, finance, performance, administrator로 구분한다. 직책이 권한을 자동 부여하지 않음을 공통 안내한다. 교외·보조강사 문서는 계정의 실제 강사 권한과 배정을 전제로 하며 명부 등록만 된 보조인력이 LMS를 사용할 수 있다고 설명하지 않는다.

각 문서는 문서번호·대상·담당·준비사항·업무 섹션(경로/준비/번호 절차/완료 확인/주의사항)·점검표·FAQ·근거 파일을 갖는다. 공통 시작 안내와 개정 이력은 release 안에 포함한다. 저장소 현재 소스 기준의 초판이며 운영환경 기능/기관 규정의 승인 여부를 보장하지 않는다는 적용 범위를 명시한다.

## 원문과 버전
- src/content/manuals/releases.json: current 및 등록된 버전 목록. 모든 버전은 독립 JSON 원문 파일.
- src/content/manuals/1.0.0.json: 첫 발행본. 공통 안내도 포함해 이전 버전이 나중 변경에 영향을 받지 않는다.
- MAJOR: 절차/권한의 큰 변경, MINOR: 새 업무·화면, PATCH: 오탈자/보충. 문서 묶음 단위 버전으로 관리한다.
- 발행 도구는 등록 버전별 원문 SHA-256과 배포물 SHA-256을 public/manuals/{version}/manifest.json에 고정한다. 기존 발행본 내용 변경·파일 손실·변조는 검사/재발행에서 실패한다. 변경은 새 JSON 및 새 버전으로만 발행한다. Git에서도 이전 파일과 manifest를 보존한다.
- 문서 승인/검수 상태를 기관 승인과 혼동하지 않는다. 승인 전이라도 제작본을 열람할 수 있으며 승인자는 허위 기재하지 않는다.

## 웹
- /manuals: 소개·현재 버전·8종 대상 카드·내용 검색·전체 PDF·개정 이력 링크. 검색어는 URL q, 길이 제한, 대상별 본문까지 검색.
- /manuals/[audience]: 현재 버전으로 임시 redirect. 다음 발행 때 최신판을 가리킨다.
- /manuals/[audience]/[version]: 등록된 실제 조합만 렌더링, 잘못된 경로 404. 목차/본문/버전 선택/대상별 PDF 및 Markdown/인쇄. 구판은 최신판 링크와 구판 안내를 표시한다.
- /manuals/history: 버전별 일자·내용·대상·적용범위 및 합본 링크.
- Footer에 이용 매뉴얼 연결. 문서는 개인정보·비밀설정 없는 공개 사용 안내이며 각 업무 페이지의 인증/권한은 기존대로 동작한다.
- Next.js 서버 컴포넌트와 타입 모델, 인쇄 버튼만 작은 client 컴포넌트. 기존 스타일과 모바일 단일열, 의미있는 heading/목차/키보드 접근.

## 배포 문서
scripts/build-manuals.mjs는 JSON에서 개별 Markdown과 한글 글꼴 포함 A4 PDF 8종 및 합본 PDF를 생성한다. 제목·버전·발행일·문서번호·목차·본문·변경 이력·쪽수 포함. 기존 프로젝트 pdf-lib와 fontkit을 사용하여 Node만으로 재발행 가능하게 한다. public 경로는 웹 다운로드, output/pdf는 이번 제작 결과의 로컬 전달본이다.

## 검사
- 등록 버전/current 일치·대상/문서번호/섹션 중복·필수 절차·실제 메뉴 경로/근거 파일·버전별 산출물 해시.
- 구판 보존 및 변경 거부를 임시 디렉터리에서 확인. 미등록 대상/버전의 거부.
- lint/type/build와 실제 웹 검색·본문·버전 목록·다운로드·404·모바일 넘침.
- PDF 텍스트 추출로 모든 문서/절차 포함 확인, 페이지 렌더링으로 한글·줄바꿈·여백·페이지 전환 확인.
