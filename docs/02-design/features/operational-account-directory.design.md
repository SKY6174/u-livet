# 운영 계정 명부 분류 설계

계획: `docs/01-plan/features/operational-account-directory.plan.md`

조사: 사람 83명/Auth 29개 중 이름에 명시적으로 검증/테스트/dummy 표시가 있는 기존 인물 25명. dummy-00~09는 Issue124 전용 example.invalid 계정과 검증 신청서가 연결되며, 운영 수강생 명부 15명 중 10명으로 표시된다. 나머지 15명은 검증 판정/승인 인물 2명, 검증 과정 수강생 12명, 기존 비활성 QR API 테스트 수강생 1명이다. 정상 사업단 11명·강사 41명과 실제 수강생 5명은 유지한다.

1. `life_private.non_operational_members(person_id PK/FK, reason, classified_at)`를 추가한다. RLS 활성화, public/anon/authenticated/service_role 테이블 권한 회수. 검증된 25개 UUID만 기존 행이 있는 경우 insert한다. 새 환경에서는 개인정보나 테스트 계정을 생성하지 않는다. 이름 기반 실시간 필터를 사용하지 않는다.
2. `life_private.operational_member_scope()`는 기존 `member_scope_for(false)`의 허용 기관/사용자 구분에 비공개 분류표 제외 조건을 추가한다. stable/security definer/search_path 빈 값, 일반 역할에 execute를 부여하지 않는다. 기존 권한 helper·쓰기 scope·인증/자기계정 조회는 변경하지 않는다.
3. 기존 `member_directory`, `member_directory_filtered`, `member_excel_export`, `member_excel_export_filtered`의 목록 scope만 새 helper로 교체한다. 총인원·검색·정렬·연도/강사 구분·offset/limit 이전에 제외한다. 기존 그룹·입력 검증·권한·반환형·페이지 크기 20·엑셀 1,000명 제한·grants를 보존한다.
4. `member_history`의 기존 권한 guard도 운영 scope를 사용한다. 숨긴 ID의 상세 조회는 directory.items=[] → 기존 관리자 notFound가 적용된다. 직접 이력 RPC는 FORBIDDEN이다. 숨긴 사람의 수정/삭제 화면도 기존 상세 조회 단계에서 진입할 수 없다.
5. 구성원 조회의 올해 수강과목/연도 필터/과거 이력은 앞선 운영 과정 view `life_private.operational_offerings`를 사용한다. 정상 사람이 검증 과정에도 연결됐을 때 정상 계정과 정상 과정 이력은 유지하고 검증 과정만 제외한다. 원본 관계/과거 확정 snapshot은 보존한다.
6. 원본 public 사람·Auth 연결·프로필·역할·분류·수동등록·강사풀·이력·상태·비밀번호는 수정/삭제하지 않는다. 변경 전후 20개 기존 운영 테이블과 계정 관련 원본 테이블의 count/hash를 비교한다. Auth는 로그인 활동으로 변하는 필드를 제외하고 ID/이메일/암호 해시/메타데이터/상태를 aggregate hash로만 비교한다. 비밀번호·연락처는 출력하지 않는다.

검증:
- 로컬 전용 transaction/ROLLBACK fixture로 세 그룹의 정상+숨김 자료, 45명 20/20/5 페이지, 검색/정렬/연도/강사구분/총인원/구·신 엑셀 RPC, 직접 상세·이력 차단, 실제 계정의 정상+검증 과정 혼합 이력, 이름 변경 후 제외를 확인한다.
- 비로그인·권한 없는 계정·다른 기관 접근은 기존대로 거부되고 private 분류표/함수는 노출되지 않는다. 숨긴 운영자가 가진 기존 역할은 그대로 작동한다.
- Preview migration/배포 체크, 운영 원본 count/hash 및 보안 advisor 전후 비교 후 사업단·강사·수강생 목록과 dummy/검증 검색 0건, 정상 계정 상세, 기존 dummy 상세/이력 주소 차단을 실제 브라우저로 확인한다. 알림/초대/재설정 메일은 발송하지 않는다.
