# Gap Analysis: 수강생 서류 민원 처리

> Date: 2026-09-23 | Design: `docs/02-design/features/anchor-learner-document-workflow.design.md`

---

## Match Rate: 100%

## 요약

설계 항목 24개를 DB, 수강생 UI, 관리자 UI, PDF 처리, 보안, 검증으로 나누어 대조했다. 24개가 모두 구현됐으며, 추가 요청인 환불 신청날짜 중복 제거, 은행 드롭다운, 과정 수강료 기반 자동 계산, 원본 안내 문구 제거도 함께 반영됐다.

## 구현 항목

- [x] 세 문서 유형별 `입력완료`/`신청처리`와 PDF 다운로드 병행
- [x] 요청 메타데이터, 추가 전용 처리 사건, private PDF 원본 테이블 분리
- [x] PDF 1.7 서버 재생성, SHA-256 검증, 5 MiB 상한, immutable 저장
- [x] request key 멱등 제출과 충돌 검증
- [x] 본인 신청·이력·제출 원본 조회와 접수 상태 취소
- [x] 관리자 유형·상태·검색 필터, 원본 PDF, 이력, 상태 전환 UI
- [x] RECEIVED → REVIEWING/APPROVED/REJECTED → COMPLETED 상태 규칙
- [x] 공개 안내 메모 필수, revision 낙관적 잠금, 감사 이벤트
- [x] 조직 역할과 MFA verified/recent 기반 관리자 권한
- [x] 공개 목록의 전화번호 마스킹과 민감한 PDF bytea 격리
- [x] 과정 카탈로그의 offering·tuition 연결
- [x] 원본 기준 5개 구간의 반환액과 공제금액 자동 산출
- [x] 수강료 미등록 과정의 금액 공란과 제출 차단
- [x] 국내 은행·상호금융·우체국·저축은행 드롭다운
- [x] 환불 PDF 상단 신청날짜 중복 영역 제거, 하단 작성일 유지
- [x] 환불 PDF `음영처리된 곳만 표기` 문구 제거
- [x] 인증·권한 검증 PDF API route와 no-store/nosniff 헤더
- [x] 관리자 업무 홈·내비게이션 연결
- [x] 타입 검사, 변경 파일 린트, production build
- [x] PDF 1.7 헤더·catalog·A4·원본 좌표 회귀 검증
- [x] DB 멱등성·금액·격리·상태·동시성·직접 테이블 차단 통합 검증
- [x] 브라우저 수강생 현황·자동 계산·은행 목록 시각 검증
- [x] 브라우저 관리자 목록·원본·상태 변경 동작 검증
- [x] 렌더된 최종 환불 PDF의 여백·표·날짜·안내 문구 시각 검증

## 누락 항목

없음.

## 설계와의 차이

- 사용자 추가 요청에 따라 은행 목록과 환불 금액 계산, PDF의 중복 신청날짜·안내 문구 제거를 설계 문서에 보강한 뒤 구현했다.
- 수강료 0원은 `미등록`이 아니라 확인된 무료 과정으로 취급해 0원 계산을 허용한다.

## 검증 결과

| 검증 | 결과 |
|---|---|
| `npx tsc --noEmit` | 통과 |
| 변경 파일 ESLint | 통과 |
| `npm run build` | 통과 |
| `verify-learner-documents.mjs` | 3개 PDF와 계산 규칙 통과 |
| `verify-learner-document-workflow.mjs` | 제출·격리·처리 전 과정 통과 |
| `supabase db lint --local --level error` | 신규 함수 오류 없음. 기존 `course_budget_overview`의 선행 함수 참조 오류 1건은 본 기능과 무관 |
| 브라우저 QA | 수강생·관리자 화면과 실제 상태 변경 통과 |

## 다음 단계

- [x] 구현과 설계 일치율 90% 이상 확인
- [ ] Git 커밋·푸시와 DB migration 배포
- [ ] 배포 환경의 버전·헬스·핵심 경로 확인
