# 인증·신청·기본 강의실 구현 단위 상세

작성일 2026-09-19 (KST). 구현 전 작성된 [플랫폼 상세설계](anchor-lifelong-education-platform.design.md)와 [DB 상세설계](anchor-lifelong-education-platform.data.md)의 첫 작업단위 추적 문서다.

| 부분 | 이번 단위의 구현 결정 |
|---|---|
| 공존 이관 | 새 테이블에 `life_` 접두어를 사용한다. 과거 001~010 SQL과 원자료는 보존한다. 기존 Data API 테이블·뷰·RPC 권한은 회수한다. |
| 신원 | Supabase `getUser()` + DB `life_identity`. 사용자 metadata와 localStorage는 권한 근거가 아니다. Auth 삭제 시 `life_auth_links`만 해제하고 person·학습기록은 남긴다. |
| 기관 권한 | 유효기간이 있는 `life_role_assignments`. 과정담당은 COURSE_MANAGER만, 강사는 INSTRUCTOR와 실제 기수 배정이 모두 필요하다. SYSTEM_ADMIN에 교육자료 포괄 권한을 주지 않는다. |
| 정책 | 승인된 개인정보/신청/수료 정책 원문을 버전별 보존한다. 승인 뒤 수정 불가. 가입·신청 시 동의 이벤트를 저장한다. 정책 내용과 보유기간은 임의 생성하지 않는다. |
| 과정 개설 | 새 과정·버전·기수를 한 트랜잭션에서 초안으로 생성. 담당자가 승인된 모집·수료 정책을 연결하면 공개된다. 승인된 기관 강사의 배정·해제와 감사기록을 제공한다. 기존 과정 버전 재사용/변경 심의는 후속 확장이다. |
| 신청 | 무료 과정 한정. FIRST_COME는 정원 내 즉시 등록, 초과 시 WAITLISTED. REVIEW는 SUBMITTED 후 담당자 심사. 모든 등록·취소는 기수 행을 잠가 정원을 확인한다. 대기는 담당자가 순서를 확인해 승급한다. |
| 중복과 상태 | `(offering_id, person_id)` 유일키로 같은 신청의 재전송을 동일 결과로 처리한다. 취소된 신청의 재신청은 아직 지원하지 않는다. 전체 멱등성 키/금전 원장은 후속이다. |
| LMS | 텍스트 자료·읽음 기록, 마감시간이 있는 텍스트 과제, 제출 버전과 별도 점수·피드백. 읽음은 출석·수료가 아니다. 재제출은 기존 점수를 무효화하며 오래된 제출 버전의 채점을 거부한다. |
| 권한 강제 | GRANT + RLS로 조회 제한, 쓰기는 사용자 세션의 검증된 RPC로 처리. 공개 RPC는 invoker wrapper, 실 트랜잭션은 비공개 schema의 definer 함수에서 신원·객체 범위를 확인한다. 검색 경로 고정·실행권한 명시. |
| UI | `/courses`, `/offerings/:id`, `/offerings/:id/apply`, `/mypage`, `/learning/:id`, `/instructor`, `/instructor/offerings/:id`, `/admin`, `/admin/offerings/:id`. 원본 설계의 전체 42화면 중 첫 묶음이다. |
| 운영 시간 | 사용자 화면과 모집 입력은 Asia/Seoul. 교육 시작일 경계도 한국시간 기준으로 비교한다. |
| 미구현 증명 | 수료·증명을 산출하지 않는다. 종전 임의 ID 가짜 증명/배지는 404, 검증 서비스는 준비 중이라고 명시한다. |

격리된 로컬 프로젝트 `uc-life-core`와 55321/55322 포트를 사용한다. 기존 실행 중인 `uc-anchor` 컨테이너나 `.env.local`을 변경하지 않는다. 테스트 정책·사용자는 `scripts/local-fixtures.sql`과 테스트 스크립트에서만 만들며 마이그레이션에 포함하지 않는다.

운영 전 남은 경계: 기관 정책과 최초 권한 승인, 개인정보 보유·파기, 관리자 MFA와 재인증, 속도제한/봇 방어, 전용 모니터링·백업/복구, 원격 마이그레이션 적용, 외부 업체 계약·설정. 이 단위의 통과는 운영 배포 적합성 전체를 보증하지 않는다.

## 의존성 보안 변경 (2026-09-19)

기존 Next.js 14.2.35 의존성의 실제 `npm audit` 결과를 확인해 Next.js 15.5.25 / React 19.3.0으로 변경했다. [공식 2026년 8월 보안 공지](https://nextjs.org/blog/august-2026-security-release)와 [v15 마이그레이션 가이드](https://nextjs.org/docs/app/guides/upgrading/version-15)에 따라 공식 codemod를 적용하고 쿠키 클라이언트·호출부를 비동기로 변경했다. React 폼은 useActionState를 사용한다. Next.js 15에서는 middleware.ts를 유지한다.

PostCSS는 8.5.28, 개발용 typescript-estree 7의 minimatch는 9.0.9로 고정하여 간접 의존성도 수정했다. Next·React·타입·관련 린트 설정 버전과 lockfile을 함께 갱신했다. 이 변경은 전체 기능 범위 변경이 아닌 알려진 의존성 취약점 해소다.
