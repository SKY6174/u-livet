# Supabase Preview 생성 결과

2026-09-19. `anchor-preview-environment` 완료: 별도 브랜치 생성·상태 확인. 전체 앱/인증 인수는 후속 작업.

| 항목 | 결과 |
|---|---|
| 조직 / 부모 | ANCHOR(Pro) / uc-life |
| 브랜치 | preview |
| Project ref | `bfqwntulxabfrimcypvx` |
| Branch ID | `b5c758c4-f87b-4749-8815-2b4d3b7e82fb` |
| 생성 시각 | 2026-09-19 07:21:18 KST |
| 최종 상태 | FUNCTIONS_DEPLOYED / ACTIVE_HEALTHY |
| 데이터 복사 | 없음. 회원·프로필·수강신청·Storage 객체 모두 0 |
| migration | 001~008, 총 8개 |
| Preview 비밀번호 | 최소 12자 적용. 문자 조합 null |

[Supabase Preview 열기](https://supabase.com/dashboard/project/bfqwntulxabfrimcypvx)

사용자가 시간당 USD 0.01344 및 사용량별 추가 비용을 확인한 뒤 생성을 진행했다. 브랜치 생성 도구는 한 번 호출했다. 생성된 ref와 부모 ref가 다른지 확인한 다음 새 Preview만 검사했다.

정확한 영문·숫자·특수문자 조건(대소문자 동시 요구 없음)을 Preview에 PATCH한 요청은 HTTP 400으로 거부됐다. 다시 읽어 값이 유지된 것을 확인한 후 최소 길이만 12자로 바꿨다. 원격 main은 기존 6자/조합 null이며 수정하지 않았다. 요청하신 전체 비밀번호 기준을 완성했다고 표시하지 않는다.

Preview의 001~008에는 기존 함수 보안 경고가 있다. 최신 life_ 스키마와 기존 API 권한 회수는 아직 적용하지 않았다. 보안 경고 세부 항목과 공식 조치 링크, 후속 순서는 [Preview 운영 기록](../../operations/supabase-preview.md)에 있다. 해당 작업과 인증 호환성 검증 후 앱을 연결해야 한다.

이번에 웹사이트를 Vercel에 게시하거나 main에 병합하지 않았다. 실제 계정 생성·메일 발송·MFA 변경·운영 데이터 복사는 없으며, .env.local은 읽거나 수정하지 않았다. 애플리케이션 소스 변경이 없어 기존 UI/빌드 검사를 반복하지 않고 실제 원격 생성 상태·catalog·설정 재조회로 확인했다.

[설계 대조](../../03-analysis/anchor-preview-environment.analysis.md): 확인 항목 10/10 수행. 원격 관측을 바탕으로 작성했으며 로컬 합성 검사 수와 혼합하지 않는다.
