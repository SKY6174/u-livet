# 수강생 제출 PDF 운영 자산 수정 보고서

> Date: 2026-09-23
> Feature: `anchor-learner-document-production-assets`
> Match rate: 100%

## 결과

운영 서버 함수가 수강생 PDF 원본과 한글 글꼴을 포함하도록 Next.js 파일 추적 설정을 수정했다. `입력완료`는 배포 함수 안의 원본 양식으로 PDF 1.7을 생성해 기존 민원 DB에 제출할 수 있다. 예상하지 못한 파일 시스템 오류는 일반 안내로 변환되어 `/var/task` 같은 내부 경로가 화면에 노출되지 않는다.

## 검증

| 검사 | 결과 |
|---|---|
| production build | PASS |
| 서버 NFT trace 필수 자산 5개 | PASS |
| 세 서식 PDF 1.7 회귀 | PASS |
| 제출·파일·상태 이력 DB 통합 | PASS |
| TypeScript·ESLint·diff check | PASS |

DB migration은 없다. 기존 제출 RPC와 PDF SHA-256 검증을 그대로 사용한다.
