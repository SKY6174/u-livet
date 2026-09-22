# 강사 이력·과정 개발 구현 결과

2026-09-19 · 로컬 `uc-life-core`에서 구현·검증 완료. 원격 DB와 운영 홈페이지에는 적용하지 않았다.

## 사용 흐름

1. 나의 공간 → **강사 이력·등록 심사**(`/mypage/instructor`)에서 기관과 개인정보 안내를 선택한다. 전문분야·자기소개·학력·자격·산업/강의 경력과 증빙 참조를 저장하고 심사를 신청한다.
2. 사업단 → **강사 이력 심사**(`/admin/instructors`)에서 제출 자료를 확인한다. 담당자는 승인 기준·외부 증빙을 대조해 보완/반려/승인하고 유효기간·근거를 남긴다. 본인 심사는 금지하며 보완은 새 버전이다.
3. 승인 후 본인이 별도로 공개 동의하면 실제 담당 과정에 이름·전문분야·공개 소개만 표시한다. 심사자료는 공개하지 않는다. 공개 철회·정책 만료·역할/배정/계정 변경을 확인한다.
4. **과정 개발·제안**(`/development`)에서 수요 근거, 목표 역량, 차시별 이론·실습, 평가안, 준비물, 예산 근거를 작성한다. 총시간이 맞아야 제출할 수 있다.
5. **과정 개발·심의 관리**(`/admin/development`)에서 별도 담당자가 승인하면 고정된 과정 버전을 만든다. 승인본으로 여러 기수를 개설하고 기존 모집·수납·강사 배정으로 이어간다. 개발·개편 승인 수와 기수 수는 구분한다.

## 사용자 결정·운영 경계

**강사 등록·자격 심사 기준은 미확정이며, 승인 기준 등록 후 사용**한다는 사용자 답변을 반영했다. 실제 등급·강사료·세율은 넣지 않았다. 승인된 개인정보 안내·심사 기준·공개 안내·개발 기준은 실제 기관 문안과 보유기간을 확정한 뒤 등록한다.

이력 승인만으로 위촉·계약이나 강의 배정 권한을 자동 부여하지 않는다. 실제 위촉 확인 후 기존 신뢰된 역할 등록·배정 절차를 사용한다. 외부 이력을 앵커사업단 경력증명서에 자동 합산하지 않는다. 기존 확정 강의일지 기반의 경력증명 기능을 유지한다.

파일 업로드·외부 자격기관 조회·위촉/전자계약·강사료·세무·기관별 이력 승인 정지 UI·위원회 심의·전체 검색/대용량·개인정보 파기는 후속이다. 이번에는 문서 참조만 저장한다. 최근 등록100건을 보여주며 추가 자료 존재 여부를 표시한다. 실제 환불·감면 기준 미확정 조건도 유지한다.

## 검증

| 검사 | 결과 |
|---|---|
| 인증·신청·LMS | 33 통과 |
| 출결·시험·수료 | 33 통과 |
| 이수증·강사 경력증명 | 24 통과 |
| 수납·환불 | 37 통과 |
| 안내문자·동의 | 39 통과 |
| 연차 평가·성과 | 37 통과 |
| 디지털배지 | 34 통과 |
| 강사 이력·과정 개발 | 33 통과 |
| 합계 | **270 통과** |
| 전체 migration 재생 | 19개 성공 |
| lint / production build | 통과 |
| DB 보안 advisor | warn 이상 없음 |

실제 브라우저에서 이력 편집·제출·별도 승인 → 공개 소개 동의·철회와 과정 제안 편집·제출·별도 승인 → 기수 개설 → 모집 공개를 확인했다. 공개 화면에 심사용 자기소개·증빙 참조가 나타나지 않았다. 모바일390px 이력·공개 소개·과정 편집의 가로 넘침 없음. 비로그인 보호 URL은 로그인으로 이동하며 비공개 증빙을 응답에 포함하지 않는다. 최종 역할별 브라우저 오류 없음. 첫 세션의 재현되지 않은 오류와 검사 범위의 구분은 분석 문서에 기록했다.

## 파일과 증거

- [상세설계](../../02-design/features/anchor-instructor-development.design.md), [설계 대비 검사](../../03-analysis/anchor-instructor-development.analysis.md)
- [33개 검사](evidence/instructor-development.txt), [보안 점검](evidence/instructor-security.txt), [보호 URL 확인](evidence/instructor-http.txt)
- [이력 승인 화면](evidence/instructor-approved.png), [모바일 이력](evidence/instructor-owner-mobile.png), [선택 공개 소개](evidence/instructor-public-mobile.png), [공개 철회 확인](evidence/instructor-public-withdrawal.txt)
- [과정 편집 모바일](evidence/development-editor-mobile.png), [기수 개설](evidence/development-opened.png), [모집 공개 내용](evidence/development-published.txt), [개발·심의 현황](evidence/development-board.png)

신규 migration: `supabase/migrations/20260918174631_anchor_instructor_development.sql`. 재현: README 순서대로 기존 검사를 실행한 뒤 `node scripts/verify-instructor-development.mjs`. 모든 계정·기관·기준은 로컬 가상 자료다. 검증 화면에서는 `[검증용] 강사·개발 사업단`을 선택한다.

bkit: `anchor-instructor-development` Plan → Design → Do → Check → Act → Report. 전체 `anchor-lifelong-education-platform`은 Do 진행 중. 다음 독립 작업 후보는 **관리자 MFA·민감 업무 재인증**이다.
