import Link from "next/link";
import { dateTime, statusLabel } from "@/lib/portal/data";
import type { ApplicationDetail as Detail } from "@/lib/management/data";
import { ApplicationReviewForm } from "./application-review-form";

export function ApplicationDetail({ data, manager = false }: { data: Detail; manager?: boolean }) {
  const a = data.application;
  return <>
    <section className="panel space-y-4">
      <h2 className="section-title">{a.course_name}</h2>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div><dt className="text-slate-600">신청자</dt><dd>{a.name}{!a.active && " · 삭제된 계정"}</dd></div>
        <div><dt className="text-slate-600">신청 상태</dt><dd>{statusLabel[a.status] ?? a.status}</dd></div>
        <div><dt className="text-slate-600">신청일시</dt><dd>{dateTime(a.submitted_at)}</dd></div>
        <div><dt className="text-slate-600">수강 상태</dt><dd>{a.enrollment_status === "ACTIVE" ? "수강 중" : a.enrollment_status === "WITHDRAWN" ? "수강 취소" : "수강 미확정"}</dd></div>
        <div><dt className="text-slate-600">이메일</dt><dd className="break-all">{data.contact.email ?? "미등록"}</dd></div>
        <div><dt className="text-slate-600">연락처</dt><dd>{data.contact.phone ?? "미등록"}</dd></div>
      </dl>
      {manager && <div className="flex flex-wrap gap-3">
        <Link className="btn-secondary" href={`/admin/offerings/${a.offering_id}/manage`}>과정·강사 관리</Link>
        <Link className="btn-secondary" href={`/admin/learners/${a.person_id}`}>수강생 이력</Link>
      </div>}
    </section>
    {manager && ["SUBMITTED", "WAITLISTED"].includes(a.status) && <section className="panel mt-6"><h2 className="section-title">신청 심사</h2><ApplicationReviewForm key={a.status} id={a.id} status={a.status} /></section>}
    <section className="panel mt-6">
      <h2 className="section-title">처리 이력</h2>
      <ol className="space-y-4">
        <li className="border-b pb-4"><p className="font-semibold">신청 접수</p><p className="text-sm text-slate-600">{dateTime(a.submitted_at)}</p></li>
        {data.history.map(h => <li key={h.id} className="border-b pb-4 last:border-0">
          <p className="font-semibold">{h.previous_status && `${statusLabel[h.previous_status] ?? h.previous_status} → `}{statusLabel[h.next_status] ?? h.next_status}</p>
          <p className="text-sm text-slate-600">{dateTime(h.created_at)}{manager && h.actor_name ? ` · ${h.actor_name}` : ""}</p>
          {h.reason && <p className="mt-2 whitespace-pre-wrap break-words">{h.reason}</p>}
        </li>)}
      </ol>
    </section>
  </>;
}
