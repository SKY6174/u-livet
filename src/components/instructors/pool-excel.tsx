"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload, FileSpreadsheet, X } from "lucide-react";
import {
  exportPoolData,
  importPoolPeople,
} from "@/app/instructor-pool-actions";
import {
  ACTIVITY_LABELS,
  KIND_LABELS,
  PAYMENT_LABELS,
  POOL_COLUMNS,
  parsePoolWorkbook,
  type PoolInput,
} from "@/lib/instructors/pool";
async function workbook(rows: (string | number)[][], name: string) {
  const { default: write } = await import("write-excel-file/browser");
  await write(
    rows.map((row, i) =>
      row.map((value) => ({
        value,
        type: typeof value === "number" ? Number : String,
        ...(i === 0
          ? { fontWeight: "bold" as const, backgroundColor: "#EAF1FF" }
          : {}),
      })),
    ),
    { columns: rows[0].map(() => ({ width: 22 })) },
  ).toFile(name);
}
export function PoolExcel({
  org,
  q,
  kind,
  person,
  tab,
}: {
  org: string;
  q: string;
  kind: string;
  person: string | null;
  tab: string;
}) {
  const router = useRouter(),
    input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [rows, setRows] = useState<{ request_key: string; payload: PoolInput }[]>(
      [],
    );
  async function task(run: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await run();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "엑셀 처리에 실패했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function template() {
    await task(() => workbook([POOL_COLUMNS], "강사-등록-서식.xlsx"));
  }
  async function upload(file?: File) {
    if (!file) return;
    setRows([]);
    await task(async () => {
      if (!/\.xlsx$/i.test(file.name) || file.size > 2 * 1024 * 1024)
        throw Error(".xlsx 파일은 2MB 이하로 선택해 주세요.");
      const { default: read } = await import("read-excel-file/browser");
      const sheets = await read(file);
      const populated = sheets.filter((sheet) => sheet.data.length > 0);
      if (populated.length !== 1)
        throw Error("등록할 자료는 한 개 시트에 작성해 주세요.");
      const parsed = parsePoolWorkbook(populated[0].data);
      setRows(
        parsed.map((payload) => ({
          request_key: crypto.randomUUID(),
          payload,
        })),
      );
    });
    if (input.current) input.current.value = "";
  }
  async function save() {
    await task(async () => {
      const result = await importPoolPeople(org, rows);
      if (!result.ok) throw Error(result.message);
      setMessage(`${rows.length}명의 강사를 등록했습니다.`);
      setRows([]);
      router.refresh();
    });
  }
  async function download() {
    await task(async () => {
      const data = await exportPoolData(org, q, kind, person, tab);
      if (tab === "payments")
        await workbook(
          [
            [
              "성명",
              "등록 당시 구분",
              "등록 당시 소속",
              "등록 당시 부서",
              "등록 당시 직위",
              "활동일",
              "활동유형",
              "활동명",
              "교육과정",
              "시간(분)",
              "시간당 단가",
              "산출액",
              "공제액",
              "실지급액",
              "상태",
              "지급일",
              "거래·결의번호",
              "근거",
              "취소 사유",
            ],
            ...data.allowances.map((a) => [
              a.name,
              KIND_LABELS[a.person_kind],
              a.instructor_snapshot.affiliation,
              a.instructor_snapshot.department,
              a.instructor_snapshot.position,
              a.activity_on,
              ACTIVITY_LABELS[a.activity_kind],
              a.title,
              a.offering_name ?? "",
              a.minutes,
              a.rate,
              a.gross,
              a.withholding,
              a.net,
              PAYMENT_LABELS[a.status],
              a.paid_on ?? "",
              a.reference,
              a.evidence,
              a.cancel_reason,
            ]),
          ],
          "강사-수당-지급대장.xlsx",
        );
      else
        await workbook(
          [
            [
              ...POOL_COLUMNS,
              "활동 상태",
              "참여 과정",
              "신분증",
              "통장사본",
              "이력서",
              "누적 실지급액",
            ],
            ...data.items.map((p) => [
              p.name,
              KIND_LABELS[p.kind],
              p.affiliation,
              p.department,
              p.position,
              p.specialty,
              p.phone,
              p.email,
              p.notes,
              p.status === "ACTIVE" ? "활동 중" : "활동 중지",
              p.courses,
              p.documents.id ? "제출" : "미제출",
              p.documents.bank ? "제출" : "미제출",
              p.documents.resume ? "제출" : "미제출",
              p.paid,
            ]),
          ],
          "강사-마스터-대장.xlsx",
        );
    });
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {tab !== "payments" && (
          <>
            <button
              className="btn-secondary !px-3 !py-2 text-sm"
              disabled={busy}
              onClick={() => void template()}
            >
              <FileSpreadsheet size={16} />
              등록 서식
            </button>
            <button
              className="btn-secondary !px-3 !py-2 text-sm"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              <Upload size={16} />
              엑셀 등록
            </button>
            <input
              ref={input}
              type="file"
              className="hidden"
              accept=".xlsx"
              aria-label="강사 등록 엑셀"
              disabled={busy}
              onChange={(e) => void upload(e.target.files?.[0])}
            />
          </>
        )}
        <button
          className="btn-secondary !px-3 !py-2 text-sm"
          disabled={busy}
          onClick={() => void download()}
        >
          <Download size={16} />
          {busy ? "처리 중…" : "엑셀 다운로드"}
        </button>
      </div>
      {message && (
        <p role="status" className="text-sm text-blue-800">
          {message}
        </p>
      )}
      {rows.length > 0 && (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <div className="flex justify-between gap-4">
            <h3 className="font-bold">등록 미리보기 · {rows.length}명</h3>
            <button
              disabled={busy}
              onClick={() => setRows([])}
              aria-label="엑셀 등록 취소"
            >
              <X size={18} />
            </button>
          </div>
          <p className="my-3 text-sm">
            새 강사로 등록합니다. 기존 명단과 동일한 성명·구분·소속이 있으면
            전체 등록을 중단합니다. 주민번호·계좌번호는 이 서식에 입력하지
            마세요.
          </p>
          <div className="max-h-48 overflow-auto text-sm">
            {rows.map((r, i) => (
              <p key={r.request_key} className="border-b border-blue-100 py-2">
                {i + 1}. {r.payload.name} · {KIND_LABELS[r.payload.kind]} ·{" "}
                {r.payload.affiliation || "소속 미입력"}
              </p>
            ))}
          </div>
          <button
            disabled={busy}
            className="btn-primary mt-4"
            onClick={() => void save()}
          >
            {busy ? "저장 중…" : `${rows.length}명 등록 확정`}
          </button>
        </section>
      )}
    </div>
  );
}
