# 수료 안내 교정 설계 대조

2026-10-17 · Feature `operational-completion-notices`
Design: `docs/02-design/features/operational-completion-notices.design.md`

## 구현 일치율: 8/8 (100%)

1. 전체 22개 offering과 모든 COMPLETION 정책 조사: 실제 교정 대상은 산과 필라테스 1개다.
2. 기존 승인 80% 안내 재사용: 기관·종류·제목·버전·유효일·SHA-256 검사.
3. 원본 보존: 기존 과정 버전 복사 후 대상만 연결, revision +1, 감사 이벤트 1회.
4. 진행 상태 보호: 다른 연결·이름·제안서·수강 등록·수료 산출·마감 상태이면 교정 중단.
5. 공개 화면: 과정 소개·모집 상세에서 제목뿐 아니라 버전·본문과 작성 요령도 검사.
6. 관리자 선택지·오류: 실제 수료 정책만 선택 가능하며 교정 절차를 안내한다.
7. DB 경로: offering INSERT/버전·이름·상태 변경 및 참조 버전의 정책 변경을 보호한다.
8. 명시적 합성 과정 보존, private INVOKER 트리거·빈 search_path·실행 권한 회수.

## 확인한 증거

- `node scripts/verify-operational-completion-notices.mjs`: 실제 로컬 PostgreSQL에서
  Preview 부재, 미승인/본문/유효일/대상/연결/마감 검사, 새 버전·재실행·공유 버전 보존,
  기존 정책·신청·동의·계산 규칙·수료 산출·확정 기록 불변 및 80% 유지 확인.
- 같은 테스트에서 TS/SQL 분류 일치, 양쪽 연결 경로, 실제 MFA publish RPC의 전체
  롤백과 정상 정책 성공, 합성 과정명 변경 우회 차단, 트리거 권한 비노출 확인.
- 기존 모집 안내 DB 회귀 테스트, ESLint, `tsc --noEmit`, `git diff --check` 통과.
- React 점검: 서버에서 기존 자료만 필터하며 추가 요청·클라이언트 상태·효과를 만들지 않는다.

## 릴리스 확인

위 수치는 구현 설계 대조다. Preview·운영 DB 전후 증빙 해시·advisor·실제 공개/관리자
화면과 운영 배포 검증은 별도 릴리스 단계이며, 최종 결과는 이 변경의 PR에 기록한다.
수료 규칙의 두 사람 승인과 학사 마감·최종 수료 확정은 기존대로 별도 운영 절차다.
