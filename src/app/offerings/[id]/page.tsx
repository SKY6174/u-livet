import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCourseIntroduction,
  getPolicies,
  dateTime,
  modeLabel,
} from "@/lib/portal/data";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { FinanceConfig } from "@/lib/finance/types";
import { PageIntro } from "@/components/portal/ui";
import { DocumentPopup } from "@/components/instructor-documents/document-popup";
import { applicationDocumentHref } from "@/lib/learner-documents/model";
import { parseCourseCurriculum } from "@/lib/course-workspace/curriculum";
export default async function OfferingPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const o = await getCourseIntroduction(params.id);
  if (!o) notFound();
  const curriculum = parseCourseCurriculum(o.curriculum);
  const db = await createServerSupabaseClient();
  const [policies, enrollmentPolicies, { data: offeringPolicy }, { data: financeData }, { data: instructorData }] =
    await Promise.all([
      getPolicies(undefined, o.completion_policy_id),
      getPolicies("ENROLLMENT"),
      db.from("life_offerings").select("enrollment_policy_id").eq("id", o.id).maybeSingle(),
      o.status === "ARCHIVED" ? { data: null } : db.rpc("life_offering_finance", { f: o.id }),
      o.status === "ARCHIVED" ? { data: [] } : db.rpc("life_public_instructors", { f: o.id }),
    ]);
  const completion = policies.find((p) => p.id === o.completion_policy_id);
  const enrollment = enrollmentPolicies.find((p) => p.id === offeringPolicy?.enrollment_policy_id);
  const finance = financeData as FinanceConfig | null;
  const instructors = (instructorData ?? []) as {
    name: string;
    specialty: string;
    introduction: string;
  }[];
  const open =
    o.status === "PUBLISHED" &&
    !!o.apply_from && !!o.apply_until &&
    Date.now() >= Date.parse(o.apply_from) &&
    Date.now() < Date.parse(o.apply_until);
  return (
    <div className="page-shell">
      <PageIntro eyebrow={`${o.academy} · ${o.year_label}`} title={o.name}>
        {o.summary}
      </PageIntro>
      {o.status === "ARCHIVED" && (
        <p className="notice mb-6">운영이 완료된 과정입니다. 교육내용을 소개하며 현재 수강신청을 받지 않습니다.</p>
      )}
      <div className="grid items-start gap-8 lg:grid-cols-[1fr_330px]">
        <div className="order-2 min-w-0 space-y-6 lg:order-1">
          <section className="panel">
            <h2 className="section-title">교육내용</h2>
            <p className="whitespace-pre-wrap">{curriculum.content}</p>
          </section>
          {curriculum.audience && <section className="panel">
            <h2 className="section-title">교육대상</h2>
            <p className="whitespace-pre-wrap">{curriculum.audience}</p>
          </section>}
          {curriculum.preparation && <section className="panel">
            <h2 className="section-title">준비사항</h2>
            <p className="whitespace-pre-wrap">{curriculum.preparation}</p>
          </section>}
          {!!instructors.length && (
            <section className="panel">
              <h2 className="section-title">함께하는 강사</h2>
              <div className="space-y-5">
                {instructors.map((teacher, i) => (
                  <article key={i}>
                    <h3 className="font-bold">{teacher.name}</h3>
                    <p className="mt-1 text-sm text-teal-800">
                      {teacher.specialty}
                    </p>
                    <p className="mt-3 whitespace-pre-wrap">
                      {teacher.introduction}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          )}
          <section className="panel">
            <h2 className="section-title">수료 안내</h2>
            {completion && <p className="mb-2 text-sm text-slate-500">{completion.title} · {completion.version}</p>}
            <p className="whitespace-pre-wrap">
              {completion?.body ?? "수료기준을 확인 중입니다."}
            </p>
          </section>
          {enrollment && (
            <section className="panel">
              <h2 className="section-title">모집·개인정보 수집·이용 안내</h2>
              <p className="mb-2 text-sm text-slate-500">{enrollment.title} · {enrollment.version}</p>
              <p className="whitespace-pre-wrap">{enrollment.body}</p>
            </section>
          )}
        </div>
        <aside className="panel order-1 space-y-5 lg:order-2" aria-label="신청에 필요한 정보">
          <h2 className="section-title">수강신청 안내</h2>
          <dl className="space-y-4 text-base">
            {[
              ["교육기간", `${o.starts_on} ~ ${o.ends_on}`],
              [
                "접수기간",
                o.status === "ARCHIVED" ? "접수 종료" : `${dateTime(o.apply_from)} ~ ${dateTime(o.apply_until)}`,
              ],
              ["운영방식", modeLabel[o.mode]],
              ["교육장소", o.location],
              ["모집정원", `${o.capacity}명`],
              [
                "선발방식",
                o.selection_method === null ? "원본 미기재" : o.selection_method === "REVIEW"
                  ? "신청 후 심사"
                  : "선착순 · 정원 초과 시 대기",
              ],
              [
                "수강료",
                o.tuition === null ? "원본 미기재" : o.tuition === 0
                  ? "무료"
                  : `${o.tuition.toLocaleString("ko-KR")}원`,
              ],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-slate-500">{k}</dt>
                <dd className="mt-1 whitespace-pre-line font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          {finance && (
            <details>
              <summary className="cursor-pointer font-semibold">
                수납·환불 안내
              </summary>
              <p className="mt-3 whitespace-pre-wrap text-sm">{finance.body}</p>
            </details>
          )}
          <DocumentPopup href={applicationDocumentHref(o.id)} windowName="learner-documents" className="btn-primary w-full justify-center">수강신청원서 작성</DocumentPopup>
          {open ? (
            <Link
              href={`/offerings/${o.id}/apply`}
              className="btn-secondary block text-center"
            >
              수강신청 안내 확인
            </Link>
          ) : (
            <p className="notice">{o.status === "ARCHIVED" ? "운영이 완료된 과정입니다." : "현재 접수 기간이 아닙니다."}</p>
          )}
        </aside>
      </div>
    </div>
  );
}
