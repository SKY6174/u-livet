# 보관된 결과보고서 검토용 초안 반영 설계

2026-09-22 · `anchor-archived-result-draft-backfill`

## 데이터 흐름

일회성 관리 스크립트는 저장소 밖의 비공개 manifest에 과정 ID, 원본 PDF 경로, SHA-256, 시각 검토로 고른 이미지 번호를 받는다. Supabase Management API에서 해당 과정의 원본 파일·기존 집계·결과 양식 스키마·담당자 정보를 읽는다. 로컬 PDF 해시가 기존 집계 및 DB 보관 파일 해시와 같은지 확인하고, 결과 초안이 이미 있으면 중단한다. PDF XObject 이미지 가운데 선택한 번호만 JPEG로 축소해 원본 순서대로 보관한다. 이 번호는 로고·빈 마스크·비사진 자료가 섞이는 것을 막기 위해 contact sheet 시각 검토 후 manifest에 명시한다.

양식의 모든 필드 키는 DB의 `life_private.operation_schema('result')`에서 생성한다. 과정명·학년도·영역·기간·정원·현재 책임강사는 과정 기록을, 프로그램명·작성일·본문·성과·품질 개선·후속 조치는 기존 `life_course_reports` 집계를 사용한다. 집계의 `sourceReport.notes`는 원본 충돌을 보이도록 `improvementsNote`에 둔다. 개인별 명단과 예산·장학금·서명은 가져오지 않는다. 강의시간 충돌이 있는 원본이므로 `schedule`은 빈 표로 남기고 담당자 검토 대상으로 표시한다. 기본 사진 2칸은 비워 두고 추출한 사진을 `운영사진N`으로 추가한다. 날짜와 설명은 확인되지 않으면 비운다.

## 안전한 적용

기본 실행은 읽기와 검증만 수행한다. `--apply`일 때 SQL 트랜잭션에서 원본 SHA-256, 대상 과정, 기존 결과 초안 부재, DB의 `operation_content_valid`·`operation_budget_valid`를 다시 확인한 후 `DRAFT` 1건과 감사기록 1건을 삽입한다. 기존 `life_course_reports`·원본 PDF·제출 스냅샷은 수정하지 않는다. 스크립트와 manifest는 각자 구분하고, manifest·SQL 임시파일·이미지 출력은 Git에서 제외한다. 적용 후 과정별 필드 수, 사진 수, 상태, 원본 해시를 재조회한다.

## 검증

3개 PDF의 이미지 contact sheet와 선택 이미지 수를 검토한다. 로컬 해시가 DB의 출처 해시와 같아야 한다. 초안 생성 전 모든 JSON이 양식 크기 제한과 DB 검증 함수를 통과해야 한다. 적용 후 3개 과정은 초안이 존재하고 다른 과정의 결과 문서 수는 변하지 않아야 한다.
