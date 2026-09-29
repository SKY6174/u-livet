# U-LiVET 브랜드 표기 전환 계획

2026-09-29

## 목표

서비스 표기를 `U-LiVE`에서 `U-LiVET`로 바꾸고 영문 풀네임을 `Ulsan Lifelong Vocational Education & Training`으로 안내한다. 사용자가 제공한 투명 PNG 로고를 브랜드 자산으로 사용한다.

## 범위

- 현재 앱의 헤더, 푸터, 홈·소개·로그인, 페이지 제목과 안내 문구를 새 표기로 교체한다.
- 새로 생성하는 PDF의 파일명·producer, 인증 메일의 제목·본문, TOTP issuer를 교체한다.
- Supabase 운영 Auth 메일 템플릿도 로컬 소스와 일치시킨다.
- 과거 매뉴얼·보고서·설계 문서는 당시 기록으로 보존한다. `u-live.org`, Git 저장소, API 경로와 내부 식별자는 유지한다.

## 확인

- 사용자 노출 소스에서 이전 표기가 의도한 MFA 호환 코드 외에 남지 않는지 검색한다.
- TypeScript와 빌드, Preview·운영 화면, Supabase 운영 메일 설정을 확인한다.
