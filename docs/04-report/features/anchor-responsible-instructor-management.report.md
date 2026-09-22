# 책임강사 지정과 운영 문서 연결 — 완료 보고

> 2026-09-22 · [설계](../../02-design/features/anchor-responsible-instructor-management.design.md) · [검증](../../03-analysis/anchor-responsible-instructor-management.analysis.md)

운영 담당자는 과정 운영관리에서 승인된 강사를 기수에 배정하고 책임강사를 지정할 수 있다. 지정된 계정에 해당 기수의 운영계획서·운영결과보고서 작성 권한이 연결되며, 두 미제출 문서의 표지명에도 동기화된다. 운영관리와 2026 과정 목록에는 현재 책임강사와 문서 이동 경로가 표시된다. 제출 완료 스냅샷은 보존하고 책임강사의 기수 배정 해제를 막는다.

검증: 로컬 Supabase 통합 검사 통과, Next lint/build 통과, 일반/보관 과정 관리 화면과 지정 폼 브라우저 확인. Preview 및 Production에 `20260922095141_anchor_responsible_instructor_link.sql` 적용 완료, 양쪽 Supabase 보안 진단 경고 없음.

실제 강사 지정은 승인된 강사 계정이 등록되고 해당 기수에 배정된 다음 운영 담당자가 수행한다. 기존 첨부 PDF의 이름만으로 계정을 연결하거나 책임강사를 추정하지 않았다.
