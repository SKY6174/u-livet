# Google 로그인·계정 안내 개정 작업 기록

확인일: 2026-09-20 KST. `account-privacy-v3.txt`는 사용자 승인 후 운영·스테이징 DB에 적용했다. 아래 최초 확인 상태는 적용 전 기록이다.

## v3 승인 및 적용 기록

- 승인자: 송경영. 2026-09-20 이 작업의 문안 승인 질문에 “문안 승인 — 운영·스테이징 적용 및 운영 Google 로그인 개방”으로 명시 응답했다.
- 승인 대상은 ACCOUNT-2026-09-20-v3 검토안 전체다. 최종 파일은 초안 표시 한 줄만 제거했으며 본문 SHA-256은 `b92ab4dd73a69c355cdb0d81fd01fd6d48694cc1c21d146fdce9558f52a71bdb`다.
- Preview: 정책 `350624d9-d71c-432b-b7f4-32cfb3afd2da`, 승인 등록·효력 시작 `2026-09-20T12:43:43.513303Z` (21:43:43 KST).
- Production: 정책 `1b3e61b8-4599-4b0c-9fc4-eaeaebde4446`, 승인 등록·효력 시작 `2026-09-20T12:44:29.738854Z` (21:44:29 KST).
- 두 환경 모두 APPROVED, 본문 해시 일치, 가입 설정이 v3를 선택함을 확인했다. 승인 등록 시각은 사용자의 응답 직후 DB에 등록한 시각이다.
- 각 DB의 실제 SYSTEM_ADMIN 역할을 가진 승인자를 확인한 트랜잭션으로 새 정책을 등록하고 가입 포인터만 바꿨다. 이전 APPROVED 정책, 동의 이벤트, 연락처, 역할은 수정하지 않았다.
- 운영 `AUTH_GOOGLE_ENABLED=true`를 설정했다. 운영 main 배포와 최종 화면 검증 결과는 후속 확인 기록에 남긴다.

## 확인한 상태

- Preview의 기존 수강생·교외 강사 계정으로 Google 로그인을 완료했고 기존 사람·역할 연결이 보존되었다. 휴대폰은 미인증 상태다.
- 운영 Supabase의 Google은 Enabled이지만 운영 홈페이지 Google 버튼은 준비 중이다. 운영 Google identity는 0개였다.
- 양쪽 DB의 최신 승인 문안은 ACCOUNT-2026-09-19-v2이며 본문 SHA-256은 `0c0c9405e584b9d566d2e71801cc825de6529b2352091eaddee9ba25f44b70b4`로 일치한다.
- 기존 Preview Google identity 2개에서 `picture`·`avatar_url` 주소가 확인됐다. 인증 메타데이터의 실제 키만 확인했으며 URL 값은 기록하지 않았다.
- 사용자 결정에 따라 Google 요청을 `openid email`로 축소했다. Supabase Preview의 302 응답에서 scope 전달을 확인했다. 과거 프로필 권한 합산을 요청하지 않는다.
- 회귀 검사: 로그인 대상/제공자 28개, 카카오 가입 37개 통과. ESLint와 TypeScript 검사 통과.
- Preview 코드 커밋 `0ece30ce9742a26cda381c015f1390b0960e9260`을 push했고 `dpl_2yJGwe5Zhr7ecV4vQfjVJW2eTN4d`가 READY가 됐다. staging.uc-life.org의 `/api/version`도 이 커밋이다.
- 배포 후 브라우저 Google 인가 요청의 scope=`openid email`, include_granted_scopes=`false`를 확인했다. 기존 수강생은 `/mypage`, 기존 교외 강사는 `/instructor`에 정상 복귀했다. Google identity 두 건 모두 새 응답에서 사진 주소가 없어졌다.
- 과거 사진 정보는 Auth `updateUser`로 해당 사용자의 다음 로그인 시 정리하고 세션을 갱신하도록 구현했다. SQL 정리 시도는 읽기 전용 연결로 실행되지 않았으며 DB 권한이나 스키마는 변경하지 않았다.
- 최종 코드 `49bc2d077b07642580ba094cd133806294eb548e`의 배포 `dpl_FGtzhWVVYihrf16PU2LXC3NyQaPS`가 READY이고 staging의 버전도 일치했다. 수강생·교외 강사가 재로그인한 뒤 Google identity 2개에서 identity/사용자 메타데이터의 사진 키는 모두 0건이었다. 기존 사람 연결·강사 역할·미인증 휴대폰 상태도 유지됐다.
- 사진 정리 callback 검사 13개를 추가 통과했다. 과거 발급 토큰·공급자 백업까지 즉시 제거됐다는 뜻은 아니다. 배포 직후 한 차례 로그인 화면 POST가 400이었으나 새로고침 후 양쪽 인증은 성공했다. 400의 정확한 원인은 이번 기록만으로 확정하지 않았다.
- 운영 배포 `dpl_9YUXQtbtiNRSD99uch5jKj8jgQB2`의 함수 지역은 hnd1, Supabase 운영 지역은 ap-northeast-1이다. v2의 Vercel iad1 설명을 v3 초안에서 수정했다.

