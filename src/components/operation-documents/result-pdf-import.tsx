"use client";
/* eslint-disable @next/next/no-img-element -- PDF photographs are private local previews. */
import { useState } from "react";
import { extractResultPdf } from "@/lib/operation-documents/pdf-import";
import type { Content } from "@/lib/operation-documents/model";
import { fields } from "@/lib/operation-documents/schema";

const RESULT_FIELDS = new Map(fields("result").map((field) => [field.key, field]));

export function ResultPdfImport({ courseId, disabled, content, onApply }: {
  courseId: string;
  disabled: boolean;
  content: Content;
  onApply: (fields: Record<string, string>, photos: Content["photos"], schedule: Record<string, string>[]) => boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [fileId, setFileId] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [photos, setPhotos] = useState<Content["photos"]>([]);
  const [schedule, setSchedule] = useState<Record<string, string>[]>([]);
  const [suggested, setSuggested] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [includePhotos, setIncludePhotos] = useState(true);
  const [includeSchedule, setIncludeSchedule] = useState(false);

  async function analyze(text: string) {
    const response = await fetch(`/api/operation-documents/${courseId}/import-ai`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.fields) throw new Error(result?.message || "AI 제안을 받지 못했습니다.");
    const proposal = Object.fromEntries(Object.entries(result.fields as Record<string, unknown>)
      .filter(([key, value]) => RESULT_FIELDS.has(key) && typeof value === "string" && value.trim())
      .map(([key, value]) => [key, String(value)]));
    setSuggested(proposal);
    setSelected(Object.keys(proposal).filter((key) => !content.fields[key]));
    setWarnings(Array.isArray(result.warnings) ? result.warnings.slice(0, 12) : []);
    const rows = Array.isArray(result.schedule) ? result.schedule.slice(0, 60) as Record<string, string>[] : [];
    setSchedule(rows);
    setIncludeSchedule(rows.length > 0 && content.tables.schedule.length === 0);
    setMessage("AI 제안이 준비되었습니다. 원본과 비교한 뒤 반영할 항목을 선택해 주세요.");
  }

  async function upload(file: File) {
    setBusy(true); setError(""); setMessage(""); setFileId(""); setSuggested({}); setPhotos([]); setSchedule([]);
    try {
      if (file.size < 1 || file.size > 4_194_304 || !file.name.toLowerCase().endsWith(".pdf"))
        throw new Error("4MB 이하의 PDF 결과보고서를 선택해 주세요.");
      const form = new FormData();
      form.set("kind", "result"); form.set("file", file); form.set("caption", "운영결과보고서 원본 · AI 가져오기");
      const saved = await fetch(`/api/course-reports/${courseId}/files`, { method: "POST", body: form });
      const savedBody = await saved.json().catch(() => null);
      if (!saved.ok || !savedBody?.fileId) throw new Error(savedBody?.message || "PDF를 보관하지 못했습니다.");
      setFileId(savedBody.fileId);
      setMessage("원본 PDF를 보관했습니다. 내용과 사진을 읽고 있습니다.");
      let extracted: Awaited<ReturnType<typeof extractResultPdf>>;
      try { extracted = await extractResultPdf(file); }
      catch (cause) {
        setError(`${cause instanceof Error ? cause.message : "PDF를 읽지 못했습니다."} 원본은 보관되어 있습니다.`);
        return;
      }
      setSourceText(extracted.text);
      setPhotos(extracted.photos);
      setMessage(`${extracted.pages}쪽을 읽고 사진 ${extracted.photos.length}장을 찾았습니다. AI가 내용 제안을 작성 중입니다.`);
      try { await analyze(extracted.text); }
      catch (cause) { setError(`${cause instanceof Error ? cause.message : "AI 분석 실패"} 사진은 아래에서 따로 반영할 수 있습니다.`); }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "업로드하지 못했습니다.");
    } finally { setBusy(false); }
  }

  const proposals = Object.entries(suggested);
  return (
    <section className="mb-5 rounded-2xl border border-teal-200 bg-white p-5" aria-label="기존 결과보고서 가져오기">
      <h2 className="text-lg font-bold">제출 완료된 결과보고서 PDF 가져오기</h2>
      <p className="mt-1 text-sm text-slate-600">원본을 보관하고 본문·사진을 읽어 현재 양식에 반영할 내용을 제안합니다. AI는 gpt-5.6-terra를 사용하며, 예산·장학금·서명은 가져오지 않습니다. 최종 반영과 제출은 작성자가 확인합니다.</p>
      <input className="mt-4 block w-full text-sm" type="file" accept="application/pdf,.pdf" disabled={disabled || busy}
        aria-label="제출된 결과보고서 PDF 업로드"
        onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ""; }} />
      {busy && <p className="mt-3 text-sm text-teal-800" role="status">PDF 보관·분석 중…</p>}
      {message && !busy && <p className="mt-3 text-sm text-teal-800" role="status">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
      {fileId && <a className="mt-2 inline-block text-sm text-teal-800 underline" href={`/api/course-reports/${courseId}/files/${fileId}`} target="_blank" rel="noreferrer">보관된 원본 PDF 확인</a>}
      {sourceText && !busy && !proposals.length && !schedule.length && <button type="button" className="btn-secondary ml-3 mt-2" onClick={async () => { setBusy(true); setError(""); try { await analyze(sourceText); } catch (cause) { setError(cause instanceof Error ? cause.message : "AI 분석 실패"); } finally { setBusy(false); } }}>AI 분석 다시 시도</button>}
      {warnings.length > 0 && <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><strong>원본 확인사항</strong><ul className="mt-1 list-disc pl-5">{warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}
      {proposals.length > 0 && <div className="mt-5 space-y-3"><h3 className="font-semibold">AI 제안 · 적용할 항목 선택</h3>
        <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border p-3">
          {proposals.map(([key, value]) => <label key={key} className="flex gap-3 rounded border-b py-2 text-sm last:border-0">
            <input type="checkbox" checked={selected.includes(key)} onChange={(event) => setSelected((previous) => event.target.checked ? [...previous, key] : previous.filter((item) => item !== key))} />
            <span><strong>{RESULT_FIELDS.get(key)?.label ?? key}</strong><span className="mt-1 block whitespace-pre-wrap text-slate-700">{value}</span></span>
          </label>)}
        </div>
      </div>}
      {schedule.length > 0 && <div className="mt-5"><label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={includeSchedule} onChange={(event) => setIncludeSchedule(event.target.checked)} /> 원본 강의표 {schedule.length}행 반영</label>
        <p className="mt-1 text-xs text-slate-500">기존 강의표를 교체합니다. 실제 강의일·시수와 대조해 주세요.</p>
        <div className="mt-2 max-h-32 overflow-y-auto text-sm text-slate-600">{schedule.slice(0, 8).map((row, index) => <p key={index}>{row.date} · {row.topic} · {row.instructor} · {row.hours}시간</p>)}</div>
      </div>}
      {photos.length > 0 && <div className="mt-5"><label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={includePhotos} onChange={(event) => setIncludePhotos(event.target.checked)} /> 원본의 사진 {photos.length}장 반영</label>
        <p className="mt-1 text-xs text-slate-500">사진 순서와 촬영일·설명은 원본과 비교해 주세요. 식별되지 않은 날짜는 비워 둡니다.</p>
        <div className="mt-3 flex gap-2 overflow-x-auto">{photos.slice(0, 8).map((photo, index) => <img key={index} src={photo.image} alt={`추출 사진 ${index + 1}`} className="h-20 w-24 shrink-0 rounded border object-cover" />)}</div>
      </div>}
      {(proposals.length > 0 || photos.length > 0 || schedule.length > 0) && <button type="button" className="btn-primary mt-5" disabled={disabled || busy || (!selected.length && (!includePhotos || !photos.length) && (!includeSchedule || !schedule.length))}
        onClick={() => { if (!onApply(Object.fromEntries(selected.map((key) => [key, suggested[key]])), includePhotos ? photos : [], includeSchedule ? schedule : [])) return; setPhotos([]); setSchedule([]); setSuggested({}); setSelected([]); setMessage("선택한 내용을 초안에 반영했습니다. 원본과 대조한 뒤 임시저장해 주세요."); }}>
        선택한 내용·사진 초안에 반영
      </button>}
    </section>
  );
}
