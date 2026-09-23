import { Download, FileClock, Search } from "lucide-react";
import { notFound } from "next/navigation";
import { PageIntro } from "@/components/portal/ui";
import { requireIdentity } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/workspace-navigation";
import { getAdminLearnerDocuments } from "@/lib/learner-document-workflow/data";
import {
  DOCUMENT_KIND_LABELS,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_TONES,
  NEXT_DOCUMENT_STATUSES,
  documentDate,
  type LearnerDocumentKind,
  type LearnerDocumentStatus,
} from "@/lib/learner-document-workflow/types";
import { updateLearnerDocumentStatus } from "./actions";

const field = "mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900";
const kindKeys = Object.keys(DOCUMENT_KIND_LABELS) as LearnerDocumentKind[];
const statusKeys = Object.keys(DOCUMENT_STATUS_LABELS) as LearnerDocumentStatus[];

export default async function AdminLearnerDocumentsPage({ searchParams }: {
  searchParams: Promise<{ kind?: string; status?: string; q?: string; notice?: string; error?: string }>;
}) {
  const me = await requireIdentity("/admin/learner-documents");
  if (!hasRole(me, "SYSTEM_ADMIN", "COURSE_MANAGER", "FINANCE")) notFound();
  const params = await searchParams;
  const kind = kindKeys.includes(params.kind as LearnerDocumentKind) ? params.kind as LearnerDocumentKind : null;
  const status = statusKeys.includes(params.status as LearnerDocumentStatus) ? params.status as LearnerDocumentStatus : null;
  const query = String(params.q ?? "").trim().slice(0, 100);
  const data = await getAdminLearnerDocuments({ kind, status, query });
  const requests = data?.requests ?? [];
  const hiddenFilters = <>
    <input type="hidden" name="filter_kind" value={kind ?? ""} />
    <input type="hidden" name="filter_status" value={status ?? ""} />
    <input type="hidden" name="filter_query" value={query} />
  </>;

  return <div className="page-shell space-y-7">
    <PageIntro eyebrow="LEARNER DOCUMENT DESK" title="수강생 서류 접수·처리">
      수강신청원서, 장학금 지급신청서, 수강료환불신청서의 원본과 처리 이력을 확인하고 수강생에게 진행 상태를 안내합니다.
    </PageIntro>
    {params.notice && <p role="status" className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">{params.notice}</p>}
    {params.error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{params.error}</p>}
    {!data ? <p role="alert" className="panel">자료를 불러오지 못했습니다. 담당 역할과 추가 인증 상태를 확인해 주세요.</p> : <>
      <section className="grid gap-3 sm:grid-cols-3" aria-label="서류 처리 요약">
        {[{label:"접수·검토",count:requests.filter(r => ["RECEIVED","REVIEWING"].includes(r.status)).length}, {label:"승인",count:requests.filter(r => r.status === "APPROVED").length}, {label:"완료·종결",count:requests.filter(r => ["COMPLETED","REJECTED","CANCELLED"].includes(r.status)).length}].map(item => <div key={item.label} className="panel"><p className="text-sm text-slate-600">{item.label}</p><p className="mt-2 text-3xl font-bold tabular-nums">{item.count.toLocaleString("ko-KR")}<span className="ml-1 text-sm font-medium text-slate-500">건</span></p></div>)}
      </section>
      <form method="get" className="panel grid items-end gap-4 md:grid-cols-[1fr_1fr_2fr_auto]">
        <label className="text-sm font-semibold">서류 종류<select className={field} name="kind" defaultValue={kind ?? ""}><option value="">전체</option>{kindKeys.map(value => <option value={value} key={value}>{DOCUMENT_KIND_LABELS[value]}</option>)}</select></label>
        <label className="text-sm font-semibold">처리 상태<select className={field} name="status" defaultValue={status ?? ""}><option value="">전체</option>{statusKeys.map(value => <option value={value} key={value}>{DOCUMENT_STATUS_LABELS[value]}</option>)}</select></label>
        <label className="text-sm font-semibold">과정명·신청자<input className={field} name="q" defaultValue={query} maxLength={100} placeholder="검색어 입력" /></label>
        <button className="btn-secondary inline-flex min-h-11 items-center justify-center gap-2" type="submit"><Search size={16} />조회</button>
      </form>
      <section aria-labelledby="document-queue-heading">
        <div className="mb-4 flex items-center justify-between"><h2 id="document-queue-heading" className="text-xl font-bold">접수 문서</h2><span className="text-sm text-slate-500">조회 {requests.length.toLocaleString("ko-KR")}건</span></div>
        {requests.length ? <div className="space-y-4">{requests.map(request => {
          const nextStatuses = NEXT_DOCUMENT_STATUSES[request.status] ?? [];
          return <article key={request.id} className="panel">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><p className="text-xs font-semibold tracking-wide text-teal-700">{DOCUMENT_KIND_LABELS[request.kind]}</p><h3 className="mt-1 text-lg font-bold">{request.course_name}</h3><p className="mt-1 text-sm text-slate-600">{request.applicant_name} · {request.phone_masked} · {documentDate(request.submitted_at)}</p></div>
              <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${DOCUMENT_STATUS_TONES[request.status]}`}>{DOCUMENT_STATUS_LABELS[request.status]}</span>
            </div>
            {request.kind === "REFUND" && <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">자동 산출 반환액 <strong>{Number(request.amount ?? 0).toLocaleString("ko-KR")}원</strong></p>}
            <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.8fr)]">
              <div>
                <h4 className="flex items-center gap-2 text-sm font-bold"><FileClock size={16} className="text-teal-700" />처리 이력</h4>
                <ol className="mt-3 space-y-3">{request.events.map(event => <li key={event.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"><p className="font-semibold">{DOCUMENT_STATUS_LABELS[event.to_status]} <span className="font-normal text-slate-500">· {documentDate(event.created_at)}{event.actor_name ? ` · ${event.actor_name}` : ""}</span></p><p className="mt-1 leading-6 text-slate-700">{event.note}</p></li>)}</ol>
                <a href={`/api/learner-documents/${request.id}/pdf`} target="_blank" rel="noreferrer" className="btn-secondary mt-4 inline-flex items-center gap-2"><Download size={16} />제출 원본 PDF</a>
              </div>
              <div>
                {nextStatuses.length ? <form action={updateLearnerDocumentStatus} className="rounded-xl border border-slate-200 p-4">
                  {hiddenFilters}<input type="hidden" name="request_id" value={request.id} /><input type="hidden" name="revision" value={request.revision} />
                  <label className="block text-sm font-semibold">다음 처리 단계<select name="next_status" required className={field} defaultValue=""><option value="" disabled>선택해 주세요</option>{nextStatuses.map(next => <option value={next} key={next}>{DOCUMENT_STATUS_LABELS[next]}</option>)}</select></label>
                  <label className="mt-4 block text-sm font-semibold">수강생 안내<textarea name="note" required maxLength={1000} rows={5} className={field} placeholder="검토 결과와 다음 절차를 구체적으로 입력해 주세요." /></label>
                  <button type="submit" className="btn-primary mt-4 w-full">상태 저장</button>
                  <p className="mt-2 text-xs leading-5 text-slate-500">안내 내용은 수강생 처리 현황에 즉시 공개됩니다. 상태 변경에는 최근 추가 인증이 필요합니다.</p>
                </form> : <div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">종결된 문서입니다. 제출 원본과 처리 이력은 계속 보관됩니다.</div>}
              </div>
            </div>
          </article>;
        })}</div> : <p className="panel text-sm text-slate-600">조건에 맞는 접수 문서가 없습니다.</p>}
      </section>
    </>}
  </div>;
}
