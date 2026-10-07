import { FileClock, FileText, Search } from "lucide-react";
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
  documentRegistrationMessage,
  isOpenLearnerDocument,
  type LearnerDocumentKind,
  type LearnerDocumentStatus,
} from "@/lib/learner-document-workflow/types";
import { admitLearnerDocument, linkLearnerDocument, updateLearnerDocumentStatus } from "./actions";
import { statusLabel } from "@/lib/portal/data";

const field = "mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900";
const rowField = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900";
const submittedDateFormat = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium" });
const submittedTimeFormat = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", timeStyle: "short" });
const kindKeys = Object.keys(DOCUMENT_KIND_LABELS) as LearnerDocumentKind[];
const statusKeys = Object.keys(DOCUMENT_STATUS_LABELS) as LearnerDocumentStatus[];
const KIND_FILTERS = [
  { value: "", label: "전체" },
  { value: "APPLICATION", label: "수강신청" },
  { value: "SCHOLARSHIP", label: "장학금신청" },
  { value: "REFUND", label: "환불신청" },
] as const;

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
  const kindHref = (value: string) => {
    const filters = new URLSearchParams();
    if (value) filters.set("kind", value);
    if (status) filters.set("status", status);
    if (query) filters.set("q", query);
    const search = filters.toString();
    return `/admin/learner-documents${search ? `?${search}` : ""}`;
  };
  const hiddenFilters = <>
    <input type="hidden" name="filter_kind" value={kind ?? ""} />
    <input type="hidden" name="filter_status" value={status ?? ""} />
    <input type="hidden" name="filter_query" value={query} />
  </>;

  return <div className="page-shell max-w-[1680px] space-y-7">
    <PageIntro eyebrow="LEARNER DOCUMENT DESK" title="수강생 서류 접수·처리">
      수강신청원서, 장학금 지급신청서, 수강료환불신청서의 원본과 처리 이력을 확인하고 수강생에게 진행 상태를 안내합니다.
    </PageIntro>
    {params.notice && <p role="status" className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">{params.notice}</p>}
    {params.error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{params.error}</p>}
    {!data ? <p role="alert" className="panel">자료를 불러오지 못했습니다. 담당 역할과 추가 인증 상태를 확인해 주세요.</p> : <>
      <section className="grid gap-3 sm:grid-cols-3" aria-label="서류 처리 요약">
        {[{label:"접수·검토",count:requests.filter(r => ["RECEIVED","REVIEWING"].includes(r.status)).length}, {label:"승인·지급 대기",count:requests.filter(r => r.status === "APPROVED" && isOpenLearnerDocument(r)).length}, {label:"완료·종결",count:requests.filter(r => !isOpenLearnerDocument(r)).length}].map(item => <div key={item.label} className="panel"><p className="text-sm text-slate-600">{item.label}</p><p className="mt-2 text-3xl font-bold tabular-nums">{item.count.toLocaleString("ko-KR")}<span className="ml-1 text-sm font-medium text-slate-500">건</span></p></div>)}
      </section>
      <form method="get" className="panel grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-[auto_minmax(150px,1fr)_minmax(220px,1.5fr)_auto]">
        <fieldset className="min-w-0 sm:col-span-2 xl:col-span-1">
          <legend className="text-sm font-semibold">서류 종류</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {KIND_FILTERS.map(({ value, label }) => <a key={value} href={kindHref(value)} aria-current={(kind ?? "") === value ? "page" : undefined}
              className={`inline-flex min-h-11 items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${(kind ?? "") === value ? "border-teal-800 bg-teal-800 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>
              {label}
            </a>)}
          </div>
        </fieldset>
        <input type="hidden" name="kind" value={kind ?? ""} />
        <label className="text-sm font-semibold">처리 상태<select className={field} name="status" defaultValue={status ?? ""}><option value="">전체</option>{statusKeys.map(value => <option value={value} key={value}>{DOCUMENT_STATUS_LABELS[value]}</option>)}</select></label>
        <label className="text-sm font-semibold">과정명·신청자<input className={field} name="q" defaultValue={query} maxLength={100} placeholder="검색어 입력" /></label>
        <button className="btn-secondary inline-flex min-h-11 items-center justify-center gap-2" type="submit"><Search size={16} />조회</button>
      </form>
      <section aria-labelledby="document-queue-heading">
        <div className="mb-4 flex items-center justify-between"><h2 id="document-queue-heading" className="text-xl font-bold">접수 문서</h2><span className="text-sm text-slate-500">조회 {requests.length.toLocaleString("ko-KR")}건</span></div>
        {requests.length ? <>
          <p id="document-queue-help" className="mb-3 text-sm leading-6 text-slate-600">안내 내용은 상태 저장 시 수강생에게 즉시 공개됩니다. 수강 신청과 동의가 접수된 원서는 승인 시 등록 절차로 연결됩니다. 유료 과정은 납부 완료 후 등록이 확정됩니다. 상태 변경에는 최근 추가 인증이 필요합니다. 좁은 화면에서는 목록을 좌우로 스크롤해 주세요.</p>
          <div role="region" aria-labelledby="document-queue-heading" aria-describedby="document-queue-help" tabIndex={0} className="relative overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[1480px] table-fixed text-left text-sm">
              <caption className="sr-only">접수 문서 목록. 각 행에서 처리 결과와 수강생 안내를 입력하고 상태를 저장할 수 있습니다.</caption>
              <colgroup>{[3.5, 16.5, 10, 10, 12, 9.5, 15.5, 10.5, 12.5].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup>
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
                <tr>
                  {["순번", "과정", "신청자", "신청시각", "처리 결과", "처리자", "수강생 안내 내용", "첨부문서", "비고"].map(label => (
                    <th key={label} scope="col" className={`px-3 py-4 font-semibold ${label === "순번" ? "text-center" : ""}`}>
                      {label}{label === "신청자" && <span className="mt-1 block text-xs font-normal text-slate-500">성명 · 전화번호</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {requests.map((request, index) => {
                  const nextStatuses = isOpenLearnerDocument(request) ? (NEXT_DOCUMENT_STATUSES[request.status] ?? []).filter(next => next !== "APPROVED" || request.kind !== "APPLICATION" || request.offering_id) : [];
                  const offeringChoices = (data.offerings ?? []).filter(choice => choice.org_id === request.org_id);
                  const canLink = request.kind === "APPLICATION" && !request.offering_id && !["REJECTED", "CANCELLED"].includes(request.status);
                  const registration = request.registration;
                  const formId = `document-status-${request.id}`;
                  const rowLabel = `${index + 1}번 ${request.applicant_name} ${DOCUMENT_KIND_LABELS[request.kind]}`;
                  return <tr key={request.id} className="align-top hover:bg-slate-50/60">
                    <td className="px-3 py-5 text-center tabular-nums text-slate-500">{index + 1}</td>
                    <th scope="row" className="break-words px-3 py-5 font-normal">
                      <p className="text-xs font-semibold text-teal-700">{DOCUMENT_KIND_LABELS[request.kind]}</p>
                      <p className="mt-2 font-bold leading-6 text-slate-900">{request.course_name}</p>
                      {request.kind === "APPLICATION" && registration && <div className="mt-2 space-y-2 text-xs leading-5 text-slate-600">
                        {request.offering_id && <p>연결 과정: {registration.offering_name}<br />{registration.starts_on} ~ {registration.ends_on}</p>}
                        <p>{documentRegistrationMessage(registration)}</p>
                        {registration.can_manage && <a className="inline-block font-semibold text-teal-800 underline" href={`/admin/offerings/${request.offering_id}/manage`}>개설 과정 관리</a>}
                        {registration.can_manage && registration.application_id && <a className="block font-semibold text-teal-800 underline" href={`/admin/applications/${registration.application_id}`}>수강 신청 확인</a>}
                      </div>}
                      {canLink && <div className="mt-3">
                        {offeringChoices.length ? <form action={linkLearnerDocument} aria-label={`${rowLabel} 과정 연결`} className="space-y-2">
                          {hiddenFilters}<input type="hidden" name="request_id" value={request.id} /><input type="hidden" name="revision" value={request.revision} />
                          <label className="block text-xs font-semibold" htmlFor={`document-link-${request.id}`}>실제 개설 기수</label>
                          <select id={`document-link-${request.id}`} name="offering_id" required defaultValue="" className={rowField}>
                            <option value="" disabled>연결할 기수를 선택해 주세요</option>
                            {offeringChoices.map(choice => <option key={choice.id} value={choice.id}>{choice.name} · {choice.starts_on}~{choice.ends_on} · {statusLabel[choice.status] ?? choice.status}</option>)}
                          </select>
                          <button type="submit" className="btn-secondary w-full text-xs">과정 연결</button>
                        </form> : <p className="text-xs leading-5 text-amber-800">담당자가 교육·모집 일정이 유효한 개설 기수를 준비한 후 연결해 주세요.</p>}
                      </div>}
                      {request.kind === "REFUND" && <p className="mt-3 text-xs leading-5 text-slate-600">자동 산출 반환액<br /><strong className="text-sm text-slate-800">{Number(request.amount ?? 0).toLocaleString("ko-KR")}원</strong></p>}
                    </th>
                    <td className="break-words px-3 py-5">
                      <p className="font-semibold">{request.applicant_name}</p>
                      <p className="mt-2 whitespace-nowrap text-slate-600">{request.phone_masked || "전화번호 미등록"}</p>
                    </td>
                    <td className="px-3 py-5 leading-6 text-slate-600"><time dateTime={request.submitted_at}>
                      <span className="block whitespace-nowrap">{submittedDateFormat.format(new Date(request.submitted_at))}</span>
                      <span className="block whitespace-nowrap">{submittedTimeFormat.format(new Date(request.submitted_at))}</span>
                    </time></td>
                    <td className="px-3 py-5">
                      {nextStatuses.length ? <>
                        <label htmlFor={`${formId}-next`} className="sr-only">{rowLabel} 처리 결과</label>
                        <select id={`${formId}-next`} form={formId} name="next_status" required className={rowField} defaultValue="">
                          <option value="" disabled>선택해 주세요</option>
                          {nextStatuses.map(next => <option value={next} key={next}>{DOCUMENT_STATUS_LABELS[next]}</option>)}
                        </select>
                      </> : <span className="inline-block py-2 text-slate-500">처리 종결</span>}
                    </td>
                    <td className="break-words px-3 py-5 text-slate-700">{request.reviewer_name || "—"}</td>
                    <td className="px-3 py-5">
                      <p className="truncate leading-6 text-slate-600" title={request.current_note || undefined}>{request.current_note || "등록된 안내가 없습니다."}</p>
                      {nextStatuses.length > 0 && <div className="mt-3">
                        <label htmlFor={`${formId}-note`} className="sr-only">{rowLabel} 새 수강생 안내 내용</label>
                        <input type="text" id={`${formId}-note`} form={formId} name="note" maxLength={1000} className={`${rowField} min-h-11`} placeholder="검토 결과와 다음 절차 (선택)" />
                      </div>}
                    </td>
                    <td className="px-3 py-5">
                      <a href={`/api/learner-documents/${request.id}/pdf`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50">
                        <FileText size={16} className="shrink-0" aria-hidden="true" /><span>신청서<span className="sr-only"> · {rowLabel} PDF (새 창)</span></span>
                      </a>
                    </td>
                    <td className="px-3 py-5">
                      <div className={nextStatuses.length ? "grid grid-cols-2 items-stretch gap-2" : ""}>
                        <span className={`inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-lg border px-1 text-center text-xs font-semibold ${DOCUMENT_STATUS_TONES[request.status]}`}>{DOCUMENT_STATUS_LABELS[request.status]}</span>
                        {nextStatuses.length > 0 && <form id={formId} action={updateLearnerDocumentStatus} aria-label={`${rowLabel} 상태 변경`} className="min-w-0">
                          {hiddenFilters}<input type="hidden" name="request_id" value={request.id} /><input type="hidden" name="revision" value={request.revision} />
                          <button type="submit" className="btn-primary w-full whitespace-nowrap px-1 text-xs">상태 저장</button>
                        </form>}
                      </div>
                      {request.kind === "APPLICATION" && ["APPROVED", "COMPLETED"].includes(request.status) && registration?.can_manage && registration.can_admit && <form action={admitLearnerDocument} className="mt-3">
                        {hiddenFilters}<input type="hidden" name="request_id" value={request.id} /><input type="hidden" name="revision" value={request.revision} />
                        <button type="submit" className="btn-primary w-full text-xs">수강 등록 확정</button>
                      </form>}
                      <details className="mt-3">
                        <summary className="min-h-11 cursor-pointer py-2 text-xs font-semibold text-slate-600"><FileClock size={14} className="mr-1 inline-block text-teal-700" aria-hidden="true" />처리 이력 {request.events.length}건</summary>
                        <ol className="mt-1 space-y-3 border-l-2 border-slate-200 pl-3">{request.events.map(event => <li key={event.id} className="break-words text-xs leading-5">
                          <p className="font-semibold">{DOCUMENT_STATUS_LABELS[event.to_status]}</p>
                          <time dateTime={event.created_at} className="block text-slate-500">{documentDate(event.created_at)}</time>
                          {event.actor_name && <p className="text-slate-500">{event.actor_name}</p>}
                          <p className="mt-1 whitespace-pre-wrap text-slate-700">{event.note}</p>
                        </li>)}</ol>
                      </details>
                    </td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </> : <p className="panel text-sm text-slate-600">조건에 맞는 접수 문서가 없습니다.</p>}
      </section>
    </>}
  </div>;
}
