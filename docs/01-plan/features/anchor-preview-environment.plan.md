# anchor-preview-environment 계획

2026-09-19. 요청: 다음 작업 진행 및 Preview 브랜치 생성.

## 대상과 생성안

- Supabase ANCHOR(Pro) / uc-life, 부모 project ref `uoebygejgglgiivzgyks`.
- 브랜치 이름 `preview`, 독립 개발용 DB/Auth 환경, 기본 Micro, 부모와 같은 리전.
- 운영 데이터 복사 없음. main 병합·Git push·운영 설정 변경 없음.
- 생성 전 중복 여부를 확인하고, 생성 후 독립 ref와 부모 연결·상태·마이그레이션 결과를 확인한다.

## 비용과 권한

사용자가 브랜치 생성을 명시적으로 요청했다. Supabase get_cost의 ANCHOR 조직 조회는 시간당 USD 0.01344를 반환했다. 도구가 생성 전 비용 설명 및 이해 확인을 요구하므로 해당 확인 후 실행한다. 30일 720시간 연속 실행 시 compute 약 USD 9.68이며 스토리지·트래픽 등 실제 사용량 비용은 별도다.

## 완료 기준

브랜치 생성 및 상태 확인, 비밀값 없는 연결 식별자 기록, 복제된 schema/Auth 설정과 미적용 작업 범위 기록. 웹사이트 Preview 게시나 전체 운영 인증 인수와 구분한다. 확인 대기·공급자 오류가 있으면 완료로 표시하지 않는다.

관련 설계: `docs/operations/supabase-migration-retry.md`, `docs/operations/auth-deployment-decision.md`.
