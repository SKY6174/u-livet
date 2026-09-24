"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, FileSpreadsheet, Plus, Upload, X } from "lucide-react";
import { exportMemberExcel, importMemberExcel } from "@/app/admin/accounts/excel-actions";
import { MEMBER_GROUPS, type MemberFilters, type MemberGroup } from "@/lib/members/model";
import { MEMBER_EXCEL_COLUMNS, memberExcelValues, parseMemberWorkbook, validateMemberExcelRows, type MemberExcelRow } from "@/lib/members/excel";

async function saveWorkbook(rows: string[][], filename: string) {
  const { default: write } = await import("write-excel-file/browser");
  await write(rows.map((row, index) => row.map(value => ({
    value, type: String,
    ...(index === 0 ? { fontWeight: "bold" as const, backgroundColor: "#E6F5F3" } : {}),
  }))), { columns: rows[0].map((_, index) => ({ width: index === 3 ? 32 : index === rows[0].length - 1 ? 36 : 22 })) }).toFile(filename);
}

export function MemberExcel({ group, query, filters, orgs, canEdit }: {
  group: MemberGroup; query: string; filters: MemberFilters; orgs: { org_id: string; org_name: string }[]; canEdit: boolean;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [org, setOrg] = useState(orgs[0]?.org_id ?? "");
  const [rows, setRows] = useState<MemberExcelRow[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const canUpload = canEdit || orgs.length > 0;
  const columns = MEMBER_EXCEL_COLUMNS[group];

  async function task(run: () => Promise<void>) {
    setBusy(true); setMessage(""); setError(false);
    try { await run(); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "엑셀 처리에 실패했습니다."); setError(true); }
    finally { setBusy(false); }
  }
  function reset() { setRows([]); setConfirmed(false); }
  async function upload(file?: File) {
    if (!file) return;
    reset();
    await task(async () => {
      if (!/\.xlsx$/i.test(file.name) || file.size > 2 * 1024 * 1024) throw Error("2MB 이하의 .xlsx 파일을 선택해 주세요.");
      const { default: read } = await import("read-excel-file/browser");
      const sheets = await read(file);
      const populated = sheets.filter(sheet => sheet.data.length > 0);
      if (populated.length !== 1) throw Error("작성한 자료는 한 개 시트에 넣어 주세요.");
      const parsed = parseMemberWorkbook(populated[0].data, group);
      validateMemberExcelRows(parsed, group, org);
      if (parsed.some(row => !!row.person_id) && !canEdit) throw Error("기존 구성원 수정은 시스템 관리자만 할 수 있습니다.");
      setRows(parsed);
    });
    if (fileInput.current) fileInput.current.value = "";
  }
  async function confirmImport() {
    await task(async () => {
      const result = await importMemberExcel(group, org, rows);
      if (!result.ok) throw Error(result.message);
      setMessage(result.message);
      reset();
      router.refresh();
    });
  }
  return <section aria-label="구성원 엑셀 관리" className="min-w-0 flex-1 basis-[650px] space-y-3">
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button type="button" className="btn-secondary !px-3 !py-2 text-sm" disabled={busy} onClick={() => void task(() => saveWorkbook([columns.map(([, label]) => label)], `${MEMBER_GROUPS[group]}-구성원-등록서식.xlsx`))}><FileSpreadsheet aria-hidden="true" size={16} />엑셀 서식</button>
      {canUpload && <>
        <button type="button" className="btn-secondary !px-3 !py-2 text-sm" disabled={busy} onClick={() => fileInput.current?.click()}><Upload aria-hidden="true" size={16} />엑셀 업로드</button>
        <input ref={fileInput} type="file" accept=".xlsx" className="sr-only" aria-label={`${MEMBER_GROUPS[group]} 구성원 엑셀 파일`} disabled={busy} onChange={event => void upload(event.target.files?.[0])} />
      </>}
      <button type="button" className="btn-secondary !px-3 !py-2 text-sm" disabled={busy} onClick={() => void task(async () => {
        const records = await exportMemberExcel(group, query, filters);
        await saveWorkbook([columns.map(([, label]) => label), ...records.map(record => memberExcelValues(group, record))], `${MEMBER_GROUPS[group]}-구성원-명부.xlsx`);
        setMessage(`${records.length}명의 명부를 내려받았습니다.`);
      })}><Download aria-hidden="true" size={16} />엑셀 다운로드</button>
      {orgs.length > 1 && <label className="flex items-center gap-2 text-sm">신규 등록 사업단<select className="rounded-lg border border-slate-300 px-3 py-2" value={org} disabled={busy} onChange={event => { setOrg(event.target.value); reset(); }}>{orgs.map(item => <option key={item.org_id} value={item.org_id}>{item.org_name}</option>)}</select></label>}
      {orgs.length > 0 && <Link className="btn-primary min-h-12 shrink-0 gap-2" href={`/admin/accounts/new?group=${group}`}><Plus aria-hidden="true" className="h-4 w-4" />구성원 수동 등록</Link>}
    </div>
    {message && <p role={error ? "alert" : "status"} className={error ? "text-sm text-red-700" : "text-sm text-teal-800"}>{message}</p>}
    {rows.length > 0 && <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm">
      <div className="flex justify-between gap-3"><h2 className="font-bold">업로드 미리보기 · 신규 {rows.filter(row => !row.person_id).length}명 · 수정 {rows.filter(row => !!row.person_id).length}명</h2><button type="button" aria-label="엑셀 업로드 취소" disabled={busy} onClick={reset}><X size={18} /></button></div>
      <p className="mt-2 text-slate-700">확정하면 파일 전체를 한 번에 저장합니다. 한 행이라도 실패하면 모두 취소됩니다. 사업단·교내 강사의 계정 활성화와 본인 인증은 별도로 진행됩니다.</p>
      <ol className="mt-3 max-h-40 overflow-y-auto border-t border-teal-200 pt-2">{rows.slice(0, 20).map((row, index) => <li key={row.person_id || row.request_id}>{index + 2}행 · {row.name} · {row.email || "이메일 미등록"} · {row.person_id ? "수정" : "신규"}</li>)}{rows.length > 20 && <li>외 {rows.length - 20}명</li>}</ol>
      <label className="mt-3 flex items-start gap-2"><input type="checkbox" className="mt-1" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} /><span>미리보기와 사업단을 확인했으며, 개인정보가 포함된 파일을 안전하게 관리하겠습니다.</span></label>
      <button type="button" className="btn-primary mt-3" disabled={busy || !confirmed} onClick={() => void confirmImport()}>{busy ? "저장 중…" : `${rows.length}명 저장 확정`}</button>
    </div>}
  </section>;
}
