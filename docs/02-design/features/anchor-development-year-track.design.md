# 과정 개발·심의 연차·주관 구분 설계

2026-09-24 · [계획](../../01-plan/features/anchor-development-year-track.plan.md)

## 데이터
- `life_project_years`: `uc-anchor`, `uc-sanhak`별 2025-03-01~2030-02-28 범위의 5개 연차. 공식 연차 라벨 기준으로 중복 삽입하지 않는다. 기존 anchor 2026 `2차년도 · 2026` 행/참조는 보존한다. 동일 날짜의 비공식 시험 행은 필터에서 제외한다.
- `life_course_proposals.track`: 새 제안의 주관 코드. anchor는 `RCC`, `AID-X`, `ECC`; sanhak은 `WORKER`. 기존 제안은 NULL(`미분류`)로 유지한다. 아카데미는 교육내용 분야이므로 센터 분류로 재사용하지 않는다.
- 기관 식별은 고정 UUID가 아닌 `life_organizations.slug`를 사용한다.

## API·권한
- 기존 제안 생성 RPC는 호환성을 유지한다. 새 `life_start_development_classified(o,y,kind,target,track)`는 서버에서 기관별 코드와 사업연도, 제안 자격을 검증한 후 기존 생성 트랜잭션에서 track을 저장한다. 후속 버전 작성은 root의 track을 보존한다.
- 새 `life_development_board_filtered(o,staff,y,track)`는 기존 staff/본인 접근 규칙을 유지하고 **DB에서** 기관·연차·주관 필터를 적용한 최근 100건, 더 있음, 승인 개발·개편 건수를 반환한다. NULL track은 `UNCLASSIFIED` 필터로 찾을 수 있다. 기존 RPC는 다른 호출자를 위해 보존한다.
- detail RPC는 기존 `to_jsonb(root)`를 통해 track을 전달한다. DB 원장 직접 읽기 권한은 추가하지 않는다. 공개 함수는 인증 역할에만 EXECUTE를 부여한다.

## 화면
- 관리자와 강사 개발 목록에 2025년(1차년도)~2029년(5차년도) 버튼을 제공한다. 기본은 현재 사업연도(범위 밖이면 마지막 연차). 선택 연도는 URL 쿼리로 유지한다.
- 허용 기관은 이름을 보이는 버튼으로 구분하고, anchor에서는 RCC/AID-X/ECC, sanhak에서는 재직자 과정으로 다시 구분한다. 미분류 기존 자료도 접근 가능한 별도 필터를 둔다.
- 연차/주관 선택 시 요약과 목록이 동시에 변경되며 빈 상태에 현재 선택 범위를 명시한다. 새 제안 작성 때 해당 기관의 주관을 필수로 선택한다. 후속 버전은 원래 주관을 유지한다. 상세 상단에도 기관·연차·주관을 표시한다.
- 유효하지 않은 URL 쿼리는 첫 허용 기관/기본 연차/전체 주관으로 정규화한다. URL 입력은 SQL에 직접 삽입하지 않는다.

## 검증
- 로컬 DB에서 10개 연차 존재, 기존 anchor 2026 참조 보존, 새 제안의 기관별 코드 거부, 다른 기관/비담당자 접근 차단, 100건 초과 필터를 확인한다.
- UI의 기관·연차·주관 링크, 신규 제안 입력, 상세 표기, lint/type/build를 확인한다.
- Preview/Production migration 적용 후 코드 배포, `/api/version`·`/api/health`와 DB 조회를 확인한다.
