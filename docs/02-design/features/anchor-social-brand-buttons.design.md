# 소셜 로그인 브랜드 버튼 설계

- SocialLogin의 화면 표시만 변경한다. form action/name/value, 대상, 준비 중 비활성화, 진행/오류 안내는 유지한다.
- Google: 공식 Dark 테마 #131314 / 테두리 #8E918F / 글자 #E3E3E3와 최신 컬러 G. 카카오: #FEE500와 검정 말풍선. 네이버: 최신 공식 #03A94D와 흰 N/레이블.
- 공식 다운로드 원본 PNG를 로컬 public/images/auth에 보관한다. 원본을 수정하지 않고 고정 CSS 뷰포트로 심볼 영역만 표시해 외부 이미지 요청과 로고 변형을 피한다.
- 로고 28px 영역, 20px 굵은 글자, 64px 이상 버튼과 키보드 초점 표시. 준비 중 배지는 좁은 화면에서 줄바꿈한다.
- 로고는 alt="" 및 aria-hidden으로 중복 낭독을 막고 실제 버튼 텍스트를 유지한다.
- 기존 로그인 검증과 lint/typecheck, 320px/390px/desktop 렌더링 및 키보드 초점을 확인한다. 추가 DB/인증 설정은 없다.
- 공식 출처: https://developers.google.com/identity/branding-guidelines / https://developers.kakao.com/docs/ko/kakaologin/design-guide / https://developers.naver.com/docs/login/bi/bi.md
