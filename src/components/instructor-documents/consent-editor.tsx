"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CONSENT_TITLES,
  RELATION_QUESTIONS,
  emptyConsent,
  normalizeConsent,
  renderConsentPdf,
  type ConsentAssets,
  type ConsentForm,
  type ConsentType,
  type Choice,
} from "../../../supabase/functions/_shared/instructor-consent";
import { invoke } from "@/features/instructor-documents/services/committee-vote-service";
import { AdvisorySignaturePad } from "@/features/instructor-documents/components/advisory/advisory-signature-pad";
import { PdfPreview } from "./pdf-preview";
let assets: Promise<ConsentAssets> | undefined;
const loadAssets = () =>
  (assets ??= Promise.all(
    [
      "/fonts/KoPubDotum-Medium.ttf",
      "/fonts/KoPubDotum-Bold.ttf",
      "/forms/criminal-consent.pdf",
    ].map(async (url) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error("양식을 불러오지 못했습니다.");
      return new Uint8Array(await r.arrayBuffer());
    }),
  )
    .then(([regular, bold, criminal]) => ({ regular, bold, criminal }))
    .catch((e) => {
      assets = undefined;
      throw e;
    }));
type History = { id: string; status: string; submitted_at: string };
function ChoiceField({
  label,
  value,
  onChange,
  consent = false,
}: {
  label: string;
  value: Choice;
  onChange: (v: Choice) => void;
  consent?: boolean;
}) {
  return (
    <fieldset className="rounded-xl border border-slate-200 p-4">
      <legend className="px-1 text-sm font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-5">
        {(["YES", "NO"] as const).map((v) => (
          <label className="flex items-center gap-2 text-sm" key={v}>
            <input
              type="radio"
              checked={value === v}
              onChange={() => onChange(v)}
            />
            {v === "YES"
              ? consent
                ? "동의함"
                : "예"
              : consent
                ? "동의하지 않음"
                : "아니오"}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
export function ConsentEditor({
  type,
  token,
  name,
  onDirtyChange,
}: {
  type: ConsentType;
  token: string;
  name: string;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [form, setForm] = useState<ConsentForm>(() => emptyConsent(name)),
    [history, setHistory] = useState<History[]>([]),
    [loading, setLoading] = useState(true),
    [loadFailed, setLoadFailed] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [bytes, setBytes] = useState<Uint8Array | null>(null),
    [previewError, setPreviewError] = useState("");
  const requestId = useRef<string | null>(null),
    dirty = useRef(false);
  const load = useCallback(async () => {
    const context = await invoke<{ form: ConsentForm; history: History[] }>(
      "consent-context",
      { voter_token: token, document_type: type },
    );
    setForm(context.form);
    setHistory(context.history);
    dirty.current = false;
  }, [token, type]);
  useEffect(() => {
    let active = true;
    void invoke<{ form: ConsentForm; history: History[] }>("consent-context", {
      voter_token: token,
      document_type: type,
    })
      .then((c) => {
        if (active) {
          setForm(c.form);
          setHistory(c.history);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setMessage(e.message);
          setLoadFailed(true);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [token, type]);
  useEffect(() => {
    if (loading) return;
    let active = true;
    setBytes(null);
    setPreviewError("");
    const timer = setTimeout(() => {
      void loadAssets()
        .then((a) =>
          renderConsentPdf(type, normalizeConsent(type, form, name), a),
        )
        .then((b) => {
          if (active) setBytes(b);
        })
        .catch((e) => {
          if (active) setPreviewError(e.message);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [form, type, loading, name]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  const change = <K extends keyof ConsentForm>(
    key: K,
    value: ConsentForm[K],
  ) => {
    dirty.current = true;
    onDirtyChange(true);
    requestId.current = null;
    setForm((f) => ({ ...f, [key]: value }));
  };
  const input = (
    key: keyof ConsentForm,
    label: string,
    type = "text",
    maxLength = 60,
  ) => (
    <label className="field" key={key}>
      {label}
      <input
        type={type}
        value={String(form[key])}
        maxLength={maxLength}
        autoComplete="off"
        readOnly={key === "name"}
        onChange={(e) => change(key, e.target.value)}
      />
    </label>
  );
  const save = async (final: boolean) => {
    setBusy(true);
    setMessage("");
    try {
      const normalized = normalizeConsent(type, form, name, final);
      if (final) requestId.current ??= crypto.randomUUID();
      const result = await invoke<{ status?: string }>(
        final ? "consent-submit" : "consent-save-draft",
        {
          voter_token: token,
          document_type: type,
          form: normalized,
          request_id: requestId.current,
        },
      );
      dirty.current = false;
      onDirtyChange(false);
      if (final) {
        await load();
        requestId.current = null;
        setMessage(
          result.status === "DECLINED"
            ? "동의 거부 응답을 보관했습니다. 필수서류 완료로 집계되지 않습니다."
            : "서명한 PDF를 비공개 서류함에 제출했습니다.",
        );
      } else
        setMessage(
          "암호화된 초안을 저장했습니다. 최종 제출은 별도로 진행해 주세요.",
        );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };
  const download = () => {
    if (!bytes) return;
    const url = URL.createObjectURL(
      new Blob([bytes.slice().buffer as ArrayBuffer], {
        type: "application/pdf",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${CONSENT_TITLES[type]}-작성중.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };
  const stored = async (id: string) => {
    try {
      const result = await invoke<{ signed_url: string }>("consent-download", {
        voter_token: token,
        document_type: type,
        id,
      });
      const a = document.createElement("a");
      a.href = result.signed_url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.click();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "PDF를 열지 못했습니다.");
    }
  };
  if (loading)
    return (
      <p className="p-8" role="status">
        서류를 불러오고 있습니다…
      </p>
    );
  return (
    <section className="p-4 md:p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">{CONSENT_TITLES[type]}</h2>
        <p className="mt-2 text-sm text-slate-600">
          왼쪽에 내용을 입력하고 오른쪽 PDF를 확인한 뒤 본인이 서명하여
          제출하세요. 교외 강사·보조강사 필수서류입니다.
        </p>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 md:p-7">
          <fieldset
            disabled={busy || loadFailed}
            className={`space-y-5 ${busy || loadFailed ? "pointer-events-none opacity-60" : ""}`}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {input("name", "성명")}
              {input("date", "작성일", "date")}
            </div>
            {type === "PRIVACY_CONSENT" && (
              <>
                <div className="rounded-xl bg-blue-50 p-4 text-sm leading-7">
                  강사 위촉·교육 운영·수당 지급 및 세무 신고를 위해 개인정보를
                  활용합니다. 사업 증빙은 5년 보유하며, 세무 신고에 필요한
                  성명·주민등록번호·주소·지급 금액을 관할 세무서에 제공합니다.
                  상세 수집 항목과 동의 거부 안내는 오른쪽 PDF에서 확인하세요.
                </div>
                <ChoiceField
                  label="개인정보 수집·이용 및 제3자 제공"
                  value={form.privacy_consent}
                  onChange={(v) => change("privacy_consent", v)}
                  consent
                />
                <ChoiceField
                  label="고유식별정보(주민등록번호) 처리"
                  value={form.unique_id_consent}
                  onChange={(v) => change("unique_id_consent", v)}
                  consent
                />
              </>
            )}
            {type === "CRIMINAL_CONSENT" && (
              <>
                <p className="rounded-xl bg-blue-50 p-4 text-sm">
                  첨부해 주신 성범죄 경력 조회 동의서 원본 양식에 입력합니다.
                  주민등록번호와 서명은 암호화하여 비공개로 보관합니다.
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.is_foreign}
                    onChange={(e) => change("is_foreign", e.target.checked)}
                  />
                  외국인
                </label>
                {form.is_foreign ? (
                  <>
                    {input("english_name", "영문 성명")}
                    {input("birth_date", "생년월일", "date")}
                    {input("foreign_number", "외국인등록번호", "text", 20)}
                  </>
                ) : (
                  input("resident_number", "주민등록번호", "text", 14)
                )}
                {input("phone", "연락처", "tel", 24)}
                <label className="flex items-start gap-2 text-sm leading-6">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={form.criminal_consent}
                    onChange={(e) =>
                      change("criminal_consent", e.target.checked)
                    }
                  />
                  오른쪽 양식의 내용을 확인하였으며 성범죄 경력 조회에
                  동의합니다.
                </label>
              </>
            )}
            {type === "INTEGRITY_PLEDGE" && (
              <>
                {input("affiliation", "소속", "text", 70)}
                {input("program", "위촉 프로그램명", "text", 80)}
                <div className="grid gap-4 sm:grid-cols-2">
                  {input("period_start", "위촉 시작일", "date")}
                  {input("period_end", "위촉 종료일", "date")}
                </div>
                <h3 className="font-bold">사적 이해관계 확인</h3>
                {RELATION_QUESTIONS.map((q, i) => (
                  <ChoiceField
                    key={q}
                    label={`${i + 1}. ${q}`}
                    value={form.relations[i]}
                    onChange={(v) =>
                      change(
                        "relations",
                        form.relations.map((old, j) => (j === i ? v : old)),
                      )
                    }
                  />
                ))}
                {form.relations.includes("YES") && (
                  <div className="space-y-4 rounded-xl bg-amber-50 p-4">
                    {input("related_name", "해당 교직원 성명", "text", 40)}
                    {input("related_department", "소속 학부(과) / 부서")}
                    {input("relationship", "본인과의 관계")}
                  </div>
                )}
                <label className="flex items-start gap-2 text-sm leading-6">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={form.integrity_confirm}
                    onChange={(e) =>
                      change("integrity_confirm", e.target.checked)
                    }
                  />
                  오른쪽 청렴 서약 사항과 서약 및 확인 내용을 읽었으며, 기재
                  내용이 사실임을 확인하고 서약합니다.
                </label>
              </>
            )}
            <div>
              <h3 className="mb-3 font-bold">본인 서명</h3>
              <AdvisorySignaturePad
                strokeWidth={4.8}
                signatureUrl={form.signature}
                onChange={(value) => change("signature", value)}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void save(false)}
              >
                초안 저장
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void save(true)}
              >
                {busy ? "처리 중…" : "서명한 PDF 최종 제출"}
              </button>
            </div>
          </fieldset>
          {message && (
            <p role="status" className="notice whitespace-pre-wrap">
              {message}
            </p>
          )}
          {history.length > 0 && (
            <div className="border-t pt-4">
              <h3 className="font-bold">제출 이력</h3>
              <ul className="mt-3 space-y-2">
                {history.map((h) => (
                  <li
                    key={h.id}
                    className="flex flex-wrap justify-between gap-2 text-sm"
                  >
                    <span>
                      {new Date(h.submitted_at).toLocaleString("ko-KR")} ·{" "}
                      {h.status === "DECLINED" ? "동의 거부" : "제출 완료"}
                    </span>
                    <button
                      className="font-semibold text-blue-700 underline"
                      onClick={() => void stored(h.id)}
                    >
                      보관 PDF
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-slate-500">
                이전 서명은 새 문서에 자동 입력하지 않습니다. 재제출하면 새
                버전이 보관됩니다.
              </p>
            </div>
          )}
        </div>
        <aside className="space-y-3 xl:sticky xl:top-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">PDF 결과 미리보기</h3>
            <button
              className="btn-secondary !py-2 text-sm"
              disabled={!bytes}
              onClick={download}
            >
              작성 중 PDF 다운로드
            </button>
          </div>
          {previewError ? (
            <p role="alert" className="notice">
              {previewError}
            </p>
          ) : (
            <PdfPreview bytes={bytes} />
          )}
          <p className="text-xs text-slate-500">
            A4 · PDF 1.7 · KoPub Dotum / 최종 제출 전 미확정 문서
          </p>
        </aside>
      </div>
    </section>
  );
}