## v3 검토 범위

- Google 계정 식별·이메일·확인 상태, 이름 직접 입력, 교외 강사 선택 로그인과 실제 역할 분리를 반영한다.
- 휴대폰 필수 입력·미인증 저장, 계정 폐쇄 시까지 보유, 문의 052-230-0410은 유지한다.
- 사진 주소를 필요한 이용 항목으로 추가하지 않는다. Preview의 신규 인증 응답과 과거 사진 메타데이터 정리를 확인했으며 운영 개방 전 동일 코드를 배포한다.
- Vercel 함수 도쿄 실행과 미국/글로벌 계약상 처리를 구분한다. 이번 검토가 국외 처리의 모든 법적 요건을 새로 확정한다는 뜻은 아니다. 기존 기관의 국외 처리 검토 결과에 변경 범위를 반영한다.
- 네이버 개방, 장학금·생년월일·성별·계좌 수집은 이 개정에 포함하지 않는다.

## 승인 후 적용 순서

1. 확정된 본문에서 초안 표시를 제거하고 최종 본문 해시, 실제 승인자·승인시각·승인 근거를 기록한다. 현재 파일 전체의 해시를 최종 본문 해시로 잘못 사용하지 않는다.
2. Preview에 새 ACCOUNT_PRIVACY 버전을 추가한다. 기존 APPROVED 정책은 불변이므로 수정·삭제하거나 동결 트리거를 끄지 않는다.
3. `life_private.signup_settings.policy_id`만 새 정책으로 교체하고 `life_signup_policy()` 결과를 확인한다. `/privacy`와 `/auth/complete-signup`, 이메일 가입 화면이 새 본문을 읽는지 확인한다.
4. 기존 `life_consent_events`·연락처의 과거 policy_id를 새 버전으로 일괄 변경하지 않는다. 기존 가입자가 기존 동의를 가진다는 사실과 새 제공자 선택은 구분한다. 새로운 필수 동의를 받기로 결정하는 경우 별도 동의 화면을 구현한 뒤 적용한다.
5. 운영에 같은 최종 문안을 추가하고 가입 설정을 교체한다. 운영 전용 Google callback과 `AUTH_SITE_ORIGIN=https://uc-life.org`를 확인한다.
6. 최소화 코드를 main에 반영하고 운영 환경의 `AUTH_GOOGLE_ENABLED=true`로 새 운영 배포를 만든다. Preview 배포를 그대로 승격해 Preview DB를 운영에 연결하지 않는다.
7. 운영에서 수강생·교외 강사 로그인, 기존 계정 연결, 사업단·교내 차단, 휴대폰 미인증과 실제 데이터 항목을 확인한다. 실패하면 Google 화면 설정을 되돌리고 기존 인증·회원 기록을 보존한다.

## 공식 참고

- Google 기본 정보 범위: https://developers.google.com/identity/openid-connect/openid-connect
- Supabase Google 공급자: https://supabase.com/docs/guides/auth/social-login/auth-google
- Google 테스트 모드의 기본 로그인 예외: https://support.google.com/cloud/answer/15549945
- Vercel 지역 및 DPA: https://vercel.com/docs/regions · https://vercel.com/legal/dpa
- Supabase DPA: https://supabase.com/legal/customer-resources/data-processing-addendum
- Resend DPA: https://resend.com/legal/dpa
