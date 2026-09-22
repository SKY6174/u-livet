"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Download, FileCheck2, FileText, ShieldCheck } from "lucide-react";
import { PdfPreview } from "@/components/instructor-documents/pdf-preview";
import { DocumentPopup } from "@/components/instructor-documents/document-popup";
import { DOCUMENT_TITLES, PURPOSES, documentErrors, initialValues, koreaToday,
  type ConsentChoice, type LearnerDocumentType, type LearnerDocumentValues } from "@/lib/learner-documents/model";
import type { LearnerPdfAssets } from "@/lib/learner-documents/pdf";
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

export function LearnerDocumentEditor({ type, name, email, courses, initialCourse = "" }: {
  type: LearnerDocumentType; name: string; email: string; courses: { id: string; name: string }[]; initialCourse?: string;
}) {
  const [values, setValues] = useState(() => initialValues(name, email, initialCourse));
  const [rendered, setRendered] = useState<{ values: LearnerDocumentValues; bytes: Uint8Array } | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [errors, setErrors] = useState<ReturnType<typeof documentErrors>>({});
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const [showResident, setShowResident] = useState(false);
  const savedValues = useRef(values);
  const signatureJob = useRef(0);
  const application = type === "application";
  const pending = rendered?.values !== values;
  function update<K extends keyof LearnerDocumentValues>(key: K, value: LearnerDocumentValues[K]) {
    setValues(old => ({ ...old, [key]: value }));
    setErrors({});
    setNotice("");
  }
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (savedValues.current !== values) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [values]);
  useEffect(() => {
    let active = true;
    setPreviewError("");
    const timer = setTimeout(() => {
      void Promise.all([loadAssets(type), import("@/lib/learner-documents/pdf")])
        .then(([assets, renderer]) => renderer.renderLearnerDocument(type, values, assets))
        .then(bytes => { if (active) setRendered({ values, bytes }); })
        .catch(error => {
          if (active) { setRendered(null); setPreviewError(error instanceof Error ? error.message : "PDF를 만들지 못했습니다. 다시 시도해 주세요."); }
        });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [type, values, retry]);

  async function setSignature(dataUrl: string) {
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
      setNotice("표시된 항목을 확인해 주세요. 동의하지 않는 항목은 ‘동의하지 않음’을 선택할 수 있습니다.");
      document.getElementById(first)?.focus();
      return;
    }
    if (!rendered || pending || previewError) return;
    const blob = new Blob([Uint8Array.from(rendered.bytes)], { type: "application/pdf" });
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url; link.download = `${DOCUMENT_TITLES[type]}_${values.signedOn}.pdf`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    savedValues.current = values;
    setNotice("PDF를 내려받았습니다. 작성한 파일은 담당자가 안내한 방법으로 제출해 주세요.");
  }
  const input = (key: keyof LearnerDocumentValues) => ({ id: key, name: key, value: typeof values[key] === "string" ? values[key] as string : "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => update(key, e.target.value), error: errors[key] });
  return <div className="learner-document-editor min-h-screen bg-[#f3f6f8]">
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <div><p className="mb-1 text-[11px] font-bold tracking-[.16em] text-teal-700">U-LIFE · LEARNER DOCUMENTS</p>
          <h1 className="text-xl font-bold sm:text-2xl">{DOCUMENT_TITLES[type]}</h1></div>
        <span className="flex items-center gap-2 rounded-full bg-teal-50 px-4 py-2 text-xs font-semibold text-teal-800"><FileCheck2 size={16} />원본 서식 · PDF 1.7</span>
      </div>
    </div>
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-slate-600">정보를 입력하면 오른쪽 원본 서식에 바로 반영됩니다.</p>
        <DocumentPopup href={`/mypage/documents/${application ? "scholarship" : "application"}`} windowName={`learner-${application ? "scholarship" : "application"}`} className="font-semibold text-teal-800 underline underline-offset-4">{application ? "장학금 지급신청서" : "수강신청원서"} 별도 창 열기 ↗</DocumentPopup>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="min-w-0 space-y-5">
          <Section number="01" title="과정과 인적사항">
            <div className="space-y-5">
              <Field {...input("courseName")} label={application ? "신청과정명" : "과정명"} list="learner-courses" maxLength={100} hint="과정 목록에서 선택하거나 과정명을 직접 입력해 주세요." />
              <datalist id="learner-courses">{courses.map(c => <option key={c.id} value={c.name} />)}</datalist>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field {...input("name")} label="성명" maxLength={30} autoComplete="name" />
                <Field {...input("phone")} label="휴대전화" type="tel" maxLength={14} autoComplete="tel" placeholder="010-0000-0000" />
                {application && <Field {...input("birthDate")} label="생년월일" type="date" max={koreaToday()} hint="PDF에는 생년월일 6자리로 표시됩니다." />}
                <fieldset id="gender" tabIndex={-1}><legend className="mb-2 text-sm font-semibold text-slate-700">성별</legend>
                  <div className="flex min-h-11 gap-5">{([ ["male", "남"], ["female", "여"] ] as const).map(([value, label]) => <label key={value} className="flex items-center gap-2"><input type="radio" name="gender" checked={values.gender === value} onChange={() => update("gender", value)} />{label}</label>)}</div>
                  {errors.gender && <p className="mt-1 text-xs text-red-700">{errors.gender}</p>}
                </fieldset>
              </div>
              {application ? <>
                <Field {...input("email")} label="이메일 (선택)" type="email" maxLength={100} autoComplete="email" />
                <Field {...input("address")} label="자택주소" maxLength={100} autoComplete="street-address" />
                <fieldset id="purposes" tabIndex={-1}><legend className="mb-3 text-sm font-semibold text-slate-700">신청목적 <span className="font-normal text-slate-500">· 복수 선택 가능</span></legend>
                  <div className="flex flex-wrap gap-2">{PURPOSES.map(purpose => <label key={purpose} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm"><input type="checkbox" checked={values.purposes.includes(purpose)} onChange={e => update("purposes", e.target.checked ? [...values.purposes, purpose] : values.purposes.filter(p => p !== purpose))} />{purpose}</label>)}</div>
                  {errors.purposes && <p className="mt-2 text-xs text-red-700">{errors.purposes}</p>}
                </fieldset>
              </> : <div className="rounded-xl bg-slate-50 p-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field {...input("residentFront")} label="주민등록번호 앞자리" inputMode="numeric" maxLength={6} autoComplete="off" placeholder="6자리" />
                  <Field {...input("residentBack")} label="주민등록번호 뒷자리" type={showResident ? "text" : "password"} inputMode="numeric" maxLength={7} autoComplete="off" placeholder="7자리" />
                </div>
                <label className="mt-3 flex min-h-10 items-center gap-2 text-xs"><input type="checkbox" checked={showResident} onChange={e => setShowResident(e.target.checked)} />입력란의 뒷자리 표시</label>
                <p className="text-xs leading-5 text-slate-500">원본 양식에 따라 PDF 미리보기와 다운로드 파일에는 주민등록번호 전체가 표시됩니다.</p>
              </div>}
            </div>
          </Section>
          {!application && <Section number="02" title="장학금 계좌">
            <div className="grid gap-5 sm:grid-cols-2"><Field {...input("bank")} label="은행명" maxLength={20} /><Field {...input("accountHolder")} label="예금주" maxLength={30} /></div>
            <div className="mt-5"><Field {...input("account")} label="계좌번호 (본인명의)" maxLength={30} inputMode="numeric" autoComplete="off" hint="은행명과 계좌번호를 정확하게 확인해 주세요." /></div>
          </Section>}
          <Section number={application ? "02" : "03"} title="동의 내용 확인">
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
          </Section>
          <Section number={application ? "03" : "04"} title="작성일과 서명">
            <Field {...input("signedOn")} label="작성일" type="date" />
            <div id="signature" tabIndex={-1}><SignaturePad signatureUrl={values.signature} strokeWidth={4.8} onChange={dataUrl => void setSignature(dataUrl)} /></div>
            {errors.signature && <p className="mt-2 text-sm text-red-700">서명을 작성해 주세요.</p>}
          </Section>
          <p className="flex items-start gap-2 px-1 text-xs leading-5 text-slate-500"><ShieldCheck className="mt-0.5 shrink-0" size={16} />입력 내용은 서버에 자동 저장되지 않습니다. 창을 닫기 전에 PDF를 내려받아 주세요. PDF 다운로드만으로 수강신청이나 장학금 접수가 완료되지는 않습니다.</p>
        </div>
        <aside className="min-w-0 lg:sticky lg:top-5" aria-label="PDF 미리보기 및 다운로드">
          <div className="mb-3 flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-bold"><FileText size={18} className="text-teal-700" />PDF 미리보기</h2><span className="text-xs text-slate-500" role="status">{previewError ? "입력 확인 필요" : pending ? "반영 중…" : "최신 내용 반영됨"}</span></div>
          <div className="learner-pdf-preview"><PdfPreview bytes={rendered?.bytes ?? null} errorMessage={previewError} /></div>
          {previewError && <div role="alert" className="mt-3 rounded-xl bg-red-50 p-4 text-sm text-red-800">{previewError}<button type="button" className="ml-2 underline" onClick={() => setRetry(v => v + 1)}>다시 시도</button></div>}
          <button type="button" onClick={download} disabled={pending || !!previewError} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#123353] px-5 py-3 font-semibold text-white hover:bg-[#1d476d] disabled:cursor-wait disabled:opacity-50"><Download size={18} />작성한 PDF 다운로드</button>
          <p className="mt-2 text-center text-xs text-slate-500">A4 · 1페이지 · PDF 1.7</p>
          {notice && <p role="status" className="mt-3 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm leading-6 text-teal-900">{notice}</p>}
        </aside>
      </div>
    </div>
  </div>;
}
