import { getLatestPrivacyPolicy } from "@/lib/portal/data";
import { Empty, PageIntro } from "@/components/portal/ui";
import { SupportContact } from "@/components/common/support-contact";
export const dynamic = "force-dynamic";

export default async function Privacy() {
  const policy = await getLatestPrivacyPolicy();
  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <PageIntro eyebrow="PRIVACY" title="개인정보처리 안내" />
      <SupportContact className="mb-6 rounded-xl bg-teal-50 p-5 text-teal-900" />
      {policy ? (
        <article className="panel mb-5">
          <h2 className="section-title">
            {policy.title} · {policy.version}
          </h2>
          <p className="whitespace-pre-wrap">{policy.body}</p>
        </article>
      ) : (
        <Empty title="개인정보처리방침을 준비하고 있습니다">
          운영기관의 담당자·수집 목적·항목·보유기간·위탁업체·권리행사 방법을
          확정한 후 게시합니다. 현재 신규 회원가입은 열리지 않습니다.
        </Empty>
      )}
    </div>
  );
}
