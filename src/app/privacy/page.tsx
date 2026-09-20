import { getPolicies } from "@/lib/portal/data";
import { Empty, PageIntro } from "@/components/portal/ui";
import { SupportContact } from "@/components/common/support-contact";
import { currentContactPolicies } from "@/lib/portal/contact-policy-versions";
export default async function Privacy() {
  const policies = currentContactPolicies(await getPolicies("ACCOUNT_PRIVACY"));
  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <PageIntro eyebrow="PRIVACY" title="개인정보처리 안내" />
      <SupportContact className="mb-6 rounded-xl bg-teal-50 p-5 text-teal-900" />
      {policies.length ? (
        policies.map((p) => (
          <article key={p.id} className="panel mb-5">
            <h2 className="section-title">
              {p.title} · {p.version}
            </h2>
            <p className="whitespace-pre-wrap">{p.body}</p>
          </article>
        ))
      ) : (
        <Empty title="개인정보처리방침을 준비하고 있습니다">
          운영기관의 담당자·수집 목적·항목·보유기간·위탁업체·권리행사 방법을
          확정한 후 게시합니다. 현재 신규 회원가입은 열리지 않습니다.
        </Empty>
      )}
    </div>
  );
}
