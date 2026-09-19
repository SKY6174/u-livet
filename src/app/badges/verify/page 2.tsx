import { PageIntro } from "@/components/portal/ui";
import { BadgeVerify } from "@/components/portal/badge-verify";
export const metadata = {
  title: "디지털배지 공유 검증",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function VerifyBadge() {
  return (
    <div className="page-shell">
      <PageIntro eyebrow="BADGE VERIFICATION" title="디지털배지 공유 검증">
        수강생이 공유한 코드로 발급 원장의 현재 상태를 확인합니다.
      </PageIntro>
      <BadgeVerify />
    </div>
  );
}
