# DB 연결 및 응답 개선 검증

2026-10-07 · db-connectivity-response-oct07

## 설계 대조: 100%

구현 10/10 항목: 승인된 문서 ID만 조회, 대상/수강생·기수/기수 권한의 일괄 계산, MFA 1회, registration 필드와 null 값 유지, 목록 순서 유지, 기존 base 필터/권한 유지, 기수 목록 조건 유지, private helper 직접 실행 거부, 동등성·성능 검사, DB 연결·브라우저·빌드 검사.

## 운영 DB 연결

운영 ref `uoebygejgglgiivzgyks`. life_offerings→course_versions, guide→offering, document→offering/org, application→offering/person, enrollment→application/offering/person, document_event→request의 6개 참조 검사에서 broken 0건. 기존 nullable 문서 연결은 오류로 간주하거나 수정하지 않았다.

공개 경로 7회 측정의 첫 요청 제외 중앙값/p95(ms): health 189.5/255, 홈 208/294, 과정 목록 262/322, 로그인 146.5/200. 모두 정상 응답이고 health healthy. 운영 누적 pg_stat_statements는 과거 실행을 포함하므로 현재 SQL 개선율이나 화면 개선율로 사용하지 않았다.

## 동등성 및 성능

`APPLICATION_TEST_DB_DIR=/tmp/u-livet-issues-db node scripts/verify-learner-document-batch.mjs`는 실제 native Auth의 JWT와 역할을 사용한다. 전용 로컬 DB 트랜잭션에서 400건의 합성 원서와 별도 기수를 만들고 기존/새 전체 JSON 응답을 비교한 뒤 모든 시험 자료와 시험 DDL을 롤백한다. 원래 함수는 기존 migration에서 읽으므로 개선 함수가 적용된 로컬 DB에서도 재실행할 수 있다.

11개 검사 통과: 학습자 본인 필드·순서, 학습자 관리자 접근 거부, 강사 본인 격리, 강사 관리자 접근 거부, 익명 거부, 관리자 4종 필터·기관·순서, private helper 거부, 모집 중 신청 가능 상태, 심사 대기 등록 가능 상태, 활성 등록 상태, 종료/유료 상태.

관리자 전체 원서 현황 함수의 6쌍 교차 실행 중 첫 쌍 제외 5쌍 중앙값은 **2,789.734 → 449.519ms**, 약 **83.9% 감소**였다. 로컬 SQL 내부 실행시간이며 운영 페이지 전체 응답 개선율은 아니다. 이전 단계의 반복 측정도 같은 감소 방향이었다.

## 회귀 및 릴리스 준비

- 실제 production 브라우저 로그인→원서 선택→PDF 생성→접수→비공개 PDF 조회 9개 통과. DB 동일 기수/수강생/접수 상태, 모바일 360px와 데스크톱 1440px 확인.
- 원서 서버/목록 경계 11개 통과, lint 경고 0, 최종 소스 production build/타입 검사 통과.
- 전용 로컬 security advisors 지적 없음. 운영 기존 경고 6개는 기존 공개 함수/MFA 설정이며 새 private helper와 다른 변경 대상에는 지적 없음.
- 운영 dry-run은 `20261007124307_batch_learner_document_registration.sql` 1개만 대상. seed/roles 변경 없음.
- 운영 기존 문서 함수 10개의 정의/소유자/권한 메타데이터를 사전 확보했다. 적용 후 변경 wrapper 2개와 helper를 검증한 로컬 정의와 비교하고, 나머지 함수 및 기존 권한의 보존을 확인한다.
- 최종 변경에는 Auth/프런트엔드 코드 수정이 없다. 실제 RSC에서 Auth HTTP 읽기가 이미 1회여서 추가 cache의 속도 이득을 입증하지 못했으며, 현재 인증 검증을 유지했다.

PR push/merge와 운영 migration 적용 후 exact main SHA의 Vercel production 배포 및 사이트 revision/health를 확인한다. 합성 산출물·환경파일·사용자 데이터는 커밋하지 않는다.
