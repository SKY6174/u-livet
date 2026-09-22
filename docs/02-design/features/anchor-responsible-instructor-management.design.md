# 책임강사 지정과 운영 문서 연결 — 상세설계

> 2026-09-22 · [계획](../../01-plan/features/anchor-responsible-instructor-management.plan.md) · [기존 문서 설계](anchor-operation-documents.design.md)

## 데이터 흐름

운영 설정 `/admin/offerings/[id]/manage#instructors`는 기존 `life_instructors(f)`에서 활성 강사와 기수 배정을, `life_operation_context(f)`에서 책임강사·revision·후보를 읽는다. 보관 과정에도 같은 영역을 표시한다. 강사를 먼저 기수에 배정한 뒤 후보 중 한 명을 고른다. 별도 Server Action은 UUID·revision 형식을 검사하고 기존 `life_operation_assign(f,p,expected_revision)`을 호출한다. 성공 시 운영관리·과정 목록·운영 문서 경로를 재검증한다. 충돌·권한·후보 오류는 입력 폼에 구체적으로 표시한다.

`/admin/courses`는 기존 `life_operation_list`에서 현재 책임강사 이름을 받아 각 과정 카드·목록에 표시하고 운영 설정/계획서/결과보고서 이동 경로를 제공한다. 목록 RPC 실패는 미지정으로 오인하지 않도록 확인 불가로 표시한다. 승인된 원본 계획서 강사 이름 텍스트는 후보를 만들어 내지 않는다.

## DB 무결성

기존 책임강사 테이블과 접근·저장·제출 권한을 재사용한다. 신규 마이그레이션에서 `life_operation_documents`의 INSERT/UPDATE 트리거는 책임강사가 정해져 있으면 `content.fields.professor`를 해당 `life_people.name`으로 맞춘다. 기존 `operation_assign`이 미제출 문서를 DRAFT로 바꾸며 update하므로 두 문서 표지명도 함께 갱신된다. 제출 완료 문서·불변 스냅샷은 지정만으로 바꾸지 않으며, 담당자가 사유와 함께 재개하면 새 책임강사명이 반영된다. 저장 시 강사가 강사명을 임의 변조해도 표지에는 지정된 사람의 이름이 남는다.

`life_private.assign_instructor`는 기수 배정 해제 시 현재 책임강사면 `RESPONSIBLE_INSTRUCTOR`로 거부한다. 다른 책임강사 지정 후 해제하도록 안내한다. 역할·기수 후보·낙관잠금 확인은 기존 RPC를 유지한다.

## 화면 및 파일

- `src/components/course-workspace/responsible-instructor-section.tsx`: 운영 설정의 강사 배정과 책임강사 선택·문서 링크.
- `src/app/admin/offerings/[id]/manage/page.tsx`: 보관 포함 공통 영역 렌더링.
- `src/app/admin/offerings/[id]/manage/actions.ts`: 입력 검사·RPC 호출·캐시 갱신.
- `src/app/admin/courses/page.tsx`, `src/components/course-workspace/operations-dashboard.tsx`: 현재 책임강사 표시와 작업 링크.
- `supabase/migrations/*_anchor_responsible_instructor_link.sql`: 표지명 동기화 및 책임강사 해제 보호.

## 검사

로컬 DB에서 지정 전후 양쪽 문서 표지명, 검토 상태 초기화, 제출 스냅샷 보존·재개, 임의 강사명 저장, 책임강사 기수 해제 거부, 미배정/타 기관/충돌 거부를 확인한다. Next lint/build 후 Preview에 적용·검증하고 Production 적용 후 감사 및 보안 진단, 배포 버전을 확인한다.
