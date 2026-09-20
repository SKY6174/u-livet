# Google 로그인·계정 안내 개정 작업 기록

확인일: 2026-09-20 KST. `account-privacy-v3.txt`는 검토용이며 아직 승인·공개 적용하지 않았다.

## 확인한 상태

- Preview의 기존 수강생·교외 강사 계정으로 Google 로그인을 완료했고 기존 사람·역할 연결이 보존되었다. 휴대폰은 미인증 상태다.
- 운영 Supabase의 Google은 Enabled이지만 운영 홈페이지 Google 버튼은 준비 중이다. 운영 Google identity는 0개였다.
- 양쪽 DB의 최신 승인 문안은 ACCOUNT-2026-09-19-v2이며 본문 SHA-256은 `0c0c9405e584b9d566d2e71801cc825de6529b2352091eaddee9ba25f44b70b4`로 일치한다.
- 기존 Preview Google identity 2개에서 `picture`·`avatar_url` 주소가 확인됐다. 인증 메타데이터의 실제 키만 확인했으며 URL 값은 기록하지 않았다.
- 사용자 결정에 따라 Google 요청을 `openid email`로 축소했다. Supabase Preview의 302 응답에서 scope 전달을 확인했다. 과거 프로필 권한 합산을 요청하지 않는다.
- 회귀 검사: 로그인 대상/제공자 28개, 카카오 가입 37개 통과. ESLint와 TypeScript 검사 통과.
- Preview 코드 커밋 `0ece30ce9742a26cda381c015f1390b0960e9260`을 push했고 `dpl_2yJGwe5Zhr7ecV4vQfjVJW2eTN4d`가 READY가 됐다. staging.uc-life.org의 `/api/version`도 이 커밋이다.
- 배포 후 브라우저 Google 인가 요청의 scope=`openid email`, include_granted_scopes=`false`를 확인했다. 기존 수강생은 `/mypage`, 기존 교외 강사는 `/instructor`에 정상 복귀했다. Google identity 두 건 모두 새 응답에서 사진 주소가 없어졌다.
- 과거 `auth.users.raw_user_meta_data`의 사진 주소는 두 테스트 계정에 남아 있다. SQL 정리 시도는 연결 도구의 읽기 전용 트랜잭션 제한으로 실행되지 않았다. 일반 Auth 사용자 정보 수정 API를 이용한 로그인 시 정리 방식을 검증한다.
- 운영 배포 `dpl_9YUXQtbtiNRSD99uch5jKj8jgQB2`의 함수 지역은 hnd1, Supabase 운영 지역은 ap-northeast-1이다. v2의 Vercel iad1 설명을 v3 초안에서 수정했다.

## v3 검토 범위

- Google 계정 식별·이메일·확인 상태, 이름 직접 입력, 교외 강사 선택 로그인과 실제 역할 분리를 반영한다.
- 휴대폰 필수 입력·미인증 저장, 계정 폐쇄 시까지 보유, 문의 052-230-0410은 유지한다.
- 사진 주소를 필요한 이용 항목으로 추가하지 않는다. 이 초안을 적용하려면 신규 로그인 반환 정보와 과거 사진 메타데이터 정리 결과가 먼저 확인되어야 한다.
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
