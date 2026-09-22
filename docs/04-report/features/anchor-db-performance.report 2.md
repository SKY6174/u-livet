# DB 연결 및 응답시간 최적화 완료

2026-09-19 · anchor-db-performance

DB 연동을 확인하고 미국 동부에서 도쿄 DB를 왕복하던 앱 서버를 도쿄로 이동했다. 공개 과정 카드 조회량과 상세 화면의 순차 대기도 줄였다.

## 운영 반영

- 사이트: https://uc-life.org
- 구현 커밋: `bd673990ce9a05fb7e1b88d5dad8ef7a9820ea6a`
- Git: `main` → `origin/main` 정상 push
- 배포: `dpl_36j4GtQ3RzoVUH1NZfoS6Af3hNmU`, Production READY, hnd1
- 운영 `/api/version` revision 일치, `/api/health` HTTP 200 healthy

## 성능 결과

같은 시간대에 이전·새 운영 배포를 번갈아 각각 9번 요청했다. 첫 요청을 제외한 8회 중앙값:

| 항목 | 이전 | 이후 | 감소 |
|---|---:|---:|---:|
| DB 상태 확인 | 692ms | 154ms | 78% |
| 홈페이지 | 532ms | 178.5ms | 66% |
| 과정 목록 | 528ms | 178ms | 66% |
| 로그인 화면 | 291.5ms | 149.5ms | 49% |

로컬 64개 과정의 목록 JSON도 UTF-8 기준 60,782 → 23,418바이트로 약 61% 줄었다. 홈은 DB에서 공개 과정 3건만 선택한다. 과정 상세는 정책·수납·강사를 병렬 조회하고, 정책은 해당 ID만 읽는다. Supabase 클라이언트는 React 서버 요청 범위에서 재사용한다.

## 검증

성능·업무·권한·배포 설정 검사 210개, lint와 타입 검사를 포함한 프로덕션 빌드가 통과했다. 운영 홈·과정 검색·관리자 로그인 이동을 브라우저로 확인했으며 새 배포의 최근 오류 로그는 0건이었다. DB 스키마·RLS·인증 정책은 변경하지 않았다.

빈 운영 DB의 비로그인 응답 측정이므로 대규모 데이터나 로그인 후 업무 저장 성능을 보장하지 않는다. 세부 측정법·p95·남은 과제는 [검증 보고서](../../03-analysis/anchor-db-performance.analysis.md)에 기록했다.

## 다시 측정하기

```sh
npm run check:db-performance -- https://uc-life.org
npm run test:db-performance
```

측정 도구는 GET만 실행하고 응답 본문·키·쿠키를 출력하지 않는다. 기본 9회이며 `DB_PERF_SAMPLES`로 3~30회를 지정할 수 있다. 공개 DB URL과 공개 키는 기존 환경변수 또는 `.env.local`에서 읽는다. 사이트 URL은 직접 지정한다. 보호된 배포는 필요한 경우 `DB_PERF_COOKIE`로 해당 사이트 접근 쿠키를 전달할 수 있다.

다음 점검은 실제 과정 등록 후 로그인 사용자·역할별 업무 응답시간과 데이터 증가에 따른 실행계획 확인이다.
