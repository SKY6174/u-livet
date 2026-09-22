# Main → Preview 통합 검증

- 일자: 2026-09-19
- 검증 커밋: `3c807ce80bdc8b4eecf9d87bdbdbe1cd497c3f19`
- 설계: `docs/02-design/features/anchor-preview-main-integration.design.md`
- 병합 부모: preview `f2f50600977b487950499c12b61ae7125384bf80`, main `5d58a624cc4905ee4e1112ff38b05b688924824d`

## 설계 일치율: 100% (유지 동작 6/6)

| 설계 항목 | 확인 결과 |
| --- | --- |
| 관리자 역할·소속 조회·보고서 링크 | 자동 병합된 관리자 페이지를 직접 검토해 모두 확인 |
| 최소 필드·ID 범위 제한·오류 구분 | DB 성능 회귀 13개 통과 |
| 요청별 Supabase 클라이언트와 인증 유지 | 구현 검토 및 MFA 회귀 23개 통과 |
| Tokyo 실행 리전·빌드 명령 | vercel.json의 hnd1과 build:vercel 확인 |
| 교육과정 원문 데이터·인력 구분 | 편성표 회귀 14개 통과, 관련 파일 병합 전과 동일 |
| 보고서 및 6종 출력 | 보고서 UI·서버 코드·파일 API·출력 CSS·마이그레이션이 병합 전과 동일, 빌드에 보고서·출력 경로 포함 |

## 공통 검증

- `npm run lint`: 성공, 경고 없음.
- `npm run build`: 성공, TypeScript 검사 및 전체 경로 생성 완료.
- 별도 체크아웃에 환경 파일을 복사하지 않고 검증했다.
- `git diff --cached --check`: 성공.
- `git merge-base --is-ancestor`: 두 부모 모두 포함.
- 충돌 및 설계 대비 누락: 없음.

## 검증 범위

- 기존 회귀 스크립트는 모의 데이터로 수행했으며 원격 DB를 변경하지 않았다.
- 호스팅된 Preview의 실제 로그인·보고서 저장·파일 첨부·출력 통합 검증은 다음 단계다.
- 운영 DB 마이그레이션과 Production 전환은 수행하지 않았다.
