"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DOCUMENTS, type ReportFile } from "@/lib/reports/types";
import { MAX_FILE_SIZE } from "@/lib/reports/validation";
export function ReportFiles({
  offering,
  files,
}: {
  offering: string;
  files: ReportFile[];
}) {
  const router = useRouter(),
    form = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [kind, setKind] = useState("result"),
    [remove, setRemove] = useState<string | null>(null);
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const data = new FormData(event.currentTarget),
        file = data.get("file");
      if (!(file instanceof File) || file.size > MAX_FILE_SIZE)
        throw new Error("파일은 4MB 이하로 올려 주세요.");
      const result = await fetch(`/api/course-reports/${offering}/files`, {
        method: "POST",
        body: data,
      });
      if (!result.ok) {
        const body = await result.json().catch(() => null);
        throw new Error(body?.message ?? "업로드에 실패했습니다.");
      }
      setMessage("파일이 저장되었습니다.");
      form.current?.reset();
      setKind("result");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "업로드에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }
  async function erase(id: string) {
    setBusy(true);
    try {
      const r = await fetch(`/api/course-reports/${offering}/files/${id}`, {
        method: "DELETE",
      });
      if (!r.ok) throw Error();
      setRemove(null);
      setMessage("파일이 삭제되었습니다.");
      router.refresh();
    } catch {
      setMessage("파일을 삭제하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel space-y-5" id="attachments">
      <h2 className="section-title">원본 PDF·운영사진 보관</h2>
      <p className="text-sm text-slate-600">
        원본 PDF는 서식별 1개, 사진은 최대 12장까지 보관합니다. 같은 서식에 다시
        올리면 기존 PDF를 교체합니다. 파일당 최대 4MB입니다.
      </p>
      <form ref={form} onSubmit={upload} className="grid gap-4 md:grid-cols-2">
        <label className="field">
          분류
          <select
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {DOCUMENTS.map(([key, label]) => (
              <option value={key} key={key}>
                {label} 원본
              </option>
            ))}
            <option value="photo">운영사진</option>
          </select>
        </label>
        <label className="field">
          파일
          <input
            name="file"
            type="file"
            accept={
              kind === "photo" ? "image/png,image/jpeg" : "application/pdf"
            }
            required
          />
        </label>
        <label className="field">
          사진 설명·촬영일 / 원본 메모
          <input name="caption" maxLength={300} />
        </label>
        <button className="btn-primary self-end" disabled={busy}>
          {busy ? "처리 중…" : "파일 저장"}
        </button>
      </form>
      {message && <p role="status">{message}</p>}
      <ul className="divide-y">
        {files.map((f) => (
          <li
            key={f.id}
            className="flex flex-wrap items-center justify-between gap-3 py-3"
          >
            <div>
              <a
                className="font-semibold text-teal-800 underline"
                href={`/api/course-reports/${offering}/files/${f.id}`}
                target="_blank"
                rel="noreferrer"
              >
                {f.filename}
              </a>
              <p className="text-sm text-slate-500">
                {f.kind === "photo"
                  ? "운영사진"
                  : DOCUMENTS.find((d) => d[0] === f.kind)?.[1]}{" "}
                · {Math.ceil(f.size / 1024)}KB · {f.caption}
              </p>
            </div>
            {remove === f.id ? (
              <div className="flex gap-4">
                <button
                  className="text-red-700"
                  disabled={busy}
                  onClick={() => erase(f.id)}
                >
                  삭제 확인
                </button>
                <button onClick={() => setRemove(null)}>취소</button>
              </div>
            ) : (
              <button
                disabled={busy}
                className="text-sm text-slate-500"
                onClick={() => setRemove(f.id)}
              >
                삭제
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
