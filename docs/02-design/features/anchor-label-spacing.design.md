# 소제목 자간 축소 설계

- 전역 CSS `:root`에 `--tracking-label: 0.05em`, `--tracking-label-compact: 0.025em`을 정의하고 `@layer utilities`의 `tracking-label` / `tracking-label-compact`에서 참조한다. 공통 값은 CSS에서 한 번만 관리한다.
- `.eyebrow`는 `tracking-widest`(0.1em) 대신 `tracking-label`(0.05em)을 적용한다. 12px 소제목의 자간은 1.2px에서 0.6px가 된다.
- 개인 홈 영문 소제목과 수강안내 단계 번호도 `tracking-label`로 변경한다.
- 과정 관리 화면의 작은 안내 라벨은 기존 `tracking-wider`(0.05em)에서 `tracking-label-compact`(0.025em)로 줄인다.
- 새 화면은 `PageIntro`/`.eyebrow`를 우선 사용하며 별도 색상·크기를 쓰는 라벨은 `tracking-label`을 사용한다. 숫자 코드 입력 등 기능적 자간은 별도 유지한다.
- 사용자 요청은 추가 letter-spacing 축소이며 폰트 자체의 글자 폭, 글꼴·크기·굵기·줄간격 및 메뉴 버튼 간 gap을 변경하지 않는다.
- `/about`, `/auth/login`, `/terms`, `/courses`, `/privacy`의 계산된 스타일 확인. 생성 CSS의 두 토큰과 320px 넘침 여부를 확인한다.
