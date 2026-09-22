"use client";
/* eslint-disable @next/next/no-img-element -- PDF photographs are private local previews. */
import { useEffect, useState } from "react";
import { extractResultPdf, renderResultPdfPage } from "@/lib/operation-documents/pdf-import";
import { extractPdfFinance, type FinanceProposal } from "@/lib/operation-documents/pdf-finance";
import type { Budget, Content } from "@/lib/operation-documents/model";
import { fields } from "@/lib/operation-documents/schema";

const RESULT_FIELDS = new Map(fields("result").map((field) => [field.key, field]));
type SourceEvidence = { page: number; quote: string };

export function ResultPdfImport({ courseId, disabled, content, budget, budgetEditable, onApply, onRemoveSourceSignature }: {
  courseId: string;
  disabled: boolean;
  content: Content;
  budget: Budget;
  budgetEditable: boolean;
  onApply: (fields: Record<string, string>, photos: Content["photos"], schedule: Record<string, string>[], budget: Budget | null, sourceSignature?: Content["sourceSignature"]) => boolean;
  onRemoveSourceSignature: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [fileId, setFileId] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [photos, setPhotos] = useState<Content["photos"]>([]);
  const [schedule, setSchedule] = useState<Record<string, string>[]>([]);
  const [suggested, setSuggested] = useState<Record<string, string>>({});
  const [evidence, setEvidence] = useState<Record<string, SourceEvidence>>({});
  const [scheduleEvidence, setScheduleEvidence] = useState<(SourceEvidence | null)[]>([]);
  const [model, setModel] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [includePhotos, setIncludePhotos] = useState(true);
  const [includeSchedule, setIncludeSchedule] = useState(false);
  const [finance, setFinance] = useState<FinanceProposal>({ rows: [], scholarship: null });
  const [selectedBudget, setSelectedBudget] = useState<string[]>([]);
  const [includeScholarship, setIncludeScholarship] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pages, setPages] = useState(0);
  const [signaturePage, setSignaturePage] = useState(1);
  const [signaturePageImage, setSignaturePageImage] = useState("");
  const [signatureImage, setSignatureImage] = useState("");
  const [includeSignature, setIncludeSignature] = useState(false);
  const [existingFile, setExistingFile] = useState<{ id: string; filename: string; size: number } | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/course-reports/${courseId}/files`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((result) => { if (active) setExistingFile(result?.original ?? null); })
      .catch(() => { if (active) setExistingFile(null); });
    return () => { active = false; };
  }, [courseId]);

  async function analyze(text: string) {
    const response = await fetch(`/api/operation-documents/${courseId}/import-ai`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.fields) throw new Error(result?.message || "AI 제안을 받지 못했습니다.");
    const proposal = Object.fromEntries(Object.entries(result.fields as Record<string, unknown>)
      .filter(([key, value]) => RESULT_FIELDS.has(key) && typeof value === "string" && value.trim())
      .map(([key, value]) => [key, String(value)]));
    const sources = result.evidence && typeof result.evidence === "object" ? result.evidence as Record<string, SourceEvidence> : {};
    setSuggested(proposal);
    setEvidence(sources);
    setModel(result.model === "gpt-5.6-terra" ? result.model : "");
    setSelected(Object.keys(proposal).filter((key) => !content.fields[key] && Boolean(sources[key])));
    setWarnings(Array.isArray(result.warnings) ? result.warnings.slice(0, 12) : []);
    const rows = Array.isArray(result.schedule) ? result.schedule.slice(0, 60) as Record<string, string>[] : [];
    const rowSources = Array.isArray(result.scheduleEvidence) ? result.scheduleEvidence.slice(0, 60) as (SourceEvidence | null)[] : [];
    setSchedule(rows);
    setScheduleEvidence(rowSources);
    setIncludeSchedule(rows.length > 0 && rowSources.length === rows.length && rowSources.every(Boolean) && content.tables.schedule.length === 0);
    setMessage("AI 제안이 준비되었습니다. 원본과 비교한 뒤 반영할 항목을 선택해 주세요.");
  }

  async function process(file: File) {
    setMessage("원본 PDF의 내용과 사진을 읽고 있습니다.");
    let extracted: Awaited<ReturnType<typeof extractResultPdf>>;
    try { extracted = await extractResultPdf(file); }
    catch (cause) {
      setError(`${cause instanceof Error ? cause.message : "PDF를 읽지 못했습니다."} 원본은 보관되어 있습니다.`);
      return;
    }
    setSourceText(extracted.text);
    setPdfFile(file);
    setPages(extracted.pages);
    const money = extractPdfFinance(extracted.text);
    setFinance(money);
    setSelectedBudget(budgetEditable ? money.rows.filter((row) => !budget.rows.some((saved) => saved.category === row.category && (saved.planned || saved.spent))).map((row) => row.category) : []);
    setIncludeScholarship(budgetEditable && Boolean(money.scholarship) && !budget.scholarshipCount && !budget.scholarshipAmount);
    setPhotos(extracted.photos);
    setIncludePhotos(extracted.photos.some((photo) => !content.photos.some((saved) => saved.image === photo.image)));
    if (extracted.text.replace(/\s/g, "").length < 80) {
      setMessage(`${extracted.pages}쪽을 읽었습니다. 텍스트가 없는 PDF는 원본 서명 영역과 사진을 선택할 수 있으며, 내용·금액은 직접 입력해 주세요.`);
      return;
    }
    setMessage(`${extracted.pages}쪽을 읽고 사진 ${extracted.photos.length}장을 찾았습니다. AI가 내용 제안을 작성 중입니다.`);
    try { await analyze(extracted.text); }
    catch (cause) {
      setMessage(`${extracted.pages}쪽에서 사진 ${extracted.photos.length}장을 읽었습니다. 사진은 아래에서 따로 반영할 수 있습니다.`);
      setError(cause instanceof Error ? cause.message : "AI 제안을 받지 못했습니다.");
    }
  }

  async function loadExisting() {
    if (!existingFile) return;
    setBusy(true); setError(""); setMessage(""); setSuggested({}); setEvidence({}); setScheduleEvidence([]); setModel(""); setPhotos([]); setSchedule([]); setFinance({ rows: [], scholarship: null }); setSignatureImage(""); setSignaturePageImage(""); setPdfFile(null); setPages(0); setSourceText("");
    try {
      const response = await fetch(`/api/course-reports/${courseId}/files/${existingFile.id}`, { cache: "no-store" });
      if (!response.ok) throw new Error("보관된 원본 PDF를 불러오지 못했습니다.");
      const bytes = await response.blob();
      if (bytes.size > 4_194_304 || bytes.type !== "application/pdf") throw new Error("보관된 PDF 형식이나 크기를 확인해 주세요.");
      setFileId(existingFile.id);
      await process(new File([bytes], existingFile.filename, { type: "application/pdf" }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "원본을 불러오지 못했습니다."); }
    finally { setBusy(false); }
  }

  async function upload(file: File) {
    setBusy(true); setError(""); setMessage(""); setFileId(""); setSuggested({}); setEvidence({}); setScheduleEvidence([]); setModel(""); setPhotos([]); setSchedule([]); setFinance({ rows: [], scholarship: null }); setSignatureImage(""); setSignaturePageImage(""); setPdfFile(null); setPages(0); setSourceText("");
    try {
      if (file.size < 1 || file.size > 4_194_304 || !file.name.toLowerCase().endsWith(".pdf"))
        throw new Error("4MB 이하의 PDF 결과보고서를 선택해 주세요.");
      const form = new FormData();
      form.set("kind", "result"); form.set("file", file); form.set("caption", "운영결과보고서 원본 · AI 가져오기");
      const saved = await fetch(`/api/course-reports/${courseId}/files`, { method: "POST", body: form });
      const savedBody = await saved.json().catch(() => null);
      if (!saved.ok || !savedBody?.fileId) throw new Error(savedBody?.message || "PDF를 보관하지 못했습니다.");
      setFileId(savedBody.fileId);
      setExistingFile({ id: savedBody.fileId, filename: file.name, size: file.size });
      await process(file);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "업로드하지 못했습니다.");
    } finally { setBusy(false); }
  }

  async function showSignaturePage(page: number) {
    if (!pdfFile || page < 1 || page > pages) return;
    setBusy(true); setError(""); setSignatureImage(""); setIncludeSignature(false);
    try { setSignaturePageImage(await renderResultPdfPage(pdfFile, page)); setSignaturePage(page); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "PDF 페이지를 표시하지 못했습니다."); }
    finally { setBusy(false); }
  }

  async function pickSignature(event: React.MouseEvent<HTMLImageElement>) {
    const image = event.currentTarget;
    const bounds = image.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width * image.naturalWidth;
    const y = (event.clientY - bounds.top) / bounds.height * image.naturalHeight;
    const canvas = document.createElement("canvas");
    canvas.width = 260; canvas.height = 110;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "white"; context.fillRect(0, 0, 260, 110);
    context.drawImage(image, Math.max(0, Math.min(image.naturalWidth - 260, x - 130)), Math.max(0, Math.min(image.naturalHeight - 110, y - 55)), 260, 110, 0, 0, 260, 110);
    const result = canvas.toDataURL("image/jpeg", 0.76);
    if (result.length > 200_000) { setError("서명 이미지가 너무 큽니다."); return; }
    setSignatureImage(result); setIncludeSignature(false);
  }

  const proposals = Object.entries(suggested);
  const newPhotos = photos.filter((photo) => !content.photos.some((saved) => saved.image === photo.image));
  return (
    <section className="mb-5 rounded-2xl border border-teal-200 bg-white p-5" aria-label="기존 결과보고서 가져오기">
      <h2 className="text-lg font-bold">제출 완료된 결과보고서 PDF 가져오기</h2>
      <p className="mt-1 text-sm text-slate-600">원본 PDF에서 본문·사진·예산·장학금을 가져옵니다. 원본 서명이 있다면 해당 영역을 직접 선택해 별도 보존할 수 있습니다. 본문 AI 제안은 gpt-5.6-terra를 사용합니다. 최종 반영과 제출은 작성자가 확인합니다.</p>
      {existingFile && <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-3 text-sm">
        <span className="min-w-0 flex-1 truncate">보관된 원본: {existingFile.filename}</span>
        <button type="button" className="btn-secondary" disabled={disabled || busy} onClick={() => void loadExisting()}>이 원본으로 초안 만들기</button>
      </div>}
      <input className="mt-4 block w-full text-sm" type="file" accept="application/pdf,.pdf" disabled={disabled || busy}
        aria-label="제출된 결과보고서 PDF 업로드"
        onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ""; }} />
      {busy && <p className="mt-3 text-sm text-teal-800" role="status">PDF 내용·사진 분석 중…</p>}
      {message && !busy && <p className="mt-3 text-sm text-teal-800" role="status">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
      {fileId && <a className="mt-2 inline-block text-sm text-teal-800 underline" href={`/api/course-reports/${courseId}/files/${fileId}`} target="_blank" rel="noreferrer">보관된 원본 PDF 확인</a>}
      {sourceText && !busy && !proposals.length && !schedule.length && <button type="button" className="btn-secondary ml-3 mt-2" onClick={async () => { setBusy(true); setError(""); try { await analyze(sourceText); } catch (cause) { setError(cause instanceof Error ? cause.message : "AI 분석 실패"); } finally { setBusy(false); } }}>AI 분석 다시 시도</button>}
      {warnings.length > 0 && <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><strong>원본 확인사항</strong><ul className="mt-1 list-disc pl-5">{warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}
      {proposals.length > 0 && <div className="mt-5 space-y-3"><h3 className="font-semibold">AI 제안 · 적용할 항목 선택{model && <span className="ml-2 text-xs font-normal text-slate-500">{model}</span>}</h3>
        <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border p-3">
          {proposals.map(([key, value]) => <label key={key} className="flex gap-3 rounded border-b py-2 text-sm last:border-0">
            <input type="checkbox" checked={selected.includes(key)} onChange={(event) => setSelected((previous) => event.target.checked ? [...previous, key] : previous.filter((item) => item !== key))} />
            <span><strong>{RESULT_FIELDS.get(key)?.label ?? key}</strong><span className="mt-1 block whitespace-pre-wrap text-slate-700">{value}</span>
              {evidence[key] ? <span className="mt-1 block text-xs text-teal-800">원문 {evidence[key].page}쪽 · “{evidence[key].quote}”</span>
                : <span className="mt-1 block text-xs text-amber-800">원문 근거 자동 확인 실패 · PDF와 대조한 뒤 선택해 주세요.</span>}
            </span>
          </label>)}
        </div>
      </div>}
      {schedule.length > 0 && <div className="mt-5"><label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={includeSchedule} onChange={(event) => setIncludeSchedule(event.target.checked)} /> 원본 강의표 {schedule.length}행 반영</label>
        <p className="mt-1 text-xs text-slate-500">기존 강의표를 교체합니다. 실제 강의일·시수와 대조해 주세요.</p>
        <div className="mt-2 max-h-32 overflow-y-auto text-sm text-slate-600">{schedule.slice(0, 8).map((row, index) => <p key={index}>{row.date} · {row.topic} · {row.instructor} · {row.hours}시간 <span className={scheduleEvidence[index] ? "text-teal-800" : "text-amber-800"}>{scheduleEvidence[index] ? `· 원문 ${scheduleEvidence[index].page}쪽 “${scheduleEvidence[index].quote}”` : "· 근거 확인 필요"}</span></p>)}</div>
      </div>}
      {(finance.rows.length > 0 || finance.scholarship) && <div className="mt-5 rounded-lg border p-3 text-sm">
        <h3 className="font-semibold">예산집행·장학금 · 원문 확인 후 반영</h3>
        {!budgetEditable && <p className="mt-1 text-amber-800">예산 확정 후에는 금액을 바꿀 수 없습니다. 작성 중으로 되돌린 뒤 반영해 주세요.</p>}
        {finance.rows.map((row) => <label key={row.category} className="mt-2 flex gap-2">
          <input type="checkbox" disabled={!budgetEditable} checked={selectedBudget.includes(row.category)} onChange={(event) => setSelectedBudget((previous) => event.target.checked ? [...previous, row.category] : previous.filter((item) => item !== row.category))} />
          <span>{row.category} · 신청 {Number(row.planned).toLocaleString()}원 / 집행 {Number(row.spent).toLocaleString()}원 <small className="block text-teal-800">{row.evidence.page}쪽 · “{row.evidence.quote}”</small></span>
        </label>)}
        {finance.scholarship && <label className="mt-2 flex gap-2"><input type="checkbox" disabled={!budgetEditable} checked={includeScholarship} onChange={(event) => setIncludeScholarship(event.target.checked)} />
          <span>장학금 {finance.scholarship.count}명 · {Number(finance.scholarship.amount).toLocaleString()}원 <small className="block text-teal-800">{finance.scholarship.evidence.page}쪽 · “{finance.scholarship.evidence.quote}”</small></span>
        </label>}
      </div>}
      {pdfFile && <div className="mt-5 rounded-lg border p-3 text-sm">
        <h3 className="font-semibold">원본 서명 이미지 가져오기</h3>
        <p className="mt-1 text-slate-600">서명이 실제로 보이는 쪽을 열고 서명 중앙을 클릭해 영역을 확인해 주세요. 원본 서명은 현재 책임강사의 최종 제출 서명을 대신하지 않습니다.</p>
        <div className="mt-2 flex items-center gap-2"><label htmlFor="signature-page">PDF 쪽수</label><input id="signature-page" className="w-20 rounded border p-1" type="number" min={1} max={pages} value={signaturePage} onChange={(event) => setSignaturePage(Number(event.target.value))} /><button type="button" className="btn-secondary" disabled={busy} onClick={() => void showSignaturePage(signaturePage)}>쪽 열기</button></div>
        {signaturePageImage && <img src={signaturePageImage} alt={`${signaturePage}쪽 원본 PDF · 서명 중앙을 클릭`} className="mt-3 max-h-96 max-w-full cursor-crosshair border object-contain" onClick={(event) => void pickSignature(event)} />}
        {signatureImage && <div className="mt-3"><img src={signatureImage} alt="선택한 원본 서명 영역" className="h-28 w-64 border object-contain" /><label className="mt-2 flex gap-2"><input type="checkbox" checked={includeSignature} onChange={(event) => setIncludeSignature(event.target.checked)} /> 이 영역에 실제 서명이 있음을 확인했고, 원본 이미지로 보존합니다.</label></div>}
      </div>}
      {content.sourceSignature && <div className="mt-3 flex items-center gap-3 rounded-lg bg-slate-50 p-3 text-sm"><img src={content.sourceSignature.image} alt="현재 연결된 원본 서명" className="h-16 w-32 border object-contain" /><span>현재 원본 서명 · {content.sourceSignature.page}쪽</span><button type="button" className="btn-secondary" disabled={disabled} onClick={onRemoveSourceSignature}>원본 서명 연결 해제</button></div>}
      {photos.length > 0 && <div className="mt-5"><label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={includePhotos} disabled={newPhotos.length === 0} onChange={(event) => setIncludePhotos(event.target.checked)} /> 원본의 사진 {photos.length}장 중 새 사진 {newPhotos.length}장 반영</label>
        <p className="mt-1 text-xs text-slate-500">사진 순서와 촬영일·설명은 원본과 비교해 주세요. 식별되지 않은 날짜는 비워 둡니다.</p>
        <div className="mt-3 flex gap-2 overflow-x-auto">{photos.slice(0, 8).map((photo, index) => <img key={index} src={photo.image} alt={`추출 사진 ${index + 1}`} className="h-20 w-24 shrink-0 rounded border object-cover" />)}</div>
      </div>}
      {(proposals.length > 0 || photos.length > 0 || schedule.length > 0 || finance.rows.length > 0 || finance.scholarship || signatureImage) && <button type="button" className="btn-primary mt-5" disabled={disabled || busy || (!selected.length && (!includePhotos || !newPhotos.length) && (!includeSchedule || !schedule.length) && !selectedBudget.length && !includeScholarship && !(includeSignature && signatureImage))}
        onClick={() => {
          const picked = finance.rows.filter((row) => selectedBudget.includes(row.category));
          const nextBudget = picked.length || (includeScholarship && finance.scholarship) ? {
            ...budget,
            rows: [...budget.rows.filter((row) => !picked.some((item) => item.category === row.category)), ...picked.map(({ evidence: _evidence, ...row }) => row)],
            scholarshipCount: includeScholarship && finance.scholarship ? finance.scholarship.count : budget.scholarshipCount,
            scholarshipAmount: includeScholarship && finance.scholarship ? finance.scholarship.amount : budget.scholarshipAmount,
          } : null;
          if (!onApply(Object.fromEntries(selected.map((key) => [key, suggested[key]])), includePhotos ? newPhotos : [], includeSchedule ? schedule : [], nextBudget, includeSignature && signatureImage && fileId ? { image: signatureImage, page: signaturePage, fileId } : undefined)) return;
          setPhotos([]); setSchedule([]); setSuggested({}); setEvidence({}); setScheduleEvidence([]); setModel(""); setSelected([]); setFinance({ rows: [], scholarship: null }); setSelectedBudget([]); setIncludeScholarship(false); setSignatureImage(""); setIncludeSignature(false); setError(""); setMessage("선택한 내용을 초안에 반영했습니다. 원본과 대조한 뒤 임시저장해 주세요.");
        }}>
        선택한 내용·예산·장학금·서명 초안에 반영
      </button>}
    </section>
  );
}
