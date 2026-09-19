# Main → Preview 통합 결과

- 일자: 2026-09-19
- 기능: `anchor-preview-main-integration`
- 병합 커밋: `3c807ce80bdc8b4eecf9d87bdbdbe1cd497c3f19`
- 반영 대상: `origin/preview`

## 결과

main의 최신 DB 조회 최적화와 Tokyo 실행 리전을 preview에 충돌 없이 병합했다.
2026 RISE 교육과정 편성표, 과정 결과보고서와 출력 6종을 보존했고,
관리자 목록에는 소속기관 조회 범위 제한과 결과보고서 링크를 함께 유지했다.
양쪽 브랜치의 이력이 일반 merge 커밋으로 보존된다.

## 검증

- lint 및 Next.js production build 성공.
- DB 성능 13개, 과정 편성표 14개, MFA 23개: 총 50개 회귀 검증 통과.
- 과정 편성표·보고서 관련 코드와 데이터가 병합 전 preview와 동일함을 확인.
- 설계 유지 동작 6/6 충족. 상세: `docs/03-analysis/anchor-preview-main-integration.analysis.md`.

## 다음 단계

Production 전환 절차의 2단계인 호스팅된 Preview 통합 검증:
로그인·MFA, 역할별 과정 조회, 교육과정 검색, 보고서 저장·파일 첨부·출력 동작 확인.
이 작업에서 운영 DB 마이그레이션이나 main 대상 푸시는 수행하지 않는다.
