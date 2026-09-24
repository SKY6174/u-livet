# 과정 개발·심의 분류 필터 설계

2026-09-24 · [계획](../../01-plan/features/anchor-development-dropdown-filters.plan.md)

## 화면과 URL
- `DevelopmentBoard`의 기존 버튼 패널을 가로 드롭다운 행으로 바꾼다. 순서는 사업연도, 주관기관, 해당 기관의 센터·팀, 아카데미다. 작은 화면에서는 줄바꿈한다.
- `year`, `org`, `track`, `academy` URL 쿼리가 상태를 나타낸다. 드롭다운 변경은 즉시 이동하며, 기관 변경 때 기관별 `track`만 초기화한다.
- 앵커사업단 센터는 전체/ECC/ICC/RCC/AID-X, 산학협력단 팀은 전체/산학기획팀/산학지원팀이다. 기존 `WORKER`·NULL 제안은 전체에 포함한다.
- 아카데미는 전체/스마트테크/라이프케어/로컬창업/팝업이며, 현재 자료의 `… 아카데미` 표기도 같은 분류로 찾는다.
- 잘못된 기관·연도·센터·아카데미 쿼리는 허용된 기본값으로 정규화한다.

## 데이터와 API
- `life_course_proposals.track` 제약에 ICC, `SANHAK_PLANNING`, `SANHAK_SUPPORT`를 추가한다. 기존 `WORKER`는 유지한다.
- 제안 생성 RPC의 기관별 track 검증을 갱신한다. 산학협력단의 신규 제안은 두 팀 중 하나를 선택한다.
- 새 `life_development_board_classified(o,staff,y,track,academy)`는 기존 권한·연차 검사와 기관별 track, 네 아카데미 입력 검사를 수행한다. 제안의 최신 버전 `payload.academy`에 필터를 적용한 뒤 100건 제한과 `more`를 계산한다. 승인 개발·개편 집계에도 아카데미를 적용한다.
- 기존 4인자 RPC는 다른 호출자의 호환을 위해 보존한다. 새 RPC는 인증 역할에만 실행 권한을 준다.
- 상세·제안 작성 흐름의 기관과 연차 선택은 유지하고, 신규 제안의 주관 선택에 새 분류를 반영한다.

## 검증
- 로컬 DB 마이그레이션, 새 기관별 코드 허용과 잘못된 코드 거부, 아카데미·연차·센터 필터, 권한 차단을 검증한다.
- UI lint와 build 후 Preview·운영 DB/앱 순서로 배포한다.
