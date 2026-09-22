"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Upload } from "lucide-react";
import { normalizeSheet, validWorkbook, type WorkbookInput, type WorkbookSummary } from "@/lib/course-budget/model";
import { readBudgetWorkbook, saveBudgetWorkbook } from "@/app/admin/courses/budget-actions";
import { MFA_REAUTH_MESSAGE } from "@/lib/auth/mfa-message";

export type ExecutionSource = { input: WorkbookInput | null; saved: boolean; busy: boolean; message: string };

export function ExecutionPanel({ org, workbooks, onSourceChange }: { org: string; workbooks: WorkbookSummary[]; onSourceChange?: (source: ExecutionSource) => void }) {
  const router = useRouter();
  const request = useRef(0);
  const [sheets, setSheets] = useState<{ sheet: string; data: unknown[][] }[]>([]);
  const [input, setInput] = useState<WorkbookInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selectedWorkbook, setSelectedWorkbook] = useState("");
  useEffect(() => { onSourceChange?.({ input, saved, busy, message }); }, [input, saved, busy, message, onSourceChange]);
  async function upload(file?: File) {
    const token = ++request.current;
    setSelectedWorkbook(""); setInput(null); setSheets([]); setSaved(false); setMessage(""); setQuery(""); setPage(0);
    if (!file) { setBusy(false); return; }
    if (!/\.xlsx$/i.test(file.name) || file.size > 5 * 1024 * 1024 || file.name.length > 200) { setBusy(false); setMessage("5MB 이하의 .xlsx 파일을 선택해 주세요. .xls 파일은 .xlsx로 저장한 뒤 선택하세요."); return; }
    setBusy(true);
    try {
      const { default: readWorkbook } = await import("read-excel-file/browser");
      const [parsed, digest] = await Promise.all([readWorkbook(file), crypto.subtle.digest("SHA-256", await file.arrayBuffer())]);
      if (token !== request.current) return;
      if (!parsed.length) throw new Error("읽을 수 있는 시트가 없습니다.");
      setSheets(parsed);
      const first = parsed.find(s => s.data.length >= 2) ?? parsed[0];
      const metadata = { file_name: file.name, sheet_name: first.sheet, sha256: Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join(""), header_row: 0 };
      setInput({ ...metadata, rows: [] });
      setInput({ ...metadata, rows: normalizeSheet(first.data) });
    } catch (e) { if (token === request.current) setMessage(e instanceof Error && /최대|용량|내용|시트/.test(e.message) ? e.message : "엑셀을 읽지 못했습니다. 암호화되지 않은 .xlsx 파일인지 확인해 주세요."); }
    finally { if (token === request.current) setBusy(false); }
  }
  function selectSheet(name: string) {
    const sheet = sheets.find(s => s.sheet === name);
    if (!sheet || !input) return;
    setSaved(false); setMessage(""); setPage(0); setQuery("");
    try { setInput({ ...input, sheet_name: name, header_row: 0, rows: normalizeSheet(sheet.data) }); }
    catch (e) { setInput({ ...input, sheet_name: name, header_row: 0, rows: [] }); setMessage(e instanceof Error ? e.message : "시트를 읽지 못했습니다."); }
  }
  const load = useCallback(async (id: string) => {
    if (!id) return;
    const token = ++request.current;
    setSelectedWorkbook(id); setBusy(true); setMessage(""); setInput(null); setSheets([]); setSaved(false); setPage(0); setQuery("");
    try {
      const result = await readBudgetWorkbook(org, id);
      if (token !== request.current) return;
      if (result.workbook) { setInput(result.workbook); setSaved(true); }
      else setMessage(result.message ?? "자료를 불러오지 못했습니다.");
    } catch { if (token === request.current) setMessage("자료를 불러오지 못했습니다. 다시 시도해 주세요."); }
    finally { if (token === request.current) setBusy(false); }
  }, [org]);
  const latestWorkbook = workbooks[0]?.id;
  useEffect(() => {
    const pending = request;
    if (latestWorkbook) void load(latestWorkbook);
    return () => { pending.current++; };
  }, [latestWorkbook, load]);
  async function save() {
    if (!input || !validWorkbook(input)) return;
    setBusy(true); setMessage("");
    try { const result = await saveBudgetWorkbook(org, input); setMessage(result.message); if (result.ok) { setSaved(true); router.refresh(); } }
    catch { setMessage("저장하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }
  const width = input ? Math.max(0, ...input.rows.map(r => r.length)) : 0;
  const rows = input?.rows.map((cells, index) => ({ cells, index })).filter(r => r.index > input.header_row && r.cells.some(c => c.trim()) && (!query || r.cells.join(" ").toLocaleLowerCase().includes(query.toLocaleLowerCase()))) ?? [];
  const pages = Math.max(1, Math.ceil(rows.length / 50));
  return <section className="space-y-5" aria-label="집행 엑셀 자료">
    <div><h3 className="font-bold">집행내역 원본 확인</h3><p className="mt-2 text-sm leading-6 text-slate-500">엑셀 파일의 시트와 제목 행을 선택해 집행내역을 확인하세요. 과정명과 항목명이 일치하는 내역은 위 비교 표에 함께 표시됩니다. 확인한 내역을 저장하면 다른 관리자와 공유됩니다.</p></div>
    <div className="grid gap-5 rounded-2xl border bg-white p-5 md:grid-cols-2">
      <label className="space-y-3"><span className="flex items-center gap-2 text-sm font-bold"><Upload size={18} />집행내역 엑셀 선택</span><input disabled={busy} type="file" accept=".xlsx" onChange={e => void upload(e.target.files?.[0])} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-4 file:py-2 file:font-semibold file:text-teal-800" /><span className="block text-xs text-slate-500">.xlsx · 최대 5MB · 시트당 2,000행 / 40열</span></label>
      <label className="text-sm font-bold">저장한 자료<select className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm mt-3 font-normal" disabled={busy || !workbooks.length} value={selectedWorkbook} onChange={e => void load(e.target.value)}><option value="">{workbooks.length ? "파일·시트를 선택하세요" : "아직 저장한 집행내역이 없습니다"}</option>{workbooks.map(w => <option key={w.id} value={w.id}>{w.file_name} · {w.sheet_name} · {new Date(w.created_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}</option>)}</select><span className="mt-2 block text-xs font-normal text-slate-500">최근 저장한 자료 50건 · 이전 자료도 보존됩니다.</span></label>
    </div>
    {busy && <p role="status" className="text-sm text-teal-800">처리 중입니다…</p>}
    {message && <p role="status" className="text-sm font-semibold text-teal-900">{message}</p>}
    {message === MFA_REAUTH_MESSAGE && <a href="/auth/security?next=%2Fadmin%2Fcourses" target="_blank" rel="noopener noreferrer" className="btn-secondary">추가 인증하기 (새 창)</a>}
    {input && <>
      <div className="flex flex-wrap items-center gap-4"><div className="mr-auto"><p className="flex items-center gap-2 font-bold"><FileSpreadsheet size={20} className="text-teal-700" />{input.file_name}</p><p className="mt-1 text-xs text-slate-500">{input.sheet_name} · {saved ? "저장된 조회 자료" : "저장 전 미리보기"}</p></div>
        {sheets.length > 0 && <label className="text-sm">시트<select className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm mt-1" value={input.sheet_name} disabled={busy} onChange={e => selectSheet(e.target.value)}>{sheets.map(s => <option key={s.sheet}>{s.sheet}</option>)}</select></label>}
        <label className="text-sm">제목 행<select className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm mt-1" value={input.header_row} disabled={busy || saved} onChange={e => { setInput({ ...input, header_row: Number(e.target.value) }); setPage(0); }}>
          {input.rows.slice(0, Math.min(50, input.rows.length - 1)).map((_, i) => <option key={i} value={i}>{i + 1}행</option>)}</select></label>
        <button className="btn-primary" type="button" disabled={busy || saved || !validWorkbook(input)} onClick={() => void save()}>{saved ? "저장됨" : "확인한 내역 저장"}</button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">{rows.length}행 · 엑셀에 기록된 값입니다. 수식은 다시 계산하지 않습니다.</p><label><span className="sr-only">집행내역 검색</span><input className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} placeholder="과정명·항목·내용 검색" /></label></div>
      <div role="region" aria-label="엑셀 집행내역" tabIndex={0} className="relative max-h-[600px] overflow-auto rounded-xl border bg-white"><table className="min-w-full text-left text-sm"><caption className="sr-only">{input.file_name} · {input.sheet_name}</caption><thead className="sticky top-0 bg-teal-900 text-white"><tr><th className="whitespace-nowrap p-3" scope="col">원본 행</th>{Array.from({ length: width }, (_, i) => <th key={i} scope="col" className="min-w-28 whitespace-nowrap p-3">{input.rows[input.header_row]?.[i] || `${i + 1}열`}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.slice(page * 50, page * 50 + 50).map(row => <tr key={row.index} className="even:bg-slate-50"><th scope="row" className="p-3 text-xs text-slate-400">{row.index + 1}</th>{Array.from({ length: width }, (_, i) => <td key={i} className="max-w-80 whitespace-pre-wrap break-words p-3 tabular-nums">{row.cells[i] || "—"}</td>)}</tr>)}</tbody></table></div>
      <div className="flex items-center justify-end gap-3 text-sm"><button type="button" className="btn-secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}>이전</button><span>{page + 1} / {pages}</span><button type="button" className="btn-secondary" disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)}>다음</button></div>
    </>}
    {!input && !busy && <div className="rounded-2xl border border-dashed bg-white px-6 py-12 text-center"><FileSpreadsheet className="mx-auto mb-3 text-teal-700" size={32} /><p className="font-semibold">엑셀 파일을 선택하거나 저장한 자료를 불러오세요</p><p className="mt-2 text-sm text-slate-500">재료비·인쇄비·강사료·운영비·보조인력·장학금·현수막 등 파일에 있는 항목을 확인할 수 있습니다.</p></div>}
  </section>;
}
