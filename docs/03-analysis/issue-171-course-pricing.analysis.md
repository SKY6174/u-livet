# Issue 171: 과정 등록 아카데미 및 수강료 검증

2026-10-13 · 설계: `docs/02-design/features/issue-171-course-pricing.design.md`

## 설계 대조

| 기준 | 결과 | 근거 |
| --- | --- | --- |
| 기존 네 아카데미 선택 및 기존 값 복원 | 통과 | 공유 상수, 필수 select, SSR/prefill 회귀 |
| 무료 0원 및 유료 정수 범위 | 통과 | 모델·액션·브라우저 validation |
| 무료 전환 시 0원 제출, 재전환 시 금액 유지 | 통과 | 실제 클라이언트 컴포넌트의 FormData 확인 |
| 기존 13개 필드 임시저장 호환 | 통과 | 모델 및 DB validator, 기존 working-copy 회귀 |
| 새 유료 임시저장 및 복원 | 통과 | DB save/load, 150,000원 브라우저 복원 |
| 일반/원문 등록과 수강료의 원자적 반영 | 통과 | 로컬 SQL 무료·유료·원문 연결 및 실패 롤백 |
| 인증·기관 역할·최근 인증 및 함수 권한 | 통과 | 기존 인증 함수 위임, 로컬 잘못된 기관·익명·미인증 거부, 운영 ACL 조회 |
| 기존 유료 모집 공개 보호 | 통과 | 승인된 환불 규정 미설정 시 공개 실패 및 DRAFT 유지 |
| 모바일 입력 배치와 기존 등록 회귀 | 통과 | 360px 브라우저 가로 넘침 없음, 기존 prefill/working-copy 검증 |

설계 기준 9/9 충족(100%), 미해결 차이 없음.

## 실행 결과

- `node scripts/verify-course-draft-pricing.mjs`: 모델·액션·SSR 3개 그룹 통과.
- `node scripts/verify-course-draft-pricing-db.mjs`: 로컬 Docker Postgres에서 함수·실제 행·권한·원자성·공개 보호·임시저장 검증 후 전체 ROLLBACK.
- `node scripts/verify-opening-working-copy.mjs`: 10개 검증 통과.
- `node scripts/verify-course-opening-prefill.mjs`: 7개 검증 통과.
- `npm run lint`, `npx tsc --noEmit`, `npm run build`, `git diff --check` 통과.
- 브라우저는 실제 등록 폼 SSR 및 실제 `DraftTuitionFields` 클라이언트 컴포넌트를 사용했다. 테스트 제출은 FormData만 표시했으며 실제 등록 저장은 별도 액션·SQL 검증으로 확인했다.

## 운영 DB 적용

Supabase `uoebygejgglgiivzgyks`에 함수 migration을 적용하고 ledger의 실제 버전 `20261013004702`와 저장소 파일명을 일치시켰다. 새 public 함수는 SECURITY INVOKER, private 함수는 고정 search_path의 SECURITY DEFINER이며 authenticated만 실행 가능하다. 운영 validator에서 이전 payload와 유료 150,000원 허용, 무료 양수 금액 거부를 확인했다. 적용 전후 security advisor 항목은 동일하고 새 함수에 대한 추가 항목은 없다. 운영 과정 데이터는 생성하지 않았다.
