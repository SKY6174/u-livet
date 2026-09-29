# U-LiVET 브랜드 전환 계획

2026-09-29

## 목표

- 서비스 표기를 `U-LiVET`으로 통일한다. 영문 풀네임은 `Ulsan Lifelong Vocation Education & Training`이다.
- 제공된 파랑·초록 열린 책 심볼을 유지하고, `U-LiVET` 및 `Ulsan Lifelong T-VET` 문구가 들어간 SVG·PNG 로고를 제공한다.
- 기존 계정과 인증기 등록 정보를 계속 사용할 수 있게 한다.
- `u-livet.org`는 향후 도메인 전환 대상으로 기록한다. DNS 및 운영 URL 전환은 별도 작업으로 한다.

## 범위

- 사용자 화면, 메타데이터, 생성 문서의 현재 서비스 표기와 신규 MFA issuer.
- 공개 로고 자산과 헤더 표시.
- 배포 origin, OAuth callback, Supabase 설정, 내부 식별자, 과거 발행 문서 및 기존 MFA 이름은 유지한다.

## 확인

- 현재 화면 소스의 이전 표기 검색, SVG·PNG 육안 확인, lint·TypeScript·빌드.
