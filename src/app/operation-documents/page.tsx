import Link from "next/link";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { STATUS_LABELS } from "@/lib/operation-documents/model";
import { Empty, PageIntro } from "@/components/portal/ui";
type Row = {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  responsible: string | null;
  manager: boolean;
  plan_status: keyof typeof STATUS_LABELS | null;
  result_status: keyof typeof STATUS_LABELS | null;
};
export default async function Page() {
  await requireIdentity("/operation-documents");
  const { data, error } = await (
    await createServerSupabaseClient()
  ).rpc("life_operation_list");
  const courses = (data ?? []) as Row[];
  return (
    <div className="page-shell">
      <PageIntro eyebrow="COURSE DOCUMENTS" title="운영계획서 · 결과보고서">
        책임강사는 과정 내용을 작성하고, 담당자는 예산을 완성하여 최종
        제출합니다.
      </PageIntro>
      <div className="mb-7 flex flex-wrap gap-3">
        <a
          className="btn-secondary"
          href="/forms/operation-plan.pdf"
          target="_blank"
        >
          계획서 원본 양식
        </a>
        <a
          className="btn-secondary"
          href="/forms/operation-result.pdf"
          target="_blank"
        >
          결과보고서 원본 양식
        </a>
      </div>
      {error ? (
        <Empty title="문서 현황을 불러오지 못했습니다">
          추가 인증 상태를 확인하고 다시 시도해 주세요.
        </Empty>
      ) : !courses.length ? (
        <Empty title="아직 책임 과정이 지정되지 않았습니다">
          운영 담당자가 과정의 책임강사를 지정하면 이곳에서 작성할 수 있습니다.
        </Empty>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {courses.map((c) => (
            <article className="panel" key={c.id}>
              <h2 className="text-lg font-bold">{c.name}</h2>
              <p className="mt-2 text-sm text-slate-500">
                {c.starts_on} ~ {c.ends_on} · 책임강사{" "}
                {c.responsible || "미지정"}
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {(["plan", "result"] as const).map((kind) => (
                  <Link
                    className="rounded-xl border p-4 hover:border-teal-500 hover:bg-teal-50"
                    href={`/operation-documents/${c.id}/${kind}`}
                    key={kind}
                  >
                    <span className="block font-semibold">
                      {kind === "plan" ? "운영계획서" : "운영결과보고서"} →
                    </span>
                    <span className="mt-2 block text-sm text-teal-800">
                      {c[`${kind}_status`]
                        ? STATUS_LABELS[c[`${kind}_status`]!]
                        : "작성 시작"}
                    </span>
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
