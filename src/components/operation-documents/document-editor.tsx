"use client";
/* eslint-disable @next/next/no-img-element -- Local embedded images are private form values. */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  FileText,
  Eye,
  Save,
  Send,
  CheckCircle2,
  Plus,
  Trash2,
} from "lucide-react";
import { AdvisorySignaturePad } from "@/features/instructor-documents/components/advisory/advisory-signature-pad";
import { DocumentPreview } from "./document-preview";
import {
  sections,
  documentLabel,
  ACADEMIES,
  type DocumentKind,
  type Field,
  type Table,
} from "@/lib/operation-documents/schema";
import {
  initialDocument,
  blankRow,
  missingContent,
  validContent,
  validBudget,
  emptyBudget,
  STATUS_LABELS,
  RESULT_STATUS_LABELS,
  type DocumentContext,
  type CourseInfo,
  type Content,
  type Budget,
} from "@/lib/operation-documents/model";

async function photoData(file: File): Promise<string> {
  if (
    !["image/jpeg", "image/png"].includes(file.type) ||
    file.size > 12_000_000
  )
    throw new Error("12MB 이하의 JPG·PNG 사진을 선택해 주세요.");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas"),
      scale = Math.min(1, 1000 / Math.max(img.width, img.height));
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("사진을 처리하지 못했습니다.");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.7, 0.55, 0.4]) {
      const image = canvas.toDataURL("image/jpeg", quality);
      if (image.length <= 400_000) return image;
    }
    throw new Error("사진 용량이 큽니다. 크기를 줄인 후 다시 선택해 주세요.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function DocumentEditor({
  initial,
  kind,
  courseOptions,
}: {
  initial: DocumentContext;
  kind: DocumentKind;
  courseOptions: Pick<CourseInfo, "id" | "name" | "starts_on">[];
}) {
  const router = useRouter();
  const [context, setContext] = useState(initial),
    first = initialDocument(initial, kind);
  const [doc, setDoc] = useState(first),
    [content, setContent] = useState<Content>(first.content),
    [budget, setBudget] = useState<Budget>(first.budget);
  const [section, setSection] = useState("cover"),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false),
    [note, setNote] = useState(""),
    [responsible, setResponsible] = useState(
      initial.responsible?.person_id ?? "",
    ),
    [preview, setPreview] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null),
    manager = context.manager;
  const locked =
      doc.status === "SUBMITTED" ||
      (kind === "plan"
        ? doc.status === "REVIEW" && !manager
        : doc.status === "DRAFT" && !manager),
    readonly = locked || busy;
  const allSections = [
    ...sections(kind),
    {
      key: "budget",
      label:
        kind === "plan" ? "9. 예산계획 · 담당자" : "5·8. 예산·장학금 · 담당자",
    },
    { key: "submit", label: "작성 확인 · 제출" },
  ];
  const selected = allSections.find((s) => s.key === section)!;
  useEffect(() => {
    const prevent = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  useEffect(() => {
    const node = previewRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      node.style.setProperty(
        "--paper-zoom",
        String(Math.min(1, (entries[0].contentRect.width - 24) / 794)),
      );
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [preview]);
  function change(next: Content | ((previous: Content) => Content)) {
    setContent((previous) => {
      const updated = typeof next === "function" ? next(previous) : next;
      if (
        kind === "result" &&
        previous.signature &&
        updated.signature === previous.signature &&
        (updated.fields !== previous.fields ||
          updated.tables !== previous.tables ||
          updated.photos !== previous.photos)
      )
        return { ...updated, signature: "" };
      return updated;
    });
    setDirty(true);
    setConfirmed(false);
    setMessage("");
  }
  function changeBudget(next: Budget) {
    setBudget(next);
    setDirty(true);
    setConfirmed(false);
    setMessage("");
  }
  function adopt(next: DocumentContext) {
    const saved = initialDocument(next, kind);
    setContext(next);
    setDoc(saved);
    setContent(saved.content);
    setBudget(saved.budget);
    setDirty(false);
  }
  async function request(body: Record<string, unknown>) {
    const response = await fetch(
      `/api/operation-documents/${context.course.id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, ...body }),
      },
    );
    const result = await response.json();
    if (!response.ok || !result.context)
      throw new Error(
        result.message || "저장하지 못했습니다. 로그인 상태를 확인해 주세요.",
      );
    return result.context as DocumentContext;
  }
  async function act(intent: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      let revision = doc.revision;
      if (
        ["save", "review", "submit"].includes(intent) &&
        (dirty || revision === 0)
      ) {
        if (!validContent(content, kind) || (manager && !validBudget(budget)))
          throw new Error("날짜·숫자·사진 및 입력 길이를 확인해 주세요.");
        const next = await request({
          intent: "save",
          revision,
          content,
          budget: manager ? budget : null,
        });
        revision = next.documents.find((d) => d.kind === kind)!.revision;
        adopt(next);
      }
      if (intent !== "save") {
        if (intent === "submit" || (intent === "review" && kind === "plan")) {
          const missing = missingContent(content, kind);
          if (missing.length)
            throw new Error(`작성 필요: ${missing.join(", ")}`);
        }
        if (kind === "result" && intent === "submit" && !content.signature)
          throw new Error("책임강사 서명 후 최종 제출해 주세요.");
        if (["review", "submit"].includes(intent) && !confirmed)
          throw new Error("작성 내용을 확인한 후 확인란에 체크해 주세요.");
        const next = await request({ intent, revision, note, confirmed });
        adopt(next);
        setConfirmed(false);
        setNote("");
      }
      setMessage(
        intent === "save"
          ? "임시저장되었습니다. 다음 접속에서도 이어서 작성할 수 있습니다."
          : intent === "review"
            ? kind === "result"
              ? "예산을 확정했습니다. 책임강사가 내용을 작성하고 서명할 수 있습니다."
              : "담당자에게 검토를 요청했습니다."
            : intent === "submit"
              ? "최종 제출본이 보관되었습니다."
              : "작성 상태로 변경되었습니다.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
  async function assign() {
    if (dirty) {
      setError("책임강사를 변경하기 전에 현재 내용을 저장해 주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      adopt(
        await request({
          intent: "assign",
          person: responsible,
          revision: context.responsible?.revision ?? 0,
        }),
      );
      setMessage("책임강사가 지정되었습니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "지정하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
  const base = `/operation-documents/${context.course.id}`;
  return (
    <div className="op-editor mx-auto max-w-[1600px] px-4 py-8 sm:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[.15em] text-teal-700">
            COURSE DOCUMENTS
          </p>
          <h1 className="mt-2 text-2xl font-bold">{documentLabel(kind)}</h1>
          <p className="mt-2 text-slate-600">{context.course.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn-secondary" href={`/operation-documents/${kind}`}>
            {kind === "plan" ? "운영계획서 목록" : "결과보고서 목록"}
          </Link>
          <Link
            className="btn-secondary"
            href={`${base}/${kind === "plan" ? "result" : "plan"}`}
          >
            {kind === "plan" ? "운영결과보고서" : "운영계획서"}
          </Link>
          <Link
            className="btn-secondary"
            href={
              manager
                ? `/admin/offerings/${context.course.id}/reports`
                : `/instructor/offerings/${context.course.id}`
            }
          >
            {manager ? "출결·지급 증빙" : "강의 운영"}
          </Link>
        </div>
      </div>
      <div className="mb-6 grid gap-3 rounded-2xl border border-teal-100 bg-teal-50/50 p-5 sm:grid-cols-3">
        {(kind === "result"
          ? ["담당자 예산 입력", "책임강사 내용 입력", "서명 후 최종 제출"]
          : ["책임강사 내용 작성", "담당자 예산·내용 검토", "담당자 최종 제출"]
        ).map((label, i) => (
          <div key={label} className="flex items-center gap-3">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${i === (doc.status === "DRAFT" ? 0 : doc.status === "REVIEW" ? 1 : 2) ? "bg-teal-800 text-white" : "bg-white text-teal-700"}`}
            >
              {i + 1}
            </span>
            <span className="text-sm font-semibold">{label}</span>
          </div>
        ))}
      </div>
      {manager && (
        <details
          className="mb-5 rounded-xl border bg-white p-4"
          open={!context.responsible}
        >
          <summary className="cursor-pointer font-semibold">
            책임강사: {context.responsible?.name ?? "미지정"}
          </summary>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="field min-w-64 flex-1">
              이 과정에 배정된 강사
              <select
                value={responsible}
                onChange={(e) => setResponsible(e.target.value)}
                disabled={busy}
              >
                <option value="">책임강사 선택</option>
                {context.candidates.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="btn-secondary"
              onClick={assign}
              disabled={!responsible || busy}
            >
              책임강사 지정
            </button>
            <Link
              className="text-sm text-teal-800 underline"
              href={`/admin/offerings/${context.course.id}/manage`}
            >
              강사 배정 관리
            </Link>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            책임강사만 이 과정의 문서를 작성할 수 있습니다. 변경 시 검토 중인
            문서는 작성 중으로 돌아가며 기존 최종 제출본은 보존됩니다.
          </p>
        </details>
      )}
      {first.revision === 0 && (
        <p className="notice mb-4">
          과정 기본정보{context.legacy ? "·기존 결과보고서 집계" : ""}
          {kind === "result" && context.documents.some((d) => d.kind === "plan")
            ? "·운영계획서"
            : ""}
          를 불러온 초안입니다. 내용과 시간은 실제 운영 내역에 맞게 확인해
          주세요.
        </p>
      )}
      <div className="sticky top-32 z-20 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white/95 p-3 shadow-sm">
        <div>
          <span className="badge">{(kind === "result" ? RESULT_STATUS_LABELS : STATUS_LABELS)[doc.status]}</span>
          <span className="ml-3 text-xs text-slate-500" aria-live="polite">
            {busy
              ? "처리 중…"
              : dirty
                ? "저장하지 않은 변경사항"
                : doc.revision
                  ? `저장됨 · v${doc.revision}`
                  : "아직 저장되지 않음"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-secondary gap-1 lg:hidden"
            onClick={() => setPreview(!preview)}
          >
            <Eye size={16} />
            {preview ? "입력하기" : "A4 미리보기"}
          </button>
          <Link
            href={`${base}/${kind}/print`}
            target="_blank"
            className="btn-secondary gap-1"
            onClick={(e) => {
              if (dirty) {
                e.preventDefault();
                setError("출력 전에 변경사항을 저장해 주세요.");
              }
            }}
          >
            <FileText size={16} />
            저장본 출력
          </Link>
          <button
            className="btn-primary gap-1"
            disabled={readonly || (!dirty && doc.revision > 0)}
            onClick={() => act("save")}
          >
            <Save size={16} />
            임시저장
          </button>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="mb-4 rounded-xl bg-teal-50 p-4 text-sm text-teal-800"
        >
          {message}
        </p>
      )}
      {doc.return_note && (
        <p className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          보완 요청: {doc.return_note}
        </p>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className={`${preview ? "hidden lg:block" : ""} min-w-0`}>
          <nav aria-label="양식 항목" className="mb-5 flex flex-wrap gap-2">
            {allSections.map((s) => (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                aria-pressed={section === s.key}
                className={`rounded-lg border px-3 py-2 text-sm ${section === s.key ? "border-teal-700 bg-teal-800 text-white" : "bg-white text-slate-600"}`}
              >
                {s.label}
              </button>
            ))}
          </nav>
          <section className="rounded-2xl border bg-white p-5 sm:p-6">
            <h2 className="mb-4 text-lg font-bold">{selected.label}</h2>
            {selected.fields?.some((field) => field.key === "title") && (
              <div className="field mb-5">
                <label htmlFor="operation-course-select">과정명</label>
                <span className="text-xs font-normal text-slate-400">검토 요청 시 필수</span>
                <select
                  id="operation-course-select"
                  value={context.course.id}
                  onChange={(event) => {
                    const nextId = event.target.value;
                    if (nextId === context.course.id) return;
                    if (dirty) {
                      setError("다른 과정으로 이동하기 전에 변경사항을 저장해 주세요.");
                      return;
                    }
                    router.push(`/operation-documents/${nextId}/${kind}`);
                  }}
                >
                  {courseOptions.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name} · {course.starts_on}
                    </option>
                  ))}
                </select>
                <span className="text-xs font-normal text-slate-500">
                  다른 과정을 선택하면 해당 과정의 {documentLabel(kind)}로 이동합니다.
                </span>
                {content.fields.title !== context.course.name && (
                  <span className="text-xs font-normal text-amber-800">
                    저장된 표기: {content.fields.title || "없음"}.{" "}
                    {!readonly && (
                      <button
                        type="button"
                        className="underline"
                        onClick={() =>
                          change({
                            ...content,
                            fields: { ...content.fields, title: context.course.name },
                          })
                        }
                      >
                        등록 과정명으로 맞추기
                      </button>
                    )}
                  </span>
                )}
              </div>
            )}
            <fieldset
              disabled={readonly}
              className="space-y-5 disabled:opacity-80"
            >
              {selected.fields?.filter((field) => field.key !== "title").map((f) => (
                <Input
                  key={f.key}
                  field={f}
                  value={content.fields[f.key]}
                  options={
                    f.key === "academy"
                      ? Array.from(new Set([context.course.academy, ...ACADEMIES])).filter(Boolean)
                      : undefined
                  }
                  onChange={(value) =>
                    change({
                      ...content,
                      fields: { ...content.fields, [f.key]: value },
                    })
                  }
                />
              ))}
              {selected.tables?.map((t) => (
                <Rows
                  key={t.key}
                  table={t}
                  rows={content.tables[t.key]}
                  change={(rows) =>
                    change({
                      ...content,
                      tables: { ...content.tables, [t.key]: rows },
                    })
                  }
                />
              ))}
              {kind === "result" && section === "performance" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {content.photos.map((p, i) => (
                    <div className="rounded-xl border p-3" key={i}>
                      <p className="font-semibold">{p.caption}</p>
                      <input
                        aria-label={`${p.caption} 촬영일`}
                        type="date"
                        value={p.date}
                        onChange={(e) =>
                          change({
                            ...content,
                            photos: content.photos.map((v, j) =>
                              j === i ? { ...v, date: e.target.value } : v,
                            ),
                          })
                        }
                        className="my-2 w-full rounded border p-2"
                      />
                      {p.image && (
                        <img
                          src={p.image}
                          className="mb-2 h-28 w-full rounded object-contain"
                          alt={p.caption}
                        />
                      )}
                      <input
                        aria-label={`${p.caption} 업로드`}
                        type="file"
                        accept="image/jpeg,image/png"
                        className="w-full text-xs"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const image = await photoData(file);
                            change((previous) => ({
                              ...previous,
                              photos: previous.photos.map((v, j) =>
                                j === i ? { ...v, image } : v,
                              ),
                            }));
                          } catch (cause) {
                            setError(
                              cause instanceof Error
                                ? cause.message
                                : "사진 오류",
                            );
                          }
                        }}
                      />
                      {p.image && (
                        <button
                          type="button"
                          className="mt-2 text-xs text-red-700"
                          onClick={() =>
                            change({
                              ...content,
                              photos: content.photos.map((v, j) =>
                                j === i ? { ...v, image: "" } : v,
                              ),
                            })
                          }
                        >
                          사진 삭제
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {section === "cover" && kind === "plan" && (
                <div>
                  <h3 className="text-sm font-semibold">
                    담당교수 서명 (선택)
                  </h3>
                  <AdvisorySignaturePad
                    signatureUrl={content.signature}
                    onChange={(signature) => {
                      if (!readonly) change({ ...content, signature });
                    }}
                  />
                  <p className="text-xs text-slate-500">
                    서명은 본인이 직접 입력합니다. 검토 요청·제출 계정과 시각은
                    별도로 기록됩니다.
                  </p>
                </div>
              )}
            </fieldset>
            {section === "budget" && (
              <>
                <p className="mb-4 text-sm text-slate-500">
                  {manager
                    ? "담당자가 예산 금액과 산출내역을 확인합니다. 해당 없는 금액도 0을 입력하세요."
                    : "예산은 담당자가 입력합니다. 책임강사는 내용을 확인할 수 있습니다."}
                </p>
                <fieldset disabled={readonly || !manager || (kind === "result" && doc.status !== "DRAFT")} className="space-y-4">
                  {budget.rows.map((r, i) => (
                    <div className="rounded-xl border bg-slate-50 p-4" key={i}>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <input
                          aria-label={`예산 ${i + 1} 항목`}
                          value={r.category}
                          maxLength={1000}
                          onChange={(e) =>
                            changeBudget({
                              ...budget,
                              rows: budget.rows.map((v, j) =>
                                j === i
                                  ? { ...v, category: e.target.value }
                                  : v,
                              ),
                            })
                          }
                          className="min-w-0 bg-transparent font-bold"
                        />
                        <button
                          type="button"
                          aria-label={`${r.category} 예산행 삭제`}
                          disabled={budget.rows.length <= 1}
                          onClick={() =>
                            changeBudget({
                              ...budget,
                              rows: budget.rows.filter((_, j) => j !== i),
                            })
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {(kind === "plan"
                          ? ["calculation", "planned", "note"]
                          : ["planned", "spent", "note"]
                        ).map((key) => (
                          <label className="field" key={key}>
                            {
                              {
                                calculation: "산출내역",
                                planned:
                                  kind === "plan"
                                    ? "금액 (원)"
                                    : "신청예산 (원)",
                                spent: "집행예산 (원)",
                                note: "비고",
                              }[key]
                            }
                            <input
                              type={
                                ["planned", "spent"].includes(key)
                                  ? "number"
                                  : "text"
                              }
                              min={0}
                              max={999999999999}
                              maxLength={1000}
                              value={r[key as keyof typeof r]}
                              onChange={(e) =>
                                changeBudget({
                                  ...budget,
                                  rows: budget.rows.map((v, j) =>
                                    j === i
                                      ? { ...v, [key]: e.target.value }
                                      : v,
                                  ),
                                })
                              }
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="btn-secondary"
                      disabled={budget.rows.length >= 30}
                      onClick={() =>
                        changeBudget({
                          ...budget,
                          rows: [
                            ...budget.rows,
                            {
                              category: "추가 항목",
                              calculation: "",
                              planned: "",
                              spent: "",
                              note: "",
                            },
                          ],
                        })
                      }
                    >
                      예산 항목 추가
                    </button>
                    {budget.rows.length === 1 &&
                      budget.rows[0].planned === "" && (
                        <button
                          className="btn-secondary"
                          onClick={() => changeBudget(emptyBudget(kind))}
                        >
                          기본 예산 항목 불러오기
                        </button>
                      )}
                  </div>
                  {kind === "result" && (
                    <div className="space-y-3 border-t pt-4">
                      <h3 className="font-bold">8. 장학금 지원</h3>
                      {[
                        "scholarshipCount",
                        "scholarshipAmount",
                        "scholarshipNote",
                      ].map((key) => (
                        <label className="field" key={key}>
                          {
                            {
                              scholarshipCount: "인원수",
                              scholarshipAmount: "장학금액 (원)",
                              scholarshipNote: "비고",
                            }[key]
                          }
                          <input
                            type={key === "scholarshipNote" ? "text" : "number"}
                            min={0}
                            maxLength={1000}
                            value={budget[key as keyof Omit<Budget, "rows">]}
                            onChange={(e) =>
                              changeBudget({ ...budget, [key]: e.target.value })
                            }
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </fieldset>
              </>
            )}
            {section === "submit" && (
              <div className="space-y-5">
                <p className="text-sm leading-6 text-slate-600">
                  {kind === "result"
                    ? "담당자가 예산계획·집행현황과 장학금 내역을 입력하고 확정합니다. 이어 책임강사가 운영 결과를 완성하고 본인 서명 후 최종 제출합니다."
                    : "예산을 제외한 모든 항목을 작성해 주세요. 해당 없는 내용은 “해당 없음”과 사유를 적습니다. 책임강사가 검토를 요청하면 담당자가 예산과 내용을 완성하여 최종 제출합니다."}
                </p>
                {(kind === "plan" || doc.status !== "DRAFT") && missingContent(content, kind).length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-sm font-semibold text-amber-800">
                      작성할 항목 {missingContent(content, kind).length}개
                    </summary>
                    <ul className="mt-2 list-inside list-disc text-xs leading-6 text-slate-600">
                      {missingContent(content, kind).map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  </details>
                )}
                {kind === "result" && doc.status === "DRAFT" && !manager && (
                  <p className="notice">담당자가 예산을 입력·확정하면 이곳에서 결과 내용을 작성할 수 있습니다.</p>
                )}
                {kind === "result" && doc.status === "REVIEW" && !manager && (
                  <div>
                    <h3 className="text-sm font-semibold">책임강사 서명 (최종 제출 필수)</h3>
                    <AdvisorySignaturePad
                      signatureUrl={content.signature}
                      onChange={(signature) => {
                        if (!readonly) change({ ...content, signature });
                      }}
                    />
                    <p className="text-xs text-slate-500">내용과 저장본 미리보기를 모두 확인한 뒤 본인이 직접 서명해 주세요. 서명 후 내용을 수정하면 다시 서명해야 합니다.</p>
                  </div>
                )}
                {doc.status !== "SUBMITTED" && (
                  <label className="flex items-start gap-3 text-sm leading-6">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                      disabled={busy || locked}
                      className="mt-1"
                    />
                    {kind === "result"
                      ? doc.status === "DRAFT"
                        ? "예산계획·집행금액과 장학금 내역을 모두 입력했으며 책임강사에게 전달합니다."
                        : "운영 결과 전체와 저장본 미리보기를 확인하고 본인이 서명하여 최종 제출합니다."
                      : manager && doc.status === "REVIEW"
                        ? "내용과 예산계획·집행금액을 확인했으며 이 버전을 최종 제출합니다."
                        : "예산을 제외한 작성 내용과 미리보기를 확인했습니다."}
                  </label>
                )}
                {doc.status === "DRAFT" && (kind === "plan" || manager) && (
                  <button
                    className="btn-primary gap-2"
                    disabled={busy || !confirmed}
                    onClick={() => act("review")}
                  >
                    <Send size={16} />
                    {kind === "result" ? "예산 확정 · 책임강사에게 전달" : "담당자 검토 요청"}
                  </button>
                )}
                {(kind === "plan" ? manager : !manager) && doc.status === "REVIEW" && (
                  <button
                    className="btn-primary gap-2"
                    disabled={busy || !confirmed || (kind === "result" && !content.signature)}
                    onClick={() => act("submit")}
                  >
                    <CheckCircle2 size={16} />
                    {kind === "result" ? "서명 후 최종 제출" : "최종 제출"}
                  </button>
                )}
                {kind === "result" && manager && doc.status === "REVIEW" && (
                  <p className="notice">예산이 확정되었습니다. 책임강사가 내용 작성과 서명을 마치면 최종 제출됩니다. 예산을 수정하려면 아래에서 예산 입력 단계로 되돌려 주세요.</p>
                )}
                {kind === "plan" && !manager && doc.status === "REVIEW" && (
                  <p className="notice">
                    담당자가 검토하고 있습니다. 보완 요청을 받으면 다시 작성할
                    수 있습니다.
                  </p>
                )}
                {manager && doc.status !== "DRAFT" && (
                  <div className="border-t pt-4">
                    <label className="field">
                      {doc.status === "SUBMITTED"
                        ? "수정 재개 사유"
                        : "보완 요청 내용"}
                      <textarea
                        maxLength={2000}
                        rows={3}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                      />
                    </label>
                    <button
                      disabled={busy || !note.trim() || dirty}
                      className="btn-secondary mt-3"
                      onClick={() =>
                        act(doc.status === "SUBMITTED" ? "reopen" : "return")
                      }
                    >
                      {doc.status === "SUBMITTED"
                        ? "수정 재개"
                        : kind === "result" ? "예산 입력 단계로 되돌리기" : "책임강사에게 보완 요청"}
                    </button>
                  </div>
                )}
                <a
                  className="inline-block text-sm text-teal-800 underline"
                  target="_blank"
                  rel="noreferrer"
                  href={`/forms/operation-${kind}.pdf`}
                >
                  첨부 원본 양식·작성 안내 보기
                </a>
              </div>
            )}
          </section>
          <section className="mt-5 rounded-xl border bg-white p-5">
            <h2 className="font-bold">최종 제출 이력</h2>
            {context.submissions.filter((s) => s.kind === kind).length ? (
              context.submissions
                .filter((s) => s.kind === kind)
                .map((s) => (
                  <p key={s.id} className="mt-3 text-sm">
                    <Link
                      className="text-teal-800 underline"
                      target="_blank"
                      href={`${base}/${kind}/print?submission=${s.id}`}
                    >
                      v{s.revision} 제출본 보기
                    </Link>{" "}
                    ·{" "}
                    {new Intl.DateTimeFormat("ko-KR", {
                      timeZone: "Asia/Seoul",
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(s.submitted_at))}{" "}
                    · {s.name}
                  </p>
                ))
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                {kind === "result"
                  ? "책임강사가 서명 후 최종 제출하면 제출본이 보관됩니다."
                  : "담당자가 최종 제출하면 제출본이 보관됩니다."}
              </p>
            )}
          </section>
        </div>
        <aside
          className={`${preview ? "" : "hidden lg:block"} min-w-0 lg:sticky lg:top-52`}
        >
          <div className="mb-3 flex items-center justify-between text-sm">
            <h2 className="font-semibold">A4 미리보기</h2>
            <span className="text-slate-500">
              {dirty ? "현재 입력 내용 · 저장 전" : "저장된 내용"}
            </span>
          </div>
          <div ref={previewRef} className="op-preview-scroll">
            <DocumentPreview
              kind={kind}
              content={content}
              budget={budget}
              status={dirty ? "DRAFT" : doc.status}
              revision={doc.revision}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
function Input({
  field: f,
  value,
  onChange,
  options,
}: {
  field: Field;
  value: string;
  onChange: (value: string) => void;
  options?: string[];
}) {
  return (
    <label className="field">
      {f.label}
      {f.required && (
        <span className="text-xs font-normal text-slate-400">
          검토 요청 시 필수
        </span>
      )}
      {options ? (
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{f.label} 선택</option>
          {Array.from(new Set(value ? [value, ...options] : options)).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : f.type === "long" ? (
        <textarea
          rows={5}
          maxLength={f.max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          type={
            f.type === "number" ? "number" : f.type === "date" ? "date" : "text"
          }
          min={0}
          step={f.type === "number" ? ".01" : undefined}
          maxLength={f.max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
function Rows({
  table,
  rows,
  change,
}: {
  table: Table;
  rows: Record<string, string>[];
  change: (rows: Record<string, string>[]) => void;
}) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">{table.label}</h3>
      {rows.map((row, i) => (
        <div key={i} className="rounded-xl border bg-slate-50 p-4">
          <div className="mb-3 flex justify-between text-sm font-semibold">
            <span>
              {i + 1}
              {table.key === "schedule" ? "회차" : "."}
            </span>
            <button
              type="button"
              aria-label={`${table.label} ${i + 1}행 삭제`}
              onClick={() => change(rows.filter((_, j) => i !== j))}
            >
              <Trash2 size={16} />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {table.columns.map((f) => (
              <Input
                key={f.key}
                field={f}
                value={row[f.key]}
                onChange={(value) =>
                  change(
                    rows.map((r, j) =>
                      i === j ? { ...r, [f.key]: value } : r,
                    ),
                  )
                }
              />
            ))}
          </div>
        </div>
      ))}
      <button
        type="button"
        className="btn-secondary gap-2"
        disabled={rows.length >= table.max}
        onClick={() => change([...rows, blankRow(table.columns)])}
      >
        <Plus size={16} />
        {table.key === "schedule" ? "회차 추가" : "행 추가"}
      </button>
    </div>
  );
}
export function OperationPrintControls({ title }: { title: string }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="no-print mx-auto max-w-4xl space-y-3 p-5">
      <div className="flex gap-3">
        <button
          className="btn-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const { downloadReportPdf17 } =
                await import("@/lib/pdf/report-export");
              await downloadReportPdf17(
                `${title.replace(/[\\/:*?"<>|]/g, "_")}.pdf`,
              );
            } catch (e) {
              setError(e instanceof Error ? e.message : "출력 오류");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "PDF 준비 중…" : "PDF 1.7 다운로드"}
        </button>
        <button
          className="btn-secondary"
          onClick={async () => {
            await document.fonts.ready;
            await Promise.all(
              Array.from(
                document.querySelectorAll<HTMLImageElement>(".op-output img"),
              ).map((i) => i.decode()),
            );
            window.print();
          }}
        >
          종이 인쇄
        </button>
      </div>
      <p className="text-sm text-slate-500">
        PDF 파일은 PDF 1.7 다운로드를 사용해 주세요. 종이 인쇄의 브라우저 PDF
        저장은 버전을 보장하지 않습니다. 최종 제출 전 문서는 검토용 초안으로 표시됩니다.
      </p>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
