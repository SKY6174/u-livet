import Link from "next/link";
import { BellRing, ChevronRight, CircleAlert } from "lucide-react";
import { AdminLiveRefresh } from "@/components/admin/admin-live-refresh";
import {
  DOCUMENT_KIND_LABELS,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_TONES,
  documentDate,
  isOpenLearnerDocument,
  type LearnerDocumentAdminContext,
  type LearnerDocumentKind,
  type LearnerDocumentRequest,
} from "@/lib/learner-document-workflow/types";

const REQUEST_KINDS: LearnerDocumentKind[] = ["APPLICATION", "SCHOLARSHIP", "REFUND"];

export function LearnerRequestAlerts({ data }: { data: LearnerDocumentAdminContext | null }) {
  if (!data) {
    return (
      <section className="mb-10 rounded-2xl border border-amber-200 bg-amber-50 p-5" aria-labelledby="learner-request-alerts">
        <div className="flex items-start gap-3">
          <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <h2 id="learner-request-alerts" className="font-bold text-amber-950">수강생 요청 알림을 불러오지 못했습니다</h2>
            <p className="mt-1 text-sm leading-6 text-amber-900">추가 인증 상태를 확인한 뒤 수강생 서류함에서 다시 확인해 주세요.</p>
            <Link href="/admin/learner-documents" className="mt-3 inline-flex text-sm font-semibold text-amber-950">수강생 서류함 열기 →</Link>
          </div>
        </div>
      </section>
    );
  }

  const openRequests = data.requests.filter(isOpenLearnerDocument);
  const recentRequests = openRequests.slice(0, 5);

  return (
    <section className="mb-10 overflow-hidden rounded-2xl border border-teal-200 bg-white shadow-sm" aria-labelledby="learner-request-alerts">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-teal-100 bg-gradient-to-r from-teal-50 to-cyan-50 px-5 py-4 md:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-800 text-white"><BellRing aria-hidden="true" className="h-5 w-5" /></span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="learner-request-alerts" className="text-lg font-bold text-slate-900">실시간 수강생 요청</h2>
              <span className="rounded-full bg-rose-600 px-2.5 py-1 text-xs font-bold text-white">미처리 {openRequests.length.toLocaleString("ko-KR")}건</span>
            </div>
            <p className="mt-1 text-sm text-slate-600">수강신청·장학금·환불 요청을 30초마다 새로 확인합니다.</p>
          </div>
        </div>
        <AdminLiveRefresh />
      </div>

      <div className="grid gap-px bg-slate-200 sm:grid-cols-3">
        {REQUEST_KINDS.map((kind) => {
          const count = openRequests.filter((request) => request.kind === kind).length;
          return (
            <Link key={kind} href={`/admin/learner-documents?kind=${kind}`} className="group flex items-center justify-between bg-white px-5 py-4 hover:bg-teal-50">
              <div>
                <p className="text-xs font-semibold text-slate-500">{DOCUMENT_KIND_LABELS[kind]}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{count.toLocaleString("ko-KR")}<span className="ml-1 text-sm font-medium text-slate-500">건</span></p>
              </div>
              <ChevronRight aria-hidden="true" className="h-5 w-5 text-slate-300 group-hover:text-teal-700" />
            </Link>
          );
        })}
      </div>

      <div className="p-5 md:p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900">최근 접수·처리 대기</h3>
          <Link href="/admin/learner-documents" className="text-sm font-semibold text-teal-800">전체 요청 보기 →</Link>
        </div>
        {recentRequests.length ? (
          <ol className="divide-y divide-slate-100">
            {recentRequests.map((request) => <RequestRow key={request.id} request={request} />)}
          </ol>
        ) : (
          <p className="rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-600">현재 처리할 수강생 요청이 없습니다.</p>
        )}
      </div>
    </section>
  );
}

function RequestRow({ request }: { request: LearnerDocumentRequest }) {
  return (
    <li>
      <Link href={`/admin/learner-documents?kind=${request.kind}`} className="grid gap-2 py-3 hover:text-teal-900 md:grid-cols-[9rem_minmax(0,1fr)_auto] md:items-center md:gap-4">
        <span className="text-xs font-bold text-teal-700">{DOCUMENT_KIND_LABELS[request.kind]}</span>
        <span className="min-w-0">
          <strong className="block truncate text-sm text-slate-900">{request.course_name}</strong>
          <span className="mt-0.5 block text-xs text-slate-500">{request.applicant_name} · {documentDate(request.submitted_at)}</span>
        </span>
        <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${DOCUMENT_STATUS_TONES[request.status]}`}>{DOCUMENT_STATUS_LABELS[request.status]}</span>
      </Link>
    </li>
  );
}
