# anchor-preview-environment 설계

2026-09-19. 계획: `docs/01-plan/features/anchor-preview-environment.plan.md`.

1. 비용 이해 확인 후 Supabase create_branch를 `name=preview`, `project_id=uoebygejgglgiivzgyks`로 한 번 호출한다. 기본 데이터 없는 개발 브랜치를 사용한다.
2. 호출 성공/불확실 응답 모두 list_branches로 존재를 재확인한다. 결과가 불분명하다고 새 브랜치를 반복 생성하지 않는다.
3. 새 project_ref가 부모와 다르고 parent_project_ref가 부모와 일치하는지 검증한다. 이 조건을 확인하기 전 새 ref 대상 작업을 하지 않는다.
4. 상태 전환을 확인하고 실패하면 branch action의 오류 관련 로그만 조사한다. 자동 병합·reset·이력 repair를 하지 않는다.
5. 활성화 후 catalog·migration 이력 및 제한된 Auth 설정을 읽어 복제 범위를 기록한다. 키/비밀번호·전체 Auth config·회원 행은 출력하지 않는다.
6. 부모 설정을 수정하지 않는다. 로컬 .env.local을 읽거나 변경하지 않는다. 브랜치 생성 자체가 로컬 수정본 전체의 적용을 뜻하지 않는다.
7. 원격 권한이 부여된 기존 MCP 연결을 우선 사용한다. 지원하지 않는 확인은 기존 CLI/공식 Management API의 읽기 요청을 사용한다.

## 독립 Preview의 비밀번호 설정 확인

사용자가 확정한 비밀번호 요구사항에 따라, 생성·대상 분리·회원 0건 확인 후 새 Preview에만 정확한 최소 12자/영문 한 집합·숫자·특수문자 정책을 PATCH하여 지원 여부를 확인한다. 거부되면 HTTP 상태와 설정 재조회를 기록하고, 지원되는 최소 길이 12자만 적용한다. 이 부분 적용을 전체 정책 충족으로 표시하지 않는다. CAPTCHA/SMTP 비밀값을 임의로 만들지 않고 부모 Auth 설정은 변경하지 않는다.

비밀번호 조건은 유지한다. 정확한 native 정책과 관리형 Auth 내부 트리거 지원이 미확정이면 신규 Preview가 준비돼도 인증 인수 미완료로 기록한다. 웹사이트 URL은 별도 Vercel 배포가 완료되기 전 만들어졌다고 표시하지 않는다.
