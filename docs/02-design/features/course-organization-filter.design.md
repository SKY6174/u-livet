# 과정 탐색 담당 기관 분류 설계

- `/courses` GET 폼의 첫 항목은 담당 기관 select(전체·앵커사업단·산학협력단)이다. `org=uc-anchor|uc-sanhak`, 잘못된 값·배열·누락은 전체로 정규화한다.
- `catalogHref`는 기관을 유지한다. 기관 필터와 기존 검색어·운영방식·운영상태 조건을 AND로 적용한다. 카드·목록 표시와 직접 URL 모두 같은 필터를 사용한다.
- 공개 `life_organizations`의 id·slug만 조회해 가이드의 org_id와 실제 기수의 org_id를 안정된 slug로 매핑한다. 이름·아카데미·고정 UUID로 기관을 추정하지 않는다. 미확인 기관은 전체에서만 표시한다.
- 기존 `life_course_introductions`의 반환값에 공개 기관 ID `org_id`만 추가한다. 반환 형식 변경을 위해 public wrapper·private function을 트랜잭션 안에서 재생성하고 원래 공개 조건·권한·빈 search_path를 그대로 유지한다. 과정·기관 데이터와 RLS를 수정하지 않는다.
- 추가 기수의 기존 가이드 수정 링크 조건은 유지한다. 분류용 organization_slug를 별도로 저장해 기관 분류가 편집 링크나 권한을 변경하지 않게 한다.
- 기관 조회 실패 시 부분 조회 경고를 표시하며 특정 기관을 추측하지 않는다.
- 검증: 기관별/미확인/복합 필터·URL·잘못된 값·가이드/추가 기수·실패 처리 검사, 공개 RPC의 org_id·기존 공개 경계 확인, lint/build, 데스크톱·모바일 및 운영 GET 검색·보기 전환·오류 점검.
