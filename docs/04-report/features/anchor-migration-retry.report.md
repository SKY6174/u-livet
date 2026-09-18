# anchor-migration-retry 완료 보고

2026-09-19 · 로컬 수정 및 검증 완료. 원격 적용 미실시.

## 결과

ANCHOR/uc-life의 실제 배포 로그에서 **009가 이미 존재하는 정책을 생성하여 SQLSTATE 42710으로 실패**한 원인을 확인했다. 원격 이력은 001~008인데 009·010 정책 객체가 존재한다. 이 불일치가 발생한 경로는 확인하지 못했다.

009에 6개, 010에 9개 `DROP POLICY IF EXISTS`를 추가했다. 정책 내용과 데이터 조작을 바꾸지 않고 최초 실행 및 재실행을 가능하게 했다. 새 검사기 `scripts/verify-migration-retry.mjs`는 기존 로컬 프로젝트와 분리된 임시 PostgreSQL DB만 사용한다.

## 검증 결과

- `npm run test:migration-retry`: 10개 통과. 원본 009·010 각각 오류 재현, rollback, 최초/반복/부분 상태 적용, 무관한 정책·기존 행·catalog 정의 보존, 임시 DB 정리 확인.
- `npm run test:release`: 111개 통과. 합성 설정 검사이며 실제 배포 승인 결과가 아니다.
- `node --check scripts/verify-migration-retry.mjs`, `git diff --check`: 통과.
- [설계 대조](../../03-analysis/anchor-migration-retry.analysis.md): 이번 범위 10/10 확인.

## 함께 확인한 인증 설정

실제 원격은 최소 6자, 문자 조합 null, CAPTCHA 비활성, custom SMTP 미설정이었다. 이메일 가입과 TOTP 등록/검증은 활성이다. 요구사항은 **12자 이상 + 영문·숫자·특수문자, 대소문자 동시 요구 없음**으로 유지했다. 현재 공개 관리 API의 프리셋만으로 정확한 조건을 표현할 수 없어 공급자 지원 여부와 운영 배치를 결정해야 한다.

## 다음 단계

1. [인증 구성 결정안](../../operations/auth-deployment-decision.md)의 Cloud 지원 조건을 확인한다. 문의 초안은 준비했지만 발송하지 않았다.
2. [재시도 절차](../../operations/supabase-migration-retry.md)에 따라 별도 Preview에서 전체 migration·권한·native 인증 동작을 검증한다.
3. 실제 증거와 최신 소스 지문으로 배포 인수 기록을 갱신한다.

[원격 조회 근거](evidence/migration-retry-remote-observations.md), [실행 결과 요약](evidence/migration-retry-tests.txt).

이번에 원격 DB/Auth 설정·이력을 변경하거나 Git push·배포·유료 리소스 생성을 수행하지 않았다. `.env.local`은 읽거나 수정하지 않았다. 기존 다른 작업 변경사항도 보존했다.
