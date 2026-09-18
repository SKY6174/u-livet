# anchor-preview-db-validation 설계 대조

2026-09-19 · [설계](../02-design/features/anchor-preview-db-validation.design.md)

이번 범위는 Cloud Preview의 업무 DB 적용·제한된 권한 검사와 별도 인증 서버 운영 설계다. 전체 서비스나 인증 인수 완료율로 해석하지 않는다.

## 대조 결과

| 완료 기준 | 관측 결과 | 판정 |
|---|---|---|
| Preview 대상·부모·데이터 미복사 확인 | 부모 uc-life, preview는 비기본 브랜치·with_data=false·ACTIVE_HEALTHY | 완료 |
| 적용 파일 제한·원본 동일성 | 기존 19개 파일을 별도 작업 폴더에 복사, 원본/사본 SHA-256 모두 일치 | 완료 |
| 승인된 11개만 실행·원래 버전 기록 | CLI dry-run 11개, 실제 push 종료 0, 최종 이력 19개 | 완료 |
| Auth 3개 제외 | 복구·MFA·남용 방지 버전이 원격 이력에 없음 | 완료 |
| 업무 테이블 RLS | public life_ 73개·life_private 11개 모두 활성 | 완료 |
| 기존 API 접근 회수 | legacy 관계 객체/definer 함수의 anon·authenticated 접근 0개 | 완료 |
| private/서버 함수 경계 | private CREATE 거부·테이블 권한 없음, 함수 search_path 고정. 증명서 서버 definer 3개는 service_role 전용 | 완료 |
| 데이터 및 main 보존 | 회원/학습자/신청/파일 0건, 기본 조직·연차 각 1건. main 이력 8개 유지 | 완료 |
| 익명 경계·Advisor 관측 | 실제 REST 3건 통과. Advisor WARN/ERROR 0, 기본 거부 테이블 INFO 61 | 완료 |
| 별도 인증 서버 설계 | 배치·정책·책임·백업·전환·Cloud DB 유지 대안 및 후속 구현 작성 | 완료 |

범위를 제한한 완료 기준 10/10 충족. 전체 인증·업무 E2E나 운영 준비가 100%라는 뜻이 아니다. 자동 분석 도구는 실제 검증을 실행하는 도구가 아니므로 위 판정은 CLI·원격 catalog·REST 관측과 문서 대조에 근거한다.

## 설계에서 구체화된 항목

- Management API가 `SET ROLE anon`을 42501로 거부했다. 권한을 늘리지 않고 실제 공개 anon 키를 사용하는 REST 호출로 대체했다. 실패한 SQL 방식을 성공 검사에 포함하지 않았다.
- public SECURITY DEFINER가 0개라는 가정은 기존 증명서 worker 3개와 맞지 않았다. 기존 설계상 서버 전용이며 고정 search_path, anon/authenticated 실행 거부, service_role 실행 허용을 확인했다. 브라우저용 invoker 경계와 구분하도록 검증 문구를 수정했다.
- life_private의 USAGE는 RPC 호출을 위해 anon/authenticated에 허용되어 있다. CREATE와 내부 테이블 직접 권한은 없다. 스키마 이름이 private이라는 이유만으로 보안을 주장하지 않는다.
- 기본 조직/연차가 각각 1개이고 기존 migration의 참조용 seed도 있으므로 DB 전체가 비었다고 표현하지 않는다. 실제 계정·수강신청·파일 복사는 없다.

## 남은 인수 범위

현재 Cloud Preview는 비밀번호 길이만 12자이며 정확한 문자 조합은 미충족이다. Auth 후속 3개 migration, 인증된 사용자 세션, 복구·MFA·SMTP·CAPTCHA·역할별 업무·실제 브라우저 인수는 미완료다. 승인 개인정보 정책도 0개이므로 가입 개방 상태가 아니다.

사용자가 선택한 것은 별도 인증 서버 운영 **설계**다. Auth/업무 DB 공동 운영은 기존 의존성을 고려한 제안이며 실제 DB 이관·유료 서버 구매는 별도 결정이다. 다음 구현에서는 Cloud 전용 배포 검사기를 self-hosted 배치에 맞게 확장하고 운영 설정을 인수해야 한다.

증거: [적용 파일 지문](../04-report/features/evidence/preview-business-manifest.json), [검증 요약](../04-report/features/evidence/preview-business-validation.json), [인증 서버 운영 설계](../operations/self-hosted-auth-design.md).
