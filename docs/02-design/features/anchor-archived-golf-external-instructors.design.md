# 종료 파크골프 과정 교외 강사 승인·결과 반영 설계

2026-09-23 · anchor-archived-golf-external-instructors

단일 트랜잭션 데이터 마이그레이션으로 처리한다. 대상 과정 UUID, ARCHIVED 상태, 결과보고서 DRAFT/revision 2, 빈 schedule, 원본 PDF 해시를 모두 잠그고 확인한다. 조경호·우철호의 기존 동명이인이 없음을 전제로 결정적 UUID의 `life_people`을 만들고, `instructor_pool` ACTIVE/EXTERNAL, `account_classifications` EXTERNAL, INSTRUCTOR 역할, 대상 과정 강사 배정을 생성한다. 교외 강사 필수서류 설정은 유지한다.

결과보고서 schedule에는 원본 6쪽의 11개 행을 `date/topic/instructor/hours/assistant/assistantHours/location` 구조로 저장한다. 날짜·시간과 교육시간이 어긋나는 행도 원본 기재값을 보존한다. 변경 콘텐츠를 서버 검증 함수에 통과시킨 뒤 revision을 증가시키고, 강사별 승인·강좌 배정 및 보고서 이관 감사 이벤트를 남긴다.
