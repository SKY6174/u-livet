# 페이지 돌아가기 메뉴 제거 검증

- 날짜: 2026-09-22
- 설계: `docs/02-design/features/anchor-remove-back-navigation.design.md`
- 소스 변경: 38개 파일, 복귀 링크 37개와 서류 복귀 버튼 1개 제거.
- 전체 활성 소스 검색: `돌아가기`, `ArrowLeft`, `목록으로`, `My Room 홈 →` 없음. 남은 `←` 4곳은 구성원·강사 목록의 페이지 이동이다.
- 공통 CourseHeader, 강사 대장, 문서 입력 및 인쇄 도구에도 적용했다.
- 불필요해진 import·props·변수와 강사 대장 상단 여백을 정리했다.
- 삭제 확인 대화상자의 취소 동작은 유지하고 ‘취소’로 표시했다.
- 오류 복구용 404 홈 이동, 인증 후 작업 화면 이동, 공통 내비게이션과 업무 링크는 유지했다.

## 완료한 검증
- `npm run lint`: 통과.
- `node scripts/verify-role-navigation.mjs`: 19개 통과. 역할별 데스크톱·모바일 공통 메뉴와 접근 제어 확인.
- `node scripts/verify-instructor-queries.mjs`: 8개 통과. 기관 범위와 오류 화면 유지 확인.
- `npm run test:workspace-queries`: 8개 통과. 담당 업무 조회와 권한 유지 확인.
- 격리 복사본 `npm run build`: 타입 검사와 프로덕션 빌드 통과.
- `git diff --check`: 통과.
- React 점검: 새 effect·클라이언트 요청·상태 추가 없음. 출력 및 취소 동작 유지.

## 배포 후 확인
- 운영·스테이징 버전과 상태 확인.
- 공개 과정 상세의 복귀 링크 제거 및 공통 메뉴 이동 확인.
- 로그인 후 비공개 화면은 기존 역할별 렌더링 검사와 소스 검토로 확인했다. 운영 사용자 인증을 대신 수행하지 않는다.
