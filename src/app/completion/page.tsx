import Link from "next/link";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { getWorkspaceOfferings } from "@/lib/portal/data";
import { PageIntro, Empty } from "@/components/portal/ui";
export default async function CompletionIndex() {
  const me = await requireIdentity("/completion");
  const orgs = me.roles
    .filter((r) => ["COURSE_MANAGER", "CERTIFIER"].includes(r.role))
    .map((r) => r.org_id);
  if (!orgs.length) notFound();
  const { offerings, unavailable: error } = await getWorkspaceOfferings("org_id", orgs);
  return (
    <div className="page-shell">
      <PageIntro eyebrow="COMPLETION REVIEW" title="수료 검토·승인">
        과정담당이 자료를 마감하고 후보를 산출하면, 별도 승인자가 근거를
        확인하여 확정합니다.
      </PageIntro>
      {error ? (
        <Empty title="과정 목록을 불러오지 못했습니다" />
      ) : !offerings.length ? (
        <Empty title="검토할 과정이 없습니다" />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {offerings.map((o) => (
            <Link
              key={o.id}
              className="panel hover:border-teal-700"
              href={`/completion/${o.id}`}
            >
              <span className="eyebrow">{o.year_label}</span>
              <h2 className="mt-2 text-lg font-semibold">{o.name}</h2>
              <p className="mt-3 text-sm text-teal-800">
                기준·출결·평가 검토 →
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
