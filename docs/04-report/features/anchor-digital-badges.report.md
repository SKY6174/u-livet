# 디지털배지 발급·검증 구현 결과

2026-09-19 · 전용 로컬 `uc-life-core`에서 구현·검증 완료. 원격 DB와 운영 사이트에는 적용하지 않았다.

## 사용 흐름

1. 증명 관리 → **디지털배지 관리**(`/credentials/badges`)에서 과정담당이 기수별 배지명·성취 내용·만료 기준·승인 정책·발급 명의를 연결한다. BADGE 위임이 있는 별도 발급자가 정의를 승인한다.
2. 수강생은 나의 공간 또는 수강이력 → **나의 디지털배지**(`/mypage/badges`)에서 승인 기준을 확인하고 신청한다. 최신 수료가 확정되어야 하며 신청하지 않아도 수료·LMS 이용에 영향을 주지 않는다.
3. 발급자는 현재 근거와 위임을 확인하고 발급한다. 중복 요청은 같은 배지로 처리하며 원본 JSON·번호·해시·발급 이력을 함께 저장한다. 자기 발급은 금지한다.
4. 배지 상세에서 현재 상태와 원본을 확인한다. 근거 변경·취소·만료는 즉시 상태에 반영되고, 사유를 남긴 정정 발급은 이전 기록을 보존하며 새 배지로 대체한다.
5. 배지는 기본 비공개다. 본인이 공유 안내를 확인하고 동의하면 링크를 생성한다. 링크 교체·철회를 지원한다. 공개 검증은 마스킹 이름과 최소 발급 정보만 제공한다. 받은 JSON 파일은 브라우저 안에서 원본 해시와 비교한다.

## 검증

| 검사 | 결과 |
|---|---|
| 인증·신청·LMS | 33 통과 |
| 출결·시험·수료 | 33 통과 |
| 이수증·강사 경력증명 | 24 통과 |
| 수납·환불 | 37 통과 |
| 안내문자·선택동의 | 39 통과 |
| 연차 평가·설문·보고 | 37 통과 |
| 배지·공유·정정·권한 | 34 통과 |
| 합계 | **237 통과** |
| 로컬 migration 전체 재생 | 18개 성공 |
| lint / production build | 통과 |
| 로컬 DB security advisor | warn 이상 없음 |

브라우저에서 실제 로그인 → 발급 → 배지함 → JSON 다운로드 → 공유 → 익명 검증 → 파일 일치 → 철회 → 조회 차단을 확인했다. 다운로드는 본인 200/다른 수강생 404/익명 401, `private, no-store`. 공개 API의 잘못된 JSON은 400, 1KB 초과는 413이다. 공개 화면에는 전체 이름이 표시되지 않았고 링크의 fragment가 주소에서 제거됐다. 모바일 390px의 배지함·상세·검증에 가로 넘침이 없으며 확인한 세 브라우저의 페이지 오류는 없었다.

## 근거와 재현

- [상세설계](../../02-design/features/anchor-digital-badges.design.md), [설계 대비 검사](../../03-analysis/anchor-digital-badges.analysis.md)
- [신규 34개 검사](evidence/badges-evaluation.txt), [DB 보안 점검](evidence/badges-security.txt), [HTTP 응답](evidence/badges-http.txt)
- [발급 상세](evidence/badges-issued.png), [모바일 배지함](evidence/badges-wallet-mobile.png), [모바일 상세](evidence/badges-detail-mobile.png), [공개 검증](evidence/badges-public-mobile.png)
- [원본 일치 화면 기록](evidence/badges-public-original.txt), [공유 철회](evidence/badges-withdrawn.txt), [철회 후 공개 조회](evidence/badges-withdrawn-public.txt)

신규 migration: `supabase/migrations/20260918172613_anchor_digital_badges.sql`. README 순서대로 기존 검사를 실행한 뒤 `node scripts/verify-badges.mjs`로 재현한다. 모든 계정·기관·정책·배지는 가상 로컬 자료다. 테스트 스크립트가 남기는 브라우저용 신청을 발급자로 처리하면 위 흐름을 확인할 수 있다. 증거 이미지의 공유 코드는 철회되어 현재 조회되지 않는다.

## 기관 결정과 남은 범위

실제 기관 발급권·배지 기준·공유 동의 문안·보유기간을 등록하기 전 운영 발급을 시작하지 않는다. 기존 환불·감면 규정 미확정 조건은 유지한다.

현재 원본은 내부용 `U_LIFE_BADGE_V1` JSON이며 Open Badges 서명·표준 적합성 인증·외부 지갑 연동을 구현한 것으로 표시하지 않는다. 추가 외부 업체 지정 없이 안내한 내부 구조로 진행했다. 원본 파일에는 성명이 포함된다. 공유를 철회해도 수신자가 이미 복사한 정보까지 회수하지는 못한다.

외부 지갑·서명, 일괄/복합 배지, 이미지 업로드, 대규모 부하, 개인정보 보유·파기와 운영 배포는 후속이다. 관리자 MFA·모니터링·백업·복구 준비도 전체 플랫폼 작업으로 남아 있다.

bkit: `anchor-digital-badges` Plan → Design → Do → Check → Act → Report. 전체 `anchor-lifelong-education-platform`은 Do 진행 중. 다음 독립 구현 후보는 **강사 프로필·자격/경력·과정 개발 관리**다.
