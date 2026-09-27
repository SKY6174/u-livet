# 수강생 마이페이지 학습이력 흐름 개선 계획

2026-09-27

## 목표

- 온국민평생배움터의 학습이력 등록 → 연계동의 → 학습이력증명서 → 학습이력철 흐름을 수강생이 이해하고 다음 행동을 찾도록 한다.
- UC Life에 있는 본인 수강·수료 이력과 사업단 이수증 신청을 바로 찾게 한다.
- 국가 포털에서 수행해야 하는 기능을 UC Life가 제공하는 것처럼 오해하지 않게 한다.

## 범위

- `/mypage` 학습 기록 영역에 네 단계 안내와 실제 이동 링크를 제공한다.
- `/mypage/history`에 수강·수료 요약, 상태별 기록, 다음 행동을 표시한다.
- 기존 본인 조회 RPC와 증명 신청 경로를 재사용한다. 신규 DB나 외부 연동은 추가하지 않는다.

## 완료 기준

- 모바일과 데스크톱에서 4단계, 내부 수강이력, 사업단 이수증, 외부 국가 포털 경로가 명확하다.
- 조회 오류를 이력 0건으로 표시하지 않는다.
- 국가 포털의 회원가입·연계동의·공식 증명 발급은 외부 서비스에서 진행됨을 명시한다.
- lint, TypeScript, production build 및 수강생 화면의 주요 링크를 확인한다.

## 참고

- 온국민평생배움터: https://www.all.go.kr/mypage/viewMyDashborad.do (로그인 영역)
- 교육부 학습이력 안내: https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=340&boardSeq=106559&lev=0&m=020501&opType=N&page=7&s=moe
- 첨부된 4단계 안내 이미지
- 기존 설계: `anchor-student-learning.design.md`, `anchor-certificates.design.md`
