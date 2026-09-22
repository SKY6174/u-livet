# anchor-preview-environment 설계 대조

2026-09-19. 이번 범위는 독립 Preview 생성·상태 확인·인증 설정 지원 여부 확인이며, 전체 플랫폼 배포가 아니다.

| 설계 항목 | 실제 결과 |
|---|---|
| 대상/요금제/비용 확인 | ANCHOR Pro, uc-life 확인. 비용 안내 후 사용자가 생성 진행 선택 |
| 한 번만 생성 | preview 생성 1회. 독립 ref `bfqwntulxabfrimcypvx` |
| 부모 분리 | parent=`uoebygejgglgiivzgyks`, is_default=false 확인 |
| 상태 확인 | FUNCTIONS_DEPLOYED / ACTIVE_HEALTHY |
| 데이터 복사 방지 | with_data=false, 회원·프로필·수강신청·Storage 객체 각각 0 |
| 실제 구조 확인 | 이력 001~008, public 19개, life_ 0개, 정책 41개 |
| 인증/보안 관측 | 의존 컬럼 19개, 트리거 4개 미설치, Advisor 경고와 설정 차이 기록 |
| 비밀번호 지원 확인 | 정확한 조합 PATCH 400 → 값 유지 확인. 최소 길이만 PATCH 200 → 12자 재조회 확인 |
| 변경 범위 | 부모 Auth GET에서 6/null 유지. 운영 migration·merge·push·사용자 생성 없음 |
| 비밀정보 보호 | 키/비밀번호/전체 Auth 응답 미보관, .env.local 미접근 |

10/10 설계 확인 항목 수행. 수동 대조 100%는 브랜치 준비 범위에 한정한다. 인증 정책의 문자 조합 충족률이나 전체 배포 완료율이 아니다. 앱 연결 전 최신 migration과 권한 회수, native 인증 지원 및 SMTP/CAPTCHA 시험이 필요하다.

get_project(branch ref)는 NotFound를 반환했다. list_branches, list_migrations, SQL, Auth GET/PATCH가 같은 ref에서 정상 응답하여 브랜치 상태를 별도로 검증했다. 기존 경고를 수정했다고 주장하지 않는다.
