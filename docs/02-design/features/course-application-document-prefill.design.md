# 과정별 수강신청원서·가입정보 자동 입력 설계

2026-10-07 · [계획](../../01-plan/features/course-application-document-prefill.plan.md)

## 경로와 화면

공개 `/courses/:guideId`와 `/offerings/:offeringId`에서 `수강신청원서 작성` 버튼으로 기존 `DocumentPopup`을 연다. URL은 `/mypage/documents?type=application&course=<과정 ID>`, 창 이름은 기존 `learner-documents`를 재사용한다. 선택한 과정이 있는 기존 `/offerings/:id/apply`와 나의 학습 신청 목록에도 같은 진입점을 제공한다. 팝업 차단·수식 키·새 탭 대체는 기존 컴포넌트 동작을 유지한다.

작성 버튼은 서류 편집기 진입이며 실제 모집 접수 기간과 기존 온라인 신청 검사를 대체하지 않는다. 소개 과정은 기존 편집기의 공개 과정 선택 범위와 동일하게 원서를 작성할 수 있고, 기존 기수 신청 버튼과 마감 안내는 유지한다.

문서 페이지는 query를 먼저 읽어 type을 허용 목록으로 정규화하고 course는 단일 UUID 또는 100자 이하의 기존 공개 과정 slug만 받는다. 로그인 returnTo에 같은 type/course를 넣어 과정 선택을 유지한다. 인증 후 서버 카탈로그의 id 또는 offeringId로 과정 선택을 해석한다. 선택한 ID가 공개 목록에 없으면 404, 카탈로그 실패면 실패 안내·일반 서류 작성 링크를 제공한다. URL의 임의 과정명·인적사항은 사용하지 않는다.

공통 `/mypage` layout의 인증도 원서 주소를 유지해야 한다. middleware가 실제 원서 pathname/query를 내부 request header로 전달하고 클라이언트가 보낸 동일 header를 덮어쓴다. 인증 쿠키 갱신 뒤에도 header와 갱신 쿠키를 보존한다. layout은 `safeReturnTo`로 검증해 같은 원서로 복귀시키며 인증 보호를 유지한다.

## 가입 정보

현재 이메일 가입·간편 가입의 수집 항목은 성명·이메일·휴대전화다. 성명·이메일은 기존 세션 identity 값, 휴대전화는 서버 `auth.getUser()`의 본인 native phone을 우선하고 가입 metadata `mobile_phone`을 대체로 사용한다. 한국 +82/82 번호를 기존 `normalizeMobilePhone/formatMobilePhone`으로 원서의 010 표기로 정규화한다. 유효한 기존 metadata `birth_date`가 있으면 생년월일도 제공한다.

반환할 필드는 phone/birthDate와 읽기 실패 상태뿐이다. 사용자 ID를 query로 받아 다른 사람을 조회하거나 service role로 전체 회원 정보를 읽지 않는다. 서버 조회 실패는 이름·이메일과 편집기를 유지하고 수동 입력 안내를 표시한다. 없는 정보는 빈칸, 편집은 기존 React 상태에 반영한다.

`initialValues`에 선택적 profile 인자를 추가해 세 원서의 기존 초기값 규칙을 유지한다. 동의·서명·주민번호·계좌는 항상 기존 빈 초기값. 원서 가입 동의 자동 체크 금지. 서식 탭 전환 시 기존 입력 유지 동작을 보존한다.

## 대상 파일

- `src/lib/learner-documents/model.ts`: 원서 URL·allowlist profile 변환·초기값.
- `src/lib/learner-documents/profile.ts`: 인증 서버의 본인 가입정보 조회.
- `src/middleware.ts`, `src/app/mypage/layout.tsx`: 공통 인증 과정에서도 선택한 원서 주소 유지.
- `src/app/mypage/documents/page.tsx`: 로그인 과정 유지·카탈로그 선택·profile 전달.
- `src/components/learner-documents/editor.tsx`: 초기 profile 사용·조회 실패 안내.
- `src/app/courses/[id]/page.tsx`, `src/app/offerings/[id]/page.tsx`, `src/app/offerings/[id]/apply/page.tsx`, `src/components/student-learning/dashboard.tsx`: 같은 원서 팝업 링크.
- 관련 회귀 검사와 `scripts/verify-course-application-document.mjs`: 실제 Auth·팝업·모바일·원서 접수 검증.

## 완료 검수

순수 모델/서버 경계: 국내/+82/native82 전화 정규화, 잘못된 프로필·날짜는 빈칸, 인적사항/동의가 URL이나 자동 체크에 들어가지 않음, UUID/slug·배열/잘못된/없는 과정 거부, 조회 실패 안내. 실제 최신 전용 로컬 DB와 합성 계정으로 A 상세→팝업→A 과정명·가입 성명/이메일/전화 입력, B로 재진입 시 B 선택, 비로그인→로그인→A 유지, 수정 가능·동의/서명 미선택, 실제 원서 제출·DB의 동일 과정 확인. 기존 온라인 신청 15개·PDF/과정/역할 검사, lint/production build 및 배포 commit/health 확인. 운영 DB의 실제 사용자 정보는 쓰지 않는다.
