# 내 정보 확장 검증

- 작성일: 2026-10-08
- 설계: `docs/02-design/features/account-profile.design.md`
- 요구사항 일치: 100% (6개 항목 입력·표시·수정, 역할별 링크 제거, 동의 이력 표시 제거)
- 본인 전용 RPC와 서버 입력 검증, 빈값 삭제, 연락용 이메일과 로그인 이메일 분리, 표시 직책과 권한 직책 분리가 구현됨.
- 기존 사업단·강사 명부 연락처를 읽으며 자기 수정은 기존 명부 연락처와 revision에 반영됨. 강사 기존 전화번호도 첫 입력값으로 사용함.
- `verify-account-profile.mjs`: 7개 입력·서버 동작·권한·화면 회귀검사 통과.
- `verify-role-navigation.mjs`: 23개 역할 메뉴·진입·기존 학습 화면 회귀검사 통과. 기존 정책 메뉴 추가에 맞춰 기대값 갱신.
- `verify-account-profile.sql`: 격리 DB 스키마 복제에서 6개 항목 저장·재수정·빈값·입력 거절·본인 격리·권한 유지·명부 연동·직접 접근 및 익명 거절 검증 통과. 가상 데이터 rollback.
- `verify-account-profile-browser.mjs`: 별도 시험 DB와 Native Auth/REST, Next production build를 사용해 사업단·교내·교외 3개 브라우저 흐름 통과. 저장→새로고침→재수정→빈값 저장, 390px 모바일 넘침 없음, 수신 설정 URL 리다이렉트, 브라우저·Next 런타임 오류 없음 확인. 시험 서비스·DB 정리됨.
- lint, TypeScript, production build 통과. 운영 적용 후 같은 마이그레이션의 RLS·실행 권한과 운영 배포 SHA를 추가 확인한다.
- 누락된 요구사항 없음. 후속 단계: 운영 마이그레이션, PR 병합, 배포 결과 보고.
