# Supabase Preview 함수 413 오류 수정

2026-11-02 · 사용자 요청: Supabase Preview 함수 검사의 HTTP 413을 해결하고 PR, push, merge, deploy까지 완료한다.

## 문제와 목표

- `instructor-documents`의 한글 TTF 두 개가 합계 5,943,060바이트로, 서버 측 번들의 5MB 제한보다 크다. 최근 Preview와 main의 함수 배포 상태가 `FUNCTIONS_FAILED`다.
- 배포 번들을 제한보다 작게 만들고, 기존 동의서 PDF의 한글·서명·양식 및 인증·권한 처리를 보존한다.
- 자동 Preview 검사와 배포 후 함수 실행을 모두 확인한다. 변경이 없는 `operation-report-ai`의 동작도 유지한다.

## 완료 기준

1. 함수 소스 및 의존성·자산을 포함한 실제 배포 크기를 측정하고 5MB 미만으로 검증한다.
2. 개인정보 동의, 범죄경력 조회 동의, 청렴 서약 PDF 세 종류에서 한글과 서명이 정상적으로 생성된다.
3. Supabase Preview 검사가 성공하고 인증되지 않은 요청은 계속 차단된다.
4. PR 검사 후 병합하고 Supabase 운영 함수와 Vercel 운영 앱을 배포·확인한다.
5. 비밀값·실제 사용자 데이터는 출력하거나 저장소에 추가하지 않는다. 운영 DB schema 및 사용자 데이터는 변경하지 않는다.
