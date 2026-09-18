import { PageIntro } from "@/components/portal/ui";
import { VerifyForm } from "@/components/portal/verify-form";
export const metadata = {
  title: "증명 발급 상태 확인",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function Verify() {
  return (
    <div className="page-shell">
      <PageIntro eyebrow="CREDENTIAL VERIFICATION" title="증명서 진위확인">
        QR 검증 코드로 발급·취소·정정 상태를 확인합니다. 공개 조회에는 최소
        정보만 표시됩니다.
      </PageIntro>
      <VerifyForm />
    </div>
  );
}
