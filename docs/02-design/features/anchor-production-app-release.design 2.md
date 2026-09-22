# Production 앱 배포 설계

2026-09-19 · `anchor-production-app-release`

## 통합 및 배포

1. 원격 main/preview를 새로 조회하고 git merge-tree로 충돌과 병합 결과를 확인한다.
2. 병합 결과 코드가 통합 검증한 Preview와 같음을 확인하고 관련 회귀·lint·TypeScript 검사를 수행한다.
3. 검증 대상 head SHA를 고정해 preview→main PR을 생성하고 첨부한다. 기존 공개한 배포·DB 검증 근거를 설명에 포함한다.
4. PR의 검사 상태와 병합 가능 여부를 확인하고 일반 merge로 통합한다. force push나 보호 우회는 사용하지 않는다.
5. Git 연동 Production 배포가 해당 merge commit을 새로 빌드하고 READY가 되는지 확인한다.

## Preview 자동 검사 연결

- 기존 Supabase Preview `bfqwntulxabfrimcypvx`를 Git `preview` 브랜치에 연결한다.
- 장기 staging을 유지하도록 기존 브랜치를 persistent로 설정한다. 새 DB 생성이나 재설정은 하지 않는다.
- PR 생성 시 provision 실패 후 연결 누락을 확인했다. 연결 수정과 문서 커밋 후 Supabase 검사를 다시 확인한다.
- persistent/main에 대응하는 `remotes` 설정이 없으므로 자동 배포가 Auth 설정을 변경하지 않는지 배포 전후 설정 해시로 검증한다.
- 공식 근거: [Branch configuration](https://supabase.com/docs/guides/deployment/branching/configuration), [GitHub integration](https://supabase.com/docs/guides/deployment/branching/github-integration).

## 인수 및 복구

- 운영 `/api/version`: merge revision, environment=production, managed-cloud-v1, reviewOnly=false.
- Production 빌드 구성 검사에서 운영 origin/ref 분리 확인. 실제 브라우저 로그인 설정도 운영 Supabase를 가리키는지 확인한다.
- 홈·로그인·교육과정·관리 경로의 인증 이동, 브라우저 콘솔, 새 배포의 5xx 로그를 점검한다.
- 운영 인증 업무 시험은 실제 계정 정보를 임의 변경하지 않으며 후속 인수로 구분한다.
- 빌드 실패 시 이전 운영 배포가 계속 서비스되는지 확인한다. 새 배포에 장애가 있으면 검증된 이전 Production 배포로 복귀하고 원인을 수정한다. DB를 자동으로 되돌리지 않는다.
- 결과 문서와 PR 링크를 남기고 실제 배포 revision을 명시한다.
