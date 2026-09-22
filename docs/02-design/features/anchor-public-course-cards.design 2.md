# 공개 과정 소개 설계

2026-09-21 · anchor-public-course-cards

## 공개 범위
- life_offerings에 `public_introduction boolean not null default false`를 추가하고 요청받은 기존 ARCHIVED 3개 ID만 true로 지정한다. 새로운 보관 과정은 자동 공개되지 않는다.
- `life_private.course_introductions(f uuid default null)`은 공개용 필드만 명시한 TABLE을 반환한다. PUBLISHED/CLOSED 또는 public_introduction=true인 ARCHIVED만 읽으며 DRAFT는 항상 제외한다.
- SECURITY DEFINER는 비공개 스키마의 이 좁은 공개 소개 함수에만 사용한다. search_path를 비우고 완전한 테이블 이름을 사용한다. public invoker 래퍼 `life_course_introductions`에서 호출하고 PUBLIC 기본 실행권을 회수한 뒤 anon/authenticated에만 허용한다.
- 기존 read_offering, life_catalog RLS, 보고서/파일/수강/개인정보 RPC는 변경하지 않는다. 승인된 소개 공개가 업무자료 접근 권한을 부여하지 않는다.

## 화면
- 교육과정 찾기 목록은 공개 소개 RPC에서 카드에 필요한 필드만 조회한다. 기존 검색·운영방식·정렬은 유지한다.
- 상세 소개도 같은 공개 RPC를 사용한다. 과정 설명·교육내용·기간·장소·정원만 공개하며 ARCHIVED에서는 강사/수납 RPC를 호출하지 않는다. 수료 정책 ID는 기존 공개 상태에만 제공한다.
- 보관 과정 카드는 ‘운영 완료’로 표시하고 상세에는 종료된 과정임을 명시한다. 모집 상태/접수기간/신청 권한은 변경하지 않는다.
- 관리자 화면은 기존 보호된 전체 Offering 계약을 유지한다. 홈의 모집 공개 과정 3개 추천 조건은 유지한다.

## 검증과 적용
- 로컬 합성 자료로 공개 보관/비공개 보관/DRAFT/공개 모집/모집 종료와 익명/일반 회원을 검사한다. 기존 private catalog·보고서·파일 접근이 거부되는지 확인한다.
- 실제 Supabase query builder·화면 렌더링 회귀, lint/build, 브라우저 목록·검색·상세·390px을 확인한다.
- Preview→Production에 동일 migration을 적용하고 실제 익명 REST로 3개 소개/상세 및 보고서 차단을 확인한다. 양쪽 전체 과정/보고서/첨부 수와 상태 보존을 대조한다. 검증 후 양쪽 Git 브랜치에 일반 push한다.

[함수 권한](https://supabase.com/docs/guides/database/functions) · [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
