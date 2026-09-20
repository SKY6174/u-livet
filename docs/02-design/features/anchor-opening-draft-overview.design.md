# 개설 준비 임시저장 현황 설계

2026-09-21 · anchor-opening-draft-overview

## 데이터·권한
- 기존 life_opening_working_copies 테이블과 저장 규칙 유지. 추가 읽기 RPC life_opening_working_copy_summaries(o uuid)만 생성한다.
- private stable security definer + public stable invoker, 빈 search_path 고정. private 내부에서 person_id()와 해당 조직 COURSE_MANAGER 검사. authenticated만 execute 가능.
- 해당 person_id·org_id의 source_id, revision, updated_at만 source_id 순으로 최대16개 반환. payload·개인 식별자·기관정보·편집 제목은 목록으로 전달하지 않는다.
- 서버 로더는 requireIdentity 후 기존 등록 폼과 같은 첫 COURSE_MANAGER 조직을 선택, 단일 RPC 사용. 결과 배열의 길이·중복·source_id·양의 revision·시각을 검증한다. 실패/불량 응답은 unavailable, 빈 배열은 정상 미저장이다. 공유 캐시 없음.

## 목록·갱신
- /admin/course-plan/opening 페이지에서 기존 계획서 로더와 목록 요약을 병렬 조회한다. 기존 상위 관리자 및 COURSE_MANAGER 권한 유지.
- 상단에 본인 임시저장 개수와 별도 개인 준비 자료임을 설명. 저장 건수는 현재 검색과 무관한 전체 계획서 기준.
- 각 카드에 '내 임시저장' + 한국시간 최근 저장 시각, 저장된 경우 CTA '이어서 준비하기'. 미저장일 때 기존 불러오기 링크 유지.
- URL drafts=saved만 savedOnly=true, 기타/배열은 false. 검색·아카데미·강사·자료대조 조건과 AND 결합. 원문 집계는 바꾸지 않는다.
- 저장 조회 실패 시 개수·미저장 상태를 추정하지 않고 재시도 링크 제공. 저장 필터가 선택되어도 전체 원문 조건 결과를 보여주며 해당 필터가 적용되지 않았다고 안내한다. 카드 상태는 '저장 여부 확인 불가'.
- 저장 성공 후 revalidatePath('/admin/course-plan/opening') 호출로 돌아간 목록 갱신. 실패 시 호출하지 않는다. 기존 폼 key는 조직+계획서로 안정 유지해 입력/성공 상태 초기화 방지.
- 실제 기수 개설 여부를 임시저장으로 판단하거나 모집일·권한·실제 과정 데이터를 변경하지 않는다.

## 검증
- 앱: URL 정규화·필터 결합·저장0건/일부/16건/오류 렌더·CTA·한국시간·권한검사 선행·응답 검증·단일 RPC·저장 후 캐시 갱신.
- DB: 로컬 실제 JWT로 작성자/기관/역할 격리, 익명/권한회수 거부, 16건 요약과 payload 미노출·한번조회 응답시간 확인.
- 기존 계획서·prefill·임시저장 회귀, 빌드, 모바일 UI 검증. Hosted DB에는 요약 RPC만 추가하고 기존 3개 공개 카드·보관 과정 유지 확인.
