# DB 개설 과정만 원서에 사용: 검증

2026-10-07 · application-document-db-courses

## 설계 대조

구현 항목 12/12, 일치율 100%. 목록 필터링, 조회 실패/빈 결과 구분, 준비 기수 안내, ID 선택 및 기간 표시, ID prefill, 모델 검증, 서버 실재 여부 확인, 신규 DB ID 필수화, 공개 범위 확인, 기존 재시도 보존, 권한 보존, 실제 PDF 접수를 확인했다.

공개 범위는 `life_catalog`의 행 존재만으로 판단하지 않는다. 이 뷰는 RLS에 의존하므로 SECURITY DEFINER 안에서는 비공개 DRAFT도 조회된다. 기존 공개 소개 함수 `life_private.course_introductions`의 명시적 공개 조건과 published guide 연결을 사용하여 화면 목록과 동일한 기준을 적용했다.

## 검증 결과

- `npm run lint`: 경고 0, 통과.
- `npm run build`: 타입 검사 및 production 빌드 통과. 전용 로컬 DB 환경에서 실행.
- `node scripts/verify-course-application-document-boundaries.mjs`: 11개 통과. 미연결/잘못된 ID 제외, 같은 이름의 기수 구분, 실패/빈 목록, 서버 변조 차단, 로그인 복귀 URL 확인.
- `APPLICATION_TEST_DB_DIR=/tmp/u-livet-issues-db node scripts/verify-application-document-db-courses.mjs`: 실제 native Auth/RPC 7개 통과. 신규 ID 누락/가짜/비공개 거부, 공개 기수와 공개 안내 준비 기수 허용, 과정명 정규화, 기존 미연결 재시도/PDF 보존, 내부 함수 직접 실행 차단.
- `APPLICATION_TEST_DB_DIR=/tmp/u-livet-issues-db node scripts/verify-course-application-document.mjs`: 실제 브라우저 9개 통과. 팝업→로그인→기수 선택→PDF 생성→접수→비공개 PDF 조회. 모바일 360px 및 데스크톱 1440px 확인.
- `node scripts/verify-learner-documents.mjs`: application/scholarship/refund PDF 형식과 날짜·서명·동의·금액 경계 통과.
- React 점검: 입력 label/ARIA 연결, 함수형 state 갱신, 기존 서버 병렬 조회 유지, 추가 클라이언트 조회 없음.
- 전용 로컬 security advisors: 지적 없음. 운영 사전 검사 경고 6개는 기존 MFA 설정/기존 공개 함수이며 이번 private 함수 변경 대상에는 지적 없음.
- 운영 `supabase db push --dry-run`: 새 migration 1개만 대상. seed/roles 변경 없음.

## 릴리스

검증한 파일만 PR에 포함한다. 합성 브라우저/PDF 산출물과 로컬 환경 설정은 제외한다. 운영 migration 적용 후 함수 내용/권한과 migration 이력을 확인하고, main 병합으로 생성된 Vercel production 배포의 SHA 및 운영 응답을 확인한다. 운영 회원의 실제 원서는 테스트 접수하지 않는다.
