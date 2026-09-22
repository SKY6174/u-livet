# DB 연동 점검·최적화 설계

## 확인된 상태
- 운영/스테이징 마이그레이션 각각 47개. 업무 테이블의 RLS 비활성 항목 없음. 기존 역할·배정·강사대장 인덱스 존재.
- 스테이징에서 authenticated 및 트랜잭션 내 임시 MFA 세션으로 비교 후 ROLLBACK: 기존 instructor_options 13,928B, 기관 이름 조회 194B. 반복 5회 기존 약42ms, 개선 약0.1ms. 네트워크 시간을 제외한 작은 실제 DB 측정이다.

## 기관 조회
- `getManagedInstructorOrganizations(identity)`는 서버가 검증한 Identity에서 COURSE_MANAGER의 org_id만 중복 제거하여 읽는다. SYSTEM_ADMIN 단독, INSTRUCTOR, 일반 회원은 빈 배열을 즉시 반환한다.
- ID 검증 실패·DB 오류·네트워크 예외는 unavailable로 구분한다. 빈 범위를 전체 목록 조회로 바꾸지 않는다.
- `life_organizations.select("id,name").in("id", ids).order("name")`를 사용하고 한국어 이름순으로 정렬한다.
- 강사 대장과 서류 목록에서 공통 사용한다. URL로 받은 기관은 조회 결과에 포함될 때만 사용하며 나머지는 기존처럼 첫 기관으로 돌아간다. 민감 RPC는 계속 DB에서 권한을 확인한다.
- 대장의 심사 상세(d가 있는 경우)에만 instructor_options를 호출한다. 목록·수당·심사 목록에서는 정책 본문을 전송하지 않는다. 상세 정책과 대장 RPC는 독립적으로 병렬 조회한다. 심사 상세 옵션 오류는 오류 화면으로 표시한다.

## 연결 점검 도구
- 기존 GET/수동 redirect 측정 유지. 홈페이지의 307/308 응답이 동일 origin의 정확한 `/auth/login`으로 이동할 때만 정상으로 분류한다. 외부 origin·다른 경로·다른 측정 대상의 redirect는 실패다.
- health는 healthy JSON, 일반 페이지/DB는 성공 HTTP 응답을 요구한다. warm 통계에는 성공한 표본만 포함한다. 키·쿠키·응답 본문은 출력하지 않는다.

## 검증
- 실제 Supabase builder로 기관 ID 범위·projection·빈 권한·오류를 검증한다. 페이지 컴포넌트 실행으로 불필요한 옵션 RPC 제거, 심사 상세 조회 유지/병렬·실패 화면을 검증한다.
- 연결 점검 도구에 정상 이동·외부 이동·보호 응답·health 실패 회귀 검사를 추가한다.
- 운영/스테이징 공개 Data API 읽기, 비인증 업무 거부, 마이그레이션/RPC 정의 일치 확인. 필요한 권한 검증은 스테이징 ROLLBACK 안에서만 합성 세션 사용.
- 배포 후 동일 revision과 health 응답을 확인한다. 테스트/측정 자료와 비밀값은 커밋하지 않는다.
