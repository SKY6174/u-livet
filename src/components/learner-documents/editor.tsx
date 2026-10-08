"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Clock3, Download, FileCheck2, FileText, LockKeyhole, Send, ShieldCheck, XCircle } from "lucide-react";
import { PdfPreview } from "@/components/instructor-documents/pdf-preview";
import { BANKS, DOCUMENT_TITLES, PURPOSES, REFUND_OCCURRENCES, documentErrors, initialValues, koreaToday, refundAmounts,
  type ConsentChoice, type LearnerDocumentType, type LearnerDocumentValues, type LearnerDocumentProfile } from "@/lib/learner-documents/model";
import type { LearnerPdfAssets } from "@/lib/learner-documents/pdf";
import {
  DOCUMENT_KIND_LABELS,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_TONES,
  documentDate,
  documentRegistrationMessage,
  type LearnerDocumentEligibility,
  type LearnerDocumentRequest,
} from "@/lib/learner-document-workflow/types";
import { cancelLearnerDocument, submitLearnerDocument } from "@/app/mypage/documents/actions";
import "./editor.css";

const SignaturePad = dynamic(() => import("@/features/instructor-documents/components/advisory/advisory-signature-pad").then(m => m.AdvisorySignaturePad), { ssr: false });
const assetsCache = new Map<LearnerDocumentType, Promise<LearnerPdfAssets>>();
function loadAssets(type: LearnerDocumentType) {
  const cached = assetsCache.get(type);
  if (cached) return cached;
  const read = async (url: string) => {
    const result = await fetch(url);
    if (!result.ok) throw new Error("서식 또는 글꼴을 불러오지 못했습니다. 다시 시도해 주세요.");
    return new Uint8Array(await result.arrayBuffer());
  };
  const promise = Promise.all([read(`/forms/learner-${type}.pdf`), read("/fonts/KoPubDotum-Medium.ttf"), read("/fonts/KoPubDotum-Bold.ttf")])
    .then(([template, regular, bold]) => ({ template, regular, bold }))
    .catch(error => { assetsCache.delete(type); throw error; });
  assetsCache.set(type, promise);
  return promise;
}

