# 운영 권한별 페이지 검증

운영 주소는 `https://u-livet.org`, Supabase 대상은 `uoebygejgglgiivzgyks`로 고정한다. 운영 검사와 임시 계정/기수 생성은 사용자에게 명시적으로 요청받았을 때만 실행한다. 실제 직원의 권한·지정 관리자·비밀번호는 바꾸지 않는다.

## 사전 검사

```sh
npm run test:production-origins
npm run test:production-origins -- --live --production
```

실제 배포 `/api/version`의 40자리 revision을 확인한다. CLI는 npm에 고정한 실행 파일을 사용한다. 운영 key는 메모리에서만 사용하며 계정 비밀번호·세션·브라우저 상태를 Git이나 로그에 넣지 않는다. 원본 학습자 검증 계정 manifest는 프로젝트·offering 및 `accounts`의 user/person/application/email, private password를 포함한 기존 비공개 파일이다.

## 임시 기수의 정상 상세까지 확인

```sh
node scripts/production-page-accounts.mjs setup --production --source=/absolute/path/fixture-accounts.private.json
node scripts/production-page-fixture.mjs setup --production
node scripts/production-page-accounts.mjs learner-stage --production
npm run test:production-pages -- --production --revision=EXPECTED_40_CHARACTER_REVISION --roles=learner,guest
node scripts/production-page-accounts.mjs administrator-stage --production
npm run test:production-pages -- --production --revision=EXPECTED_40_CHARACTER_REVISION --roles=instructor,administrator
node scripts/production-page-fixture.mjs responsible --production
npm run test:production-pages -- --production --revision=EXPECTED_40_CHARACTER_REVISION --roles=instructor '--route=/operation-documents/[id]/[kind],/operation-documents/[id]/[kind]/print'
```

전용 강사·관리자 Auth 계정 두 개를 생성하며 메일은 발송하지 않는다. 업무 권한 여섯 개는 기관 범위와 60분 만료를 갖는다. 관리자 계정을 학습자 단계에서 재사용하므로 다섯 권한을 잠시 만료시키고, 관리자 단계 전에 원래의 만료 시간 그대로 복구한다. 기존 사용자 권한은 바뀌지 않는다.

임시 기수는 DRAFT·무료·명시적 검증용이며 외부 모집에 공개되지 않는다. 한 명의 합성 수강 연결과 다른 신원의 담당 강사를 연결한다. 생성/삭제를 rollback 트랜잭션으로 먼저 검증하고 익명 catalog 접근이 차단되는지 확인한다. 학습자료 하나를 표시하되 읽음 표시·출석·성적·수료·증명·실제 결제는 실행하지 않는다.

각 역할은 모든 `src/app/**/page.tsx`를 방문한다. 정상 화면, 역할 거부, 로그인 이동, 실제 레코드가 없는 상태를 구분한다. 모바일 메뉴의 React 상태 변경과 데스크톱 렌더링을 확인한다. 문서 서류함은 session/context 응답과 파일 입력 UI까지 기다린다. 허용한 합성 서류 세션/조회 외의 POST·수정 요청은 차단하며, 업로드·AI 분석·발급 버튼을 누르지 않는다.

## 종료 및 실패 시 정리

테스트 명령이 실패해도 아래 두 정리를 실행한다. 삭제 guard가 실패하면 실제 데이터나 FK를 지우는 방식으로 우회하지 말고 manifest의 소유 ID를 확인한다.

```sh
node scripts/production-page-fixture.mjs cleanup --production
node scripts/production-page-accounts.mjs cleanup --production
```

기수의 기본 일곱 행과 추가한 담당 강사 지정이 모두 없어졌는지 확인하고 원래 테스트 manifest를 복구한다. 그 다음 두 임시 Auth 계정·문서 세션·부여한 권한을 제거하고 private password 사본을 폐기한다. 원래 학습자 계정과 업무 감사 이력은 유지한다. 중간에 중단했다면 정리 전까지 private manifest를 삭제하지 않는다.

`ops/evidence/production-role-pages`는 Git에서 제외된다. 여기에는 개인 화면이나 인증 정보를 공개하지 않는 결과 JSON과 정리 증빙을 보관한다. `/auth/complete-signup`은 native email 계정의 세션을 끝내므로 각 역할의 모든 병렬 조회가 끝난 뒤 실행한다. `--route=/learning/[id]`처럼 동적 경로 모듈을 선택할 때는 셸 glob 확장을 막도록 인수를 따옴표로 감싼다.

## 범위

지정 계정만 가능한 수동 등록·비밀번호 재설정 메일은 기존 지정자를 교체해 시험하지 않는다. 운영에 증명·배지·제안·성과보고 레코드가 없으면 누락/차단 상태를 기록하고 정상 발급 상세가 통과했다고 주장하지 않는다. 신규 업무 이력이나 공식 성과를 만들어 커버리지를 채우지 않는다.
