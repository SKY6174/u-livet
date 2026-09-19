"use client";
import { useEffect, useState } from "react";
import { certificateState, kindLabel } from "@/lib/certificates/types";
type Result = {
  state: string;
  number?: string;
  kind?: string;
  organization?: string;
  name?: string;
  issued_at?: string;
  sha256?: string;
  test_only?: boolean;
};
export function VerifyForm() {
  const [token, setToken] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [pending, setPending] = useState(false);
  const [fileHash, setFileHash] = useState("");
  useEffect(() => {
    const value = window.location.hash.slice(1);
    if (/^[0-9a-f]{64}$/.test(value)) {
      setToken(value);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);
  return (
    <div className="panel max-w-3xl">
      <form
        className="space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          setResult(null);
          try {
            const r = await fetch("/api/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token }),
              cache: "no-store",
            });
            setResult(await r.json());
          } catch {
            setResult({ state: "UNAVAILABLE" });
          } finally {
            setPending(false);
          }
        }}
      >
        <label className="field">
          검증 코드
          <input
            value={token}
            onChange={(e) => setToken(e.target.value.trim())}
            maxLength={64}
            minLength={64}
            pattern="[0-9a-f]{64}"
            autoComplete="off"
            required
          />
        </label>
        <p className="text-sm text-slate-500">
          PDF의 QR을 이용하면 코드가 입력됩니다. 증명번호만으로 개인정보를
          검색하지 않습니다.
        </p>
        <button className="btn-primary" disabled={pending}>
          {pending ? "확인 중…" : "발급 상태 확인"}
        </button>
      </form>
      {result && (
        <section className="mt-6 space-y-4" aria-live="polite">
          <h2 className="section-title">
            {result.state === "ISSUED"
              ? "현재 유효한 발급 기록"
              : (certificateState[result.state] ??
                "서비스 연결을 확인해 주세요")}
          </h2>
          {result.test_only && (
            <p className="notice">
              검증용 문서입니다. 실제 사업단 증명이 아닙니다.
            </p>
          )}
          {result.number ? (
            <>
              <dl className="grid grid-cols-[6rem_1fr] gap-3 text-sm">
                <dt>증명번호</dt>
                <dd>{result.number}</dd>
                <dt>종류</dt>
                <dd>{kindLabel[result.kind ?? ""]}</dd>
                <dt>발급기관</dt>
                <dd>{result.organization}</dd>
                <dt>성명</dt>
                <dd>{result.name}</dd>
              </dl>
              <p className="text-sm">
                조회 결과는 원장의 현재 상태입니다. 제출받은 PDF 자체의 전자서명
                인증을 의미하지 않습니다.
              </p>
              <label className="field">
                PDF 원본 일치 확인 (선택)
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={async (e) => {
                    setFileHash("");
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 2000000) {
                      setFileHash("TOO_LARGE");
                      return;
                    }
                    const hash = await crypto.subtle.digest(
                      "SHA-256",
                      await file.arrayBuffer(),
                    );
                    setFileHash(
                      Array.from(new Uint8Array(hash), (b) =>
                        b.toString(16).padStart(2, "0"),
                      ).join(""),
                    );
                  }}
                />
              </label>
              <p className="text-xs text-slate-500">
                파일은 브라우저에서만 비교하며 서버로 전송하지 않습니다.
              </p>
              {fileHash && (
                <p className="notice">
                  {fileHash === "TOO_LARGE"
                    ? "2MB 이하 PDF를 선택하세요."
                    : fileHash === result.sha256
                      ? "보관 원본과 파일이 일치합니다."
                      : "보관 원본과 파일이 다릅니다. 발급기관에 확인하세요."}
                </p>
              )}
            </>
          ) : (
            <p>
              코드가 일치하지 않거나 조회가 제한되었을 수 있습니다. 확인되지
              않는다는 이유만으로 위조로 단정하지 않습니다.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
