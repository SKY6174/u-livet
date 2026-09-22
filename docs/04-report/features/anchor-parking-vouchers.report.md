# 무료 주차권 신청·승인·사용대장 완료 보고

> 2026-09-22 · `anchor-parking-vouchers` · application commit `21001b7`

수강생과 교외강사는 자신의 페이지에서 과정 교육일의 무료 주차권을 요청하고 상태를 확인한다. 운영진은 `/admin/parking`에서 과정 담당 센터와 실물 재고를 등록한다. RCC 이연향, ECC 이은주, AID-X 임은애의 확인된 본인 계정과 직원 역할·최근 MFA 인증만 해당 센터 신청을 승인할 수 있다. 승인 시 센터 재고가 같은 DB 트랜잭션에서 차감되며 발급 당시 남은 매수와 확인자가 보존된다. 원본 양식의 8개 열을 A4 인쇄 화면에 재현했다.

검증: 로컬 인증 계정으로 신청 자격, 교내강사·타인 차단, 지정 승인자, 중복 방지, 재고 부족, 반려·취소, 직접 테이블 읽기 차단을 확인했다. Next.js 린트와 빌드 통과. 학습자 신청을 실제 브라우저에서 제출해 DB에 `PENDING`으로 쌓이는 것을 확인했고, 관리자 인쇄물을 A4 PDF로 렌더링해 1쪽 표와 열 배치를 확인했다. Preview `bfqwntulxabfrimcypvx`와 Production `uoebygejgglgiivzgyks`에 `20260922084420`, `20260922085739` 마이그레이션을 적용했다. 두 환경의 Supabase Security Advisor는 새 WARN/ERROR가 없었다. 적용 직후 센터 3개, 신청·재고 0건, 테이블 RLS 활성 상태를 확인했다.

운영 준비: 세 승인 담당자 계정이 아직 등록되지 않았다. 각 담당자가 계정을 만든 뒤 해당 조직의 `COURSE_MANAGER` 역할과 MFA를 설정해야 승인을 실행할 수 있다. 첫 신청 전에 운영진이 과정의 센터를 지정하고 실물 주차권 재고를 입고해야 한다. 이름만 같은 계정이나 다른 관리자의 대리 승인은 허용하지 않는다.

[설계](../../02-design/features/anchor-parking-vouchers.design.md) · [차이 분석](../../03-analysis/anchor-parking-vouchers.analysis.md)
