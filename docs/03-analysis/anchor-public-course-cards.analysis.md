# 공개 과정 소개 검증

2026-09-21 · anchor-public-course-cards

설계의 구현 항목 8/8 충족: 명시적 3개 공개, 미래 보관 기본 비공개, 좁은 공개 반환 계약, 기존 RLS 유지, 카드 조회, 상세 소개, 운영 완료/접수 종료 표시, 관리자 전체 조회 유지.

- 로컬 PostgreSQL 합성 자료: 공개/비공개 보관, 공개 플래그가 있는 DRAFT 제외, PUBLISHED/CLOSED 유지, 직접 상세 조회, 익명/일반 회원의 기존 catalog·보고서·첨부 접근 차단, 공개 철회까지 통과. 합성 자료는 rollback.
- DB 조회/렌더링 회귀 16개와 개인 시작화면 회귀 12개 통과. lint 및 프로덕션 build 통과.
- 실제 Preview 연결 빌드에서 비로그인 카드 3개, 파크골프 검색 1개, 카드→상세→목록을 확인. 390px에서 3개 링크 유지, 가로 넘침 없음.
- Preview와 Production에 동일 migration 1개씩 적용. 실제 익명 REST에서 소개 3개·각 상세 조회 성공. 기존 life_catalog는 0개, 보고서·첨부 테이블과 보고서 RPC는 거부.
- Preview 보안 Advisor WARN/ERROR 없음. Production Advisor CLI는 로그인 역할 초기화 후 응답을 반환하지 않아 중단했다. Production은 실제 익명 접근 거부와 기존 정책·함수 지문 보존으로 검증했으며 Advisor 완료로 표시하지 않는다.
- 원래 개설과정 전체 값(추가 공개 플래그 제외), 보고서/첨부 전체 내용, read_offering 정의와 life_ RLS 정책의 전후 지문이 동일하다. Production 과정/보고서/파일은 각각 3개, Preview는 과정 3개·보고서/파일 0개를 유지했다.

실제 API 검증 중 PostgREST의 TABLE 반환 RPC에서 선택하지 않은 created_at으로 정렬하면 42703 오류가 발생했다. 카드 조회에 생성일을 포함하도록 보정하고 같은 실제 조회와 전체 build를 재검증했다.

실제 관리자 로그인은 대신 수행하지 않았다. 보고서 접근 정책 및 자료 지문 보존과 익명 차단을 검증했다. 원격 앱의 최종 Git 배포 revision·화면 확인은 push 후 작업 응답에 기록한다.
