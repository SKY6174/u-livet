# DB 개설 과정만 원서에 사용: 설계

2026-10-07 · application-document-db-courses

## 목록 및 선택

- `/mypage/documents`의 카탈로그에서 offeringId가 유효한 UUID인 항목만 클라이언트에 전달한다.
- DB 목록 조회 실패 시 선택 목록을 비우고 재시도 안내를 표시한다. 빈 DB 결과와 조회 실패를 구분한다.
- 등록된 개설 기수에 연결된 공개 안내는 모집 준비 단계에서도 기존처럼 원서를 작성할 수 있다.
- 원서 과정 입력을 select로 바꾸고 offering ID를 값으로 사용한다. 같은 과정명의 기수는 교육기간으로 구분한다.
- 과정명을 입력해 ID를 추정하지 않는다. 선택된 ID로 이름·수강료를 설정한다.
- 소개 페이지의 guide slug/개설 ID prefill은 해당 항목이 목록에 있을 때만 적용한다.

## 제출 경계

- 모델은 APPLICATION의 유효한 offering ID를 필수로 요구하므로 PDF 다운로드와 제출에 같은 선택 기준을 적용한다.
- 서버 액션은 빈 ID/형식 오류를 DB/PDF 생성 전에 거부하고 실제 공개 카탈로그 또는 공개 안내에 연결된 기수를 검증한다.
- 클라이언트의 과정명은 신뢰하지 않고 기존 서버 조회 결과로 덮어쓴다.
- 기존 private submit wrapper를 교체하여 신규 APPLICATION은 명시적 ID를 요구한다.
- DB는 실제 life_offerings에 존재하며 life_catalog에 공개되거나 published guide가 연결된 기수인지 검사한다.
- 기존 request_key의 재시도는 원래 offering_id를 유지하고 기존 base 함수가 충돌을 검증한다. 과거 미연결 문서 재시도도 새 문서를 만들지 않는다.
- 권한/SECURITY DEFINER 경계/search_path, 직접 테이블 접근 거부, PDF 검증 및 장학/환불 자격은 기존대로 유지한다.

## 검증 및 릴리스

- 합성 목록의 미연결 안내 제외, 같은 이름의 다른 기수 선택, 빈 목록/조회 실패 및 변조 ID 제출을 검사한다.
- 전용 uc-life-issues 로컬 DB에서 유효한 개설 기수 접수, 누락·가짜·비공개 기수 거부, 원서 재시도 및 과거 미연결 재시도를 검증한다.
- 브라우저에서 로그인→원서 선택→PDF→제출→DB offering_id와 과정명 저장을 확인한다.
- 기존 원서 경계 검사와 lint/build를 실행하고 운영 함수 적용 전후 정의·권한을 확인한다.
- 검증한 변경만 push/PR/merge하여 Vercel Git 배포의 정확한 main SHA와 운영 응답을 확인한다.