function Field({ label, error, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }) {
  return <div className="min-w-0">
    <label htmlFor={props.id} className="mb-2 block text-sm font-semibold text-slate-700">{label}</label>
    <input {...props} className="learner-field" aria-invalid={!!error} aria-describedby={error || hint ? `${props.id}-help` : undefined} />
    {(error || hint) && <p id={`${props.id}-help`} className={`mt-1.5 text-xs leading-5 ${error ? "text-red-700" : "text-slate-500"}`}>{error || hint}</p>}
  </div>;
}
function BankField({ value, error, onChange }: { value: string; error?: string; onChange: (value: string) => void }) {
  return <div className="min-w-0">
    <label htmlFor="bank" className="mb-2 block text-sm font-semibold text-slate-700">은행명</label>
    <select id="bank" name="bank" value={value} onChange={e => onChange(e.target.value)} className="learner-field" aria-invalid={!!error} aria-describedby={error ? "bank-help" : undefined}>
      <option value="">은행을 선택해 주세요</option>
      {BANKS.map(bank => <option key={bank} value={bank}>{bank}</option>)}
    </select>
    {error && <p id="bank-help" className="mt-1.5 text-xs leading-5 text-red-700">{error}</p>}
  </div>;
}
function Section({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
    <h2 className="mb-5 flex items-center gap-3 text-lg font-bold"><span className="text-xs font-semibold text-teal-700">{number}</span>{title}</h2>
    {children}
  </section>;
}
function Consent({ id, title, value, onChange, children, error }: {
  id: string; title: string; value: ConsentChoice; onChange: (value: ConsentChoice) => void; children: ReactNode; error?: string;
}) {
  return <fieldset id={id} tabIndex={-1} className="rounded-xl border border-slate-200 p-4" aria-describedby={error ? `${id}-error` : undefined}>
    <legend className="px-1 text-sm font-semibold">{title}</legend>
    <div className="mb-4 text-sm leading-6 text-slate-600">{children}</div>
    <div className="flex flex-wrap gap-3">
      {([ ["yes", "동의함"], ["no", "동의하지 않음"] ] as const).map(([choice, label]) => <label key={choice} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${value === choice ? "border-teal-600 bg-teal-50 text-teal-900" : "border-slate-200"}`}>
        <input type="radio" name={id} value={choice} checked={value === choice} onChange={() => onChange(choice)} />{label}
      </label>)}
    </div>
    {error && <p id={`${id}-error`} className="mt-2 text-xs text-red-700">{error}</p>}
  </fieldset>;
}

type DocumentCourse = { id: string; name: string; offeringId: string; tuition: number | null; periodLabel?: string };

export function LearnerDocumentEditor({ type: initialType, name, email, courses, requests, eligibility, initialCourse, profile, profileUnavailable, coursesUnavailable }: {
  type: LearnerDocumentType; name: string; email: string; courses: DocumentCourse[];
  requests: LearnerDocumentRequest[]; eligibility: LearnerDocumentEligibility[]; initialCourse?: DocumentCourse;
  profile?: LearnerDocumentProfile; profileUnavailable?: boolean; coursesUnavailable?: boolean;
}) {
  const router = useRouter();
  const refundCourses = courses.filter(course => course.offeringId && eligibility.some(item => item.offering_id === course.offeringId && item.refund_allowed));
  const scholarshipCourses = courses.filter(course => course.offeringId && eligibility.some(item => item.offering_id === course.offeringId && item.scholarship_allowed));
  const refundInitialCourse = initialCourse?.offeringId && refundCourses.some(course => course.offeringId === initialCourse.offeringId) ? initialCourse : refundCourses[0];
  const scholarshipInitialCourse = initialCourse?.offeringId && scholarshipCourses.some(course => course.offeringId === initialCourse.offeringId) ? initialCourse : scholarshipCourses[0];
  const [type, setType] = useState(initialType);
  const [forms, setForms] = useState(() => ({
    application: initialValues(name, email, initialCourse?.name, initialCourse?.offeringId ?? "", initialCourse?.tuition ?? null, profile),
    scholarship: initialValues(name, email, scholarshipInitialCourse?.name, scholarshipInitialCourse?.offeringId ?? "", scholarshipInitialCourse?.tuition ?? null, profile),
    refund: initialValues(name, email, refundInitialCourse?.name, refundInitialCourse?.offeringId ?? "", refundInitialCourse?.tuition ?? null, profile),
  }));
  const values = forms[type];
  const [rendered, setRendered] = useState<{ type: LearnerDocumentType; values: LearnerDocumentValues; bytes: Uint8Array } | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [errors, setErrors] = useState<ReturnType<typeof documentErrors>>({});
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const [showResident, setShowResident] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState("");
  const savedValues = useRef(forms);
  const submittedValues = useRef<Partial<Record<LearnerDocumentType, LearnerDocumentValues>>>({});
  const requestKeys = useRef<Partial<Record<LearnerDocumentType, string>>>({});
  const activeType = useRef(initialType);
  const signatureJob = useRef(0);
  const application = type === "application";
  const scholarship = type === "scholarship";
  const refund = type === "refund";
  const canUseScholarship = scholarshipCourses.length > 0;
  const canUseRefund = refundCourses.length > 0;
  const pending = rendered?.type !== type || rendered?.values !== values;
  function update<K extends keyof LearnerDocumentValues>(key: K, value: LearnerDocumentValues[K]) {
    setForms(old => ({ ...old, [type]: { ...old[type], [key]: value } }));
    setErrors({});
    setNotice("");
    requestKeys.current[type] = undefined;
  }
  function updateCourse(offeringId: string) {
    const course = courses.find(item => item.offeringId === offeringId);
    setForms(old => {
      const next = { ...old[type], courseName: course?.name ?? "", offeringId: course?.offeringId ?? "" };
      if (type === "refund") Object.assign(next, refundAmounts(course?.tuition ?? null, next.refundOccurrence));
      return { ...old, [type]: next };
    });
    setErrors({}); setNotice(""); requestKeys.current[type] = undefined;
  }
  function updateRefundOccurrence(value: LearnerDocumentValues["refundOccurrence"]) {
    const course = courses.find(item => item.offeringId === values.offeringId);
    setForms(old => ({ ...old, refund: { ...old.refund, refundOccurrence: value, ...refundAmounts(course?.tuition ?? null, value) } }));
    setErrors({}); setNotice(""); requestKeys.current.refund = undefined;
  }
  function selectDocument(nextType: LearnerDocumentType) {
    if (nextType === type || (nextType === "refund" && !canUseRefund) || (nextType === "scholarship" && !canUseScholarship)) return;
    activeType.current = nextType;
    signatureJob.current++;
    setType(nextType);
    setRendered(null);
    setPreviewError("");
    setErrors({});
    setNotice("");
    setShowResident(false);
  }
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (savedValues.current.application !== forms.application || savedValues.current.scholarship !== forms.scholarship || savedValues.current.refund !== forms.refund) {
        event.preventDefault(); event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [forms]);
  useEffect(() => {
    let active = true;
    setPreviewError("");
    const timer = setTimeout(() => {
      void Promise.all([loadAssets(type), import("@/lib/learner-documents/pdf")])
        .then(([assets, renderer]) => renderer.renderLearnerDocument(type, values, assets))
        .then(bytes => { if (active) setRendered({ type, values, bytes }); })
        .catch(error => {
          if (active) { setRendered(null); setPreviewError(error instanceof Error ? error.message : "PDF를 만들지 못했습니다. 다시 시도해 주세요."); }
        });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [type, values, retry]);

  async function setSignature(dataUrl: string) {
    if (activeType.current !== type) return;
    const job = ++signatureJob.current;
    if (!dataUrl) { update("signature", ""); return; }
    update("signature", "");
    try {
      const image = new Image();
      image.src = dataUrl;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("서명 이미지를 처리하지 못했습니다.");
      context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      let left = canvas.width, top = canvas.height, right = -1, bottom = -1;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        if (data[i + 3] > 30 && Math.min(data[i], data[i + 1], data[i + 2]) < 210) {
          left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
      }
      if (job !== signatureJob.current) return;
      if (right - left < 3 || bottom - top < 3) { update("signature", ""); return; }
      const cropped = document.createElement("canvas");
      cropped.width = right - left + 9; cropped.height = bottom - top + 9;
      cropped.getContext("2d")!.drawImage(canvas, left, top, right - left + 1, bottom - top + 1, 4, 4, right - left + 1, bottom - top + 1);
      update("signature", cropped.toDataURL("image/png"));
    } catch { if (job === signatureJob.current) setNotice("서명 이미지를 처리하지 못했습니다. 다시 작성해 주세요."); }
  }
  function download() {
    const nextErrors = documentErrors(type, values);
    setErrors(nextErrors);
    const first = Object.keys(nextErrors)[0];
    if (first) {
      setNotice("표시된 항목을 확인해 주세요.");
      document.getElementById(first)?.focus();
      return;
    }
    if (!rendered || pending || previewError) return;
    const blob = new Blob([Uint8Array.from(rendered.bytes)], { type: "application/pdf" });
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url; link.download = `${DOCUMENT_TITLES[type]}_${values.signedOn}.pdf`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    savedValues.current = { ...savedValues.current, [type]: values };
    setNotice("PDF를 내려받았습니다. 신청처리는 별도 버튼으로 접수할 수 있습니다.");
  }
  async function submit() {
    const nextErrors = documentErrors(type, values);
    setErrors(nextErrors);
    const first = Object.keys(nextErrors)[0];
    if (first) {
      setNotice("표시된 항목을 확인해 주세요.");
      document.getElementById(first)?.focus();
      return;
    }
    if (pending || previewError || submitting) return;
    const requestKey = requestKeys.current[type] ?? crypto.randomUUID();
    requestKeys.current[type] = requestKey;
    const submitted = values;
    setSubmitting(true);
    const result = await submitLearnerDocument({ type, requestKey, values: submitted });
    setSubmitting(false);
    if (result.fieldErrors) setErrors(result.fieldErrors);
    setNotice(result.message);
    if (!result.ok) return;
    submittedValues.current[type] = submitted;
    savedValues.current = { ...savedValues.current, [type]: submitted };
    router.refresh();
  }
  async function cancelRequest(requestId: string) {
    if (cancelling) return;
    setCancelling(requestId);
    const result = await cancelLearnerDocument(requestId);
    setCancelling("");
    setNotice(result.message);
    if (result.ok) router.refresh();
  }
  const input = (key: keyof LearnerDocumentValues) => ({ id: key, name: key, value: typeof values[key] === "string" ? values[key] as string : "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => update(key, e.target.value), error: errors[key] });
  return <div className="learner-document-editor min-h-screen bg-[#f3f6f8]">
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <div><p className="mb-1 text-[11px] font-bold tracking-[.16em] text-teal-700">U-LiVET · LEARNER DOCUMENTS</p>
          <h1 className="text-xl font-bold sm:text-2xl">수강생 작성 서류</h1></div>
        <span className="flex items-center gap-2 rounded-full bg-teal-50 px-4 py-2 text-xs font-semibold text-teal-800"><FileCheck2 size={16} />원본 서식 · PDF 1.7</span>
      </div>
    </div>
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-8">
      <div className="mb-6">
        <div className="mb-4 flex flex-wrap gap-3" role="group" aria-label="작성할 서식 선택">
          {([ ["application", "수강신청원서", true], ["scholarship", "장학금 지급신청서", canUseScholarship], ["refund", "수강료환불신청서", canUseRefund] ] as const).map(([documentType, label, enabled]) => (
            <button key={documentType} type="button" aria-pressed={type === documentType} aria-controls="learner-document-fields"
              disabled={!enabled} aria-disabled={!enabled}
              onClick={() => selectDocument(documentType)}
              className={`inline-flex min-h-12 items-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold transition ${type === documentType ? "border-[#123353] bg-[#123353] text-white shadow-sm" : enabled ? "border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-800" : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"}`}>
              {enabled ? <FileText size={17} aria-hidden="true" /> : <LockKeyhole size={17} aria-hidden="true" />}{label}
            </button>
          ))}
        </div>
        <p className="text-sm text-slate-600">같은 창에서 세 서식을 작성하세요. 서식을 전환해도 입력한 내용은 유지됩니다.</p>
        <p className="mt-2 text-sm text-slate-600">과정과 가입 정보를 확인하고 나머지 항목·서명·동의를 작성해 주세요.</p>
        {profileUnavailable && <p role="status" className="notice mt-3">가입 연락처를 불러오지 못했습니다. 휴대전화 등 빈 항목을 직접 입력해 주세요.</p>}
        {(!canUseRefund || !canUseScholarship) && <div className="mt-3 space-y-1 text-xs leading-5 text-slate-500">
          {!canUseRefund && <p className="flex items-center gap-2"><LockKeyhole size={14} aria-hidden="true" />수강료 환불신청서는 수강신청원서 승인 후 이용할 수 있습니다.</p>}
          {!canUseScholarship && <p className="flex items-center gap-2"><LockKeyhole size={14} aria-hidden="true" />장학금 지급신청서는 수강신청원서 승인과 수료 인정 후 이용할 수 있습니다.</p>}
        </div>}
      </div>
      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby="learner-document-history">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-semibold tracking-wide text-teal-700">MY REQUESTS</p><h2 id="learner-document-history" className="mt-1 text-lg font-bold">내 서류 처리 현황</h2></div>
          <span className="text-sm text-slate-500">접수 {requests.length}건</span>
        </div>
        {requests.length ? <div className="mt-4 grid gap-3 xl:grid-cols-2">{requests.map(request => <details key={request.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <summary className="cursor-pointer list-none">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="font-semibold text-slate-900">{DOCUMENT_KIND_LABELS[request.kind]}</p><p className="mt-1 text-sm text-slate-600">{request.course_name} · {documentDate(request.submitted_at)}</p></div>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${DOCUMENT_STATUS_TONES[request.status]}`}>{DOCUMENT_STATUS_LABELS[request.status]}</span>
            </div>
            <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
              <p>{request.current_note}</p>
              {request.kind === "APPLICATION" && request.registration && <p className="rounded-lg bg-teal-50 p-3 text-teal-900">{documentRegistrationMessage(request.registration)}</p>}
            </div>
          </summary>
          <ol className="mt-4 space-y-3 border-t border-slate-200 pt-4">{request.events.map(event => <li key={event.id} className="flex gap-3 text-sm"><Clock3 className="mt-0.5 shrink-0 text-teal-700" size={16} /><div><p className="font-semibold">{DOCUMENT_STATUS_LABELS[event.to_status]} <span className="font-normal text-slate-500">· {documentDate(event.created_at)}</span></p><p className="mt-1 text-slate-600">{event.note}</p></div></li>)}</ol>
          <div className="mt-4 flex flex-wrap gap-2">
            {request.offering_id && request.registration?.can_apply && <a href={`/offerings/${request.offering_id}/apply`} className="btn-primary">신청 안내·동의 확인 후 수강 신청</a>}
            {request.offering_id && request.registration?.active && <a href={`/learning/${request.offering_id}`} className="btn-primary">내 강의실 보기</a>}
            <a href={`/api/learner-documents/${request.id}/pdf`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"><Download size={15} />제출 원본</a>
            {request.status === "RECEIVED" && <button type="button" onClick={() => void cancelRequest(request.id)} disabled={cancelling === request.id} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50"><XCircle size={15} />{cancelling === request.id ? "취소 중…" : "접수 취소"}</button>}
          </div>
        </details>)}</div> : <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">아직 접수한 서류가 없습니다. 서식을 작성한 뒤 입력완료 또는 신청처리 버튼을 눌러 주세요.</p>}
      </section>
      <div id="learner-document-fields" role="region" aria-label={`${DOCUMENT_TITLES[type]} 작성`} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="min-w-0 space-y-5">
          <Section number="01" title="과정과 인적사항">
            <div className="space-y-5">
              <div>
                <label htmlFor="courseName" className="mb-2 block text-sm font-semibold text-slate-700">{application ? "신청과정명" : "과정명"}</label>
                <select id="courseName" name="courseName" value={values.offeringId} onChange={e => updateCourse(e.target.value)} className="learner-field" aria-invalid={!!errors.courseName}
                  aria-describedby="courseName-help" disabled={application && !courses.length}>
                  <option value="">{application ? "개설 과정을 선택해 주세요" : refund ? "승인된 수강 과정을 선택해 주세요" : "수료 인정된 과정을 선택해 주세요"}</option>
                  {(application ? courses : refund ? refundCourses : scholarshipCourses).map(course => <option key={course.id} value={course.offeringId}>{course.name}{course.periodLabel ? ` · ${course.periodLabel}` : ""}{refund ? course.tuition === null ? " · 수강료 미등록" : ` · ${course.tuition.toLocaleString("ko-KR")}원` : ""}</option>)}
                </select>
                <p id="courseName-help" className={`mt-1.5 text-xs leading-5 ${errors.courseName || coursesUnavailable ? "text-red-700" : "text-slate-500"}`}>
                  {errors.courseName || (application ? coursesUnavailable ? "개설 과정 목록을 불러오지 못했습니다. 페이지를 새로 고쳐 주세요." : !courses.length ? "현재 원서를 작성할 개설 과정이 없습니다." : "개설 과정과 교육기간을 확인해 선택해 주세요." : refund ? "원서가 승인된 수강 과정을 선택해 주세요." : "수료 인정된 과정을 선택해 주세요.")}
                </p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field {...input("name")} label="성명" maxLength={30} autoComplete="name" />
                <Field {...input("phone")} label="휴대전화" type="tel" maxLength={14} autoComplete="tel" placeholder="010-0000-0000" />
                {application && <Field {...input("birthDate")} label="생년월일" type="date" max={koreaToday()} hint="PDF에는 생년월일 6자리로 표시됩니다." />}
                {(application || scholarship) && <fieldset id="gender" tabIndex={-1}><legend className="mb-2 text-sm font-semibold text-slate-700">성별</legend>
                  <div className="flex min-h-11 gap-5">{([ ["male", "남"], ["female", "여"] ] as const).map(([value, label]) => <label key={value} className="flex items-center gap-2"><input type="radio" name="gender" checked={values.gender === value} onChange={() => update("gender", value)} />{label}</label>)}</div>
                  {errors.gender && <p className="mt-1 text-xs text-red-700">{errors.gender}</p>}
                </fieldset>}
                {refund && <Field {...input("homePhone")} label="자택전화 (선택)" type="tel" maxLength={15} autoComplete="tel-national" placeholder="052-000-0000" />}
              </div>
              {application ? <>
                <Field {...input("email")} label="이메일 (선택)" type="email" maxLength={100} autoComplete="email" />
                <Field {...input("address")} label="자택주소" maxLength={100} autoComplete="street-address" />
                <fieldset id="purposes" tabIndex={-1}><legend className="mb-3 text-sm font-semibold text-slate-700">신청목적 <span className="font-normal text-slate-500">· 복수 선택 가능</span></legend>
                  <div className="flex flex-wrap gap-2">{PURPOSES.map(purpose => <label key={purpose} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm"><input type="checkbox" checked={values.purposes.includes(purpose)} onChange={e => update("purposes", e.target.checked ? [...values.purposes, purpose] : values.purposes.filter(p => p !== purpose))} />{purpose}</label>)}</div>
                  {errors.purposes && <p className="mt-2 text-xs text-red-700">{errors.purposes}</p>}
                </fieldset>
              </> : <>
                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Field {...input("residentFront")} label="주민등록번호 앞자리" inputMode="numeric" maxLength={6} autoComplete="off" placeholder="6자리" />
                    <Field {...input("residentBack")} label="주민등록번호 뒷자리" type={showResident ? "text" : "password"} inputMode="numeric" maxLength={7} autoComplete="off" placeholder="7자리" />
                  </div>
                  <label className="mt-3 flex min-h-10 items-center gap-2 text-xs"><input type="checkbox" checked={showResident} onChange={e => setShowResident(e.target.checked)} />입력란의 뒷자리 표시</label>
                  <p className="text-xs leading-5 text-slate-500">원본 양식에 따라 PDF 미리보기와 다운로드 파일에는 주민등록번호 전체가 표시됩니다.</p>
                </div>
                {refund && <Field {...input("address")} label="주소" maxLength={100} autoComplete="street-address" />}
              </>}
            </div>
          </Section>
          {scholarship && <Section number="02" title="장학금 계좌">
            <div className="grid gap-5 sm:grid-cols-2"><BankField value={values.bank} error={errors.bank} onChange={value => update("bank", value)} /><Field {...input("accountHolder")} label="예금주" maxLength={30} /></div>
            <div className="mt-5"><Field {...input("account")} label="계좌번호 (본인명의)" maxLength={30} inputMode="numeric" autoComplete="off" hint="은행명과 계좌번호를 정확하게 확인해 주세요." /></div>
          </Section>}
          {refund && <>
            <Section number="02" title="반환 정보">
              <div className="mb-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-700"><span className="font-semibold">반환사유</span><span className="ml-4">개인사유</span></div>
              <fieldset id="refundOccurrence" tabIndex={-1} aria-describedby={errors.refundOccurrence ? "refundOccurrence-error" : undefined}>
                <legend className="mb-3 text-sm font-semibold text-slate-700">발생시점</legend>
                <div className="grid gap-2 sm:grid-cols-2">{REFUND_OCCURRENCES.map(([value, label]) => <label key={value} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${values.refundOccurrence === value ? "border-teal-600 bg-teal-50 text-teal-900" : "border-slate-200"}`}>
                  <input type="radio" name="refundOccurrence" value={value} checked={values.refundOccurrence === value} onChange={() => updateRefundOccurrence(value)} />{label}
                </label>)}</div>
                {errors.refundOccurrence && <p id="refundOccurrence-error" className="mt-2 text-xs text-red-700">{errors.refundOccurrence}</p>}
              </fieldset>
              <div className="mt-5 grid gap-5 sm:grid-cols-3">
                <Field {...input("tuitionFee")} value={values.tuitionFee ? Number(values.tuitionFee).toLocaleString("ko-KR") : ""} label="수강료 (원)" readOnly placeholder="과정 선택 필요" />
                <Field {...input("deductionAmount")} value={values.deductionAmount ? Number(values.deductionAmount).toLocaleString("ko-KR") : ""} label="공제금액 (원)" readOnly placeholder="자동 계산" />
                <Field {...input("refundAmount")} value={values.refundAmount ? Number(values.refundAmount).toLocaleString("ko-KR") : values.refundAmount} label="반환액 (원)" readOnly placeholder="자동 계산" />
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">과정에 등록된 수강료와 원본 학습비 반환기준으로 자동 계산됩니다. 수강료 정보가 없으면 금액은 비어 있고 신청할 수 없습니다.</p>
            </Section>
            <Section number="03" title="환불 계좌">
              <div className="grid gap-5 sm:grid-cols-2"><BankField value={values.bank} error={errors.bank} onChange={value => update("bank", value)} /><Field {...input("accountHolder")} label="예금주" maxLength={30} /></div>
              <div className="mt-5"><Field {...input("account")} label="계좌번호 (본인명의)" maxLength={30} inputMode="numeric" autoComplete="off" hint="은행명과 계좌번호를 정확하게 확인해 주세요." /></div>
            </Section>
          </>}
          {!refund && <Section number={application ? "02" : "03"} title="동의 내용 확인">
            <p className="mb-5 text-sm leading-6 text-slate-500">각 항목의 내용을 확인하고 직접 선택해 주세요. 전체 원문은 PDF 미리보기에서 확인할 수 있습니다.</p>
            <div className="space-y-5">
              <Consent id="privacy" title="개인정보 수집 및 이용에 대한 동의" value={values.privacy} onChange={v => update("privacy", v)} error={errors.privacy}>
                {application ? "원서 접수·전형, 수강·수료 여부 및 학사 관리를 위해 과정명과 인적사항 등을 수집·이용하며, 처리목적 달성 시까지 보유합니다." : "수강료 할인 환급을 위해 과정명, 성명·성별·주민등록번호·휴대전화 등 인적사항, 은행계좌 및 제출서류를 수집·이용하며, 환급신청서 제출일로부터 3년간 보유합니다. 동의를 거부할 수 있으나, 거부 시 수강료를 환급받을 수 없습니다."}
              </Consent>
              {application && <>
                <Consent id="publicity" title="대학홍보 목적 사용 동의" value={values.publicity} onChange={v => update("publicity", v)} error={errors.publicity}>대학홍보물(뉴스레터, 문자메시지, 홍보책자 등) 발송을 위해 성명·이메일·전화번호 등을 이용하며, 동의일로부터 3년까지 보유합니다.</Consent>
                <Consent id="portrait" title="초상권 활용 동의" value={values.portrait} onChange={v => update("portrait", v)} error={errors.portrait}>활동사진 및 영상물은 앵커사업단 교육과정 관련 홍보 및 정보 전달 목적으로 사용할 수 있습니다.</Consent>
              </>}
            </div>
          </Section>}
          <Section number={application ? "03" : "04"} title="작성일과 서명">
            <Field {...input("signedOn")} label="작성일" type="date" />
            <div id="signature" tabIndex={-1}><SignaturePad key={type} signatureUrl={values.signature} strokeWidth={4.8} onChange={dataUrl => void setSignature(dataUrl)} /></div>
            {errors.signature && <p className="mt-2 text-sm text-red-700">서명을 작성해 주세요.</p>}
          </Section>
          <p className="flex items-start gap-2 px-1 text-xs leading-5 text-slate-500"><ShieldCheck className="mt-0.5 shrink-0" size={16} />PDF 다운로드는 개인 보관용입니다. 입력완료 또는 신청처리 버튼을 눌러야 담당자에게 접수되며, 이후 상태와 안내는 위 처리 현황에서 확인할 수 있습니다.</p>
        </div>
        <aside className="min-w-0 lg:sticky lg:top-5" aria-label="PDF 미리보기 및 다운로드">
          <div className="mb-3 flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-bold"><FileText size={18} className="text-teal-700" />PDF 미리보기</h2><span className="text-xs text-slate-500" role="status">{previewError ? "입력 확인 필요" : pending ? "반영 중…" : "최신 내용 반영됨"}</span></div>
          <div className="learner-pdf-preview"><PdfPreview bytes={rendered?.bytes ?? null} errorMessage={previewError} /></div>
          {previewError && <div role="alert" className="mt-3 rounded-xl bg-red-50 p-4 text-sm text-red-800">{previewError}<button type="button" className="ml-2 underline" onClick={() => setRetry(v => v + 1)}>다시 시도</button></div>}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={download} disabled={pending || !!previewError} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#123353] bg-white px-5 py-3 font-semibold text-[#123353] hover:bg-slate-50 disabled:cursor-wait disabled:opacity-50"><Download size={18} />PDF 다운로드</button>
            <button type="button" onClick={() => void submit()} disabled={pending || !!previewError || submitting || submittedValues.current[type] === values} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#123353] px-5 py-3 font-semibold text-white hover:bg-[#1d476d] disabled:cursor-wait disabled:opacity-50"><Send size={18} />{submitting ? "처리 중…" : application ? "입력완료" : "신청처리"}</button>
          </div>
          <p className="mt-2 text-center text-xs text-slate-500">A4 · 1페이지 · PDF 1.7</p>
          {notice && <p role="status" className="mt-3 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm leading-6 text-teal-900">{notice}</p>}
        </aside>
      </div>
    </div>
  </div>;
}
