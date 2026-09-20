# 소제목 자간 축소 검증

- 공통 전역 CSS에 label 0.05em / compact 0.025em 토큰과 유틸리티를 정의했다.
- `.eyebrow`를 사용하는 기존 화면과 향후 `PageIntro` 기반 화면에 기본 규칙이 적용된다. 개인 홈·수강 절차·과정 관리 라벨도 같은 토큰을 사용한다.
- 공통 화면명세에 새 메뉴·화면의 소제목 자간 규칙을 기록했다.
- 변경 전 `/about` 12px 영문 소제목 자간 1.2px, 변경 후 0.6px. 글자 크기 12px 및 굵기 700 유지.
- `/about`, `/auth/login`, `/terms`, `/courses`, `/privacy`의 소제목 0.6px 확인. 수강 단계 번호는 14px 글자에서 0.7px로 확인했다.
- 모바일 320px에서 자간 동일 적용 및 가로 넘침 없음. 인증번호 입력은 기존 tracking-widest 유지.
- lint, git diff --check, 격리된 Next production build/타입 검사 통과.
- main/preview push 후 두 배포의 빌드·현재 revision·CSS 토큰 반영을 확인한다.
