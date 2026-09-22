import Link from "next/link";
import { attendancePreparation } from "@/lib/course-workspace/progress";
import type { CourseWorkspace } from "@/lib/course-workspace/types";

export function AttendanceReadiness({ course: c }: { course: CourseWorkspace }) {
  const base = `/admin/offerings/${c.id}`;
  const checks = attendancePreparation(c);
  const archived = c.status === "ARCHIVED";
  const missing = checks.filter(check => !check.ready).length;
  const hasRecords = c.scheduled_sessions > 0 && c.enrolled > 0;
  return <section className="panel scroll-mt-6" id="attendance" aria-labelledby="attendance-heading">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="attendance-heading" className="text-lg font-bold">수업·출석부 운영</h2>
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${archived ? "bg-slate-100 text-slate-600" : missing ? "bg-amber-50 text-amber-800" : "bg-teal-50 text-teal-800"}`}>
        {archived ? "보관 과정" : missing ? `${missing}개 항목 등록 필요` : "운영 자료 연결됨"}
      </span>
    </div>
    {archived ? <p className="mt-3 text-sm leading-relaxed text-slate-600">
      보관된 원본 출석부와 개인별 전산 출결은 별도입니다. 원본 인원·시간만으로 개인별 출석을 생성하지 않습니다.
    </p> : <>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">관리자는 강사 배정과 수강 확정을, 담당 강사는 일정과 출결 기록을 진행합니다. 아래 건수와 최종 시간표·명단을 대조해 주세요.</p>
      <ol className="mt-5 space-y-3">
        {checks.map((check, i) => <li key={check.label} className="rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="font-semibold"><span className="mr-2 text-slate-400">{i + 1}.</span>{check.label}</h3>
            <span className={`text-sm font-bold ${check.ready ? "text-teal-800" : "text-amber-800"}`}>{check.value} · {check.ready ? "등록됨" : "등록 필요"}</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">{check.detail}</p>
          <Link href={check.href} className="mt-3 inline-block text-sm font-semibold text-teal-800 underline underline-offset-4">{check.action} →</Link>
        </li>)}
      </ol>
      {c.status === "DRAFT" && <p className="notice mt-4">개설 초안입니다. 모집기간과 승인된 운영 규정을 확인한 뒤 모집을 공개하세요.</p>}
    </>}
    {hasRecords ? <>
      <h3 className="mt-6 font-semibold">종료 수업 출결</h3>
      <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
        {[["종료 수업", `${c.ended_sessions}회`], ["입력된 출결", `${c.attendance_recorded}건`], ["미입력", `${c.missing_attendance}건`]].map(([label, value]) => <div key={label}>
          <dt className="text-slate-500">{label}</dt><dd className={`mt-1 text-xl font-bold ${label === "미입력" && c.missing_attendance ? "text-amber-800" : ""}`}>{value}</dd>
        </div>)}
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">미입력은 결석과 다릅니다. 휴강·예정 수업은 위 집계에서 제외합니다. 출결이 기록되어도 수료 승인은 별도입니다.</p>
    </> : <p className="notice mt-4">{archived ? "개인별 수강생·회차 자료가 없습니다. 원본 출석부는 결과보고서 첨부에서 확인·보관하세요." : "수강 확정 명단과 수업 일정이 연결되면 회차별 출결 현황이 표시됩니다."}</p>}
    <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold">
      {hasRecords && <Link href={`${base}/reports/print?document=attendance`} target="_blank" rel="noreferrer" className="text-teal-800">02 QR·확정 출석부 출력 →</Link>}
      {archived && <Link href={`${base}/reports#attachments`} className="text-teal-800">원본 출석부 첨부 확인 →</Link>}
    </div>
  </section>;
}
