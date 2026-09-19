"use client";
import { useEffect, useState } from "react";
import { badgeLabel, type BadgeVerification } from "@/lib/badges/types";
import { BadgeMark } from "@/components/portal/badge-mark";
export function BadgeVerify() {
  const [token, setToken] = useState(""),
    [result, setResult] = useState<BadgeVerification | null>(null),
    [pending, setPending] = useState(false),
    [fileHash, setFileHash] = useState("");
  useEffect(() => {
    const raw = location.hash.slice(1);
    if (/^[0-9a-f]{64}$/.test(raw)) {
      setToken(raw);
      history.replaceState(null, "", location.pathname);
    }
  }, []);
  return (
    <div className="panel max-w-3xl">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          setResult(null);
          setFileHash("");
          try {
            const r = await fetch("/api/badges/verify", {
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
          공유 검증 코드
          <input
            value={token}
            onChange={(e) => {
              setToken(e.target.value.trim());
              setResult(null);
              setFileHash("");
            }}
            minLength={64}
            maxLength={64}
            pattern="[0-9a-f]{64}"
            autoComplete="off"
            required
          />
        </label>
        <p className="text-sm text-slate-500">
          공유가 철회되거나 만료된 안내문에 기반한 링크는 조회되지 않습니다.
          이름·배지번호로 다른 사람을 검색하지 않습니다.
        </p>
        <button className="btn-primary" disabled={pending}>
          {pending ? "확인 중…" : "배지 상태 확인"}
        </button>
      </form>
      {result && (
        <section className="mt-6 space-y-4" aria-live="polite">
          <h2 className="section-title">{badgeLabel(result.state)}</h2>
          {result.number ? (
            <>
              <div className="flex items-start gap-4">
                <BadgeMark />
                <div>
                  <h3 className="text-xl font-bold">{result.title}</h3>
                  <p className="mt-2">
                    {result.name} · {result.organization}
                  </p>
                </div>
              </div>
              {result.test_only && (
                <p className="notice">
                  검증용 배지입니다. 실제 기관 발급이 아닙니다.
                </p>
              )}
              <p className="whitespace-pre-wrap">{result.achievement}</p>
              <dl className="space-y-3 text-sm">
                {[
                  ["과정", result.course],
                  ["발급번호", result.number],
                  ["발급시각", result.issued_at],
                  ["만료시각", result.expires_at ?? "승인 기준상 없음"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="break-words">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="notice">
                현재 홈페이지 발급 원장 조회입니다. Open Badges 서명·외부 지갑
                인증이 아닙니다. 유효하지 않은 상태의 배지는 최신 증빙으로
                사용할 수 없습니다.
              </p>
              <label className="field">
                받은 배지 JSON 원본 비교 (선택)
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={async (e) => {
                    setFileHash("");
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 50000) {
                      setFileHash("TOO_LARGE");
                      return;
                    }
                    try {
                      const hash = await crypto.subtle.digest(
                        "SHA-256",
                        await file.arrayBuffer(),
                      );
                      setFileHash(
                        Array.from(new Uint8Array(hash), (x) =>
                          x.toString(16).padStart(2, "0"),
                        ).join(""),
                      );
                    } catch {
                      setFileHash("ERROR");
                    }
                  }}
                />
              </label>
              <p className="text-xs text-slate-500">
                파일은 브라우저에서만 비교하며 서버로 전송하지 않습니다. 내용이
                일치해도 현재 상태가 취소·만료·재검토이면 유효한 배지가
                아닙니다.
              </p>
              {fileHash && (
                <p className="notice">
                  {fileHash === "TOO_LARGE"
                    ? "50KB 이하 JSON을 선택하세요."
                    : fileHash === "ERROR"
                      ? "파일을 읽지 못했습니다."
                      : fileHash === result.sha256
                        ? "보관한 원본과 파일이 일치합니다."
                        : "보관한 원본과 다릅니다. 발급기관에 확인하세요."}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-600">
              공유되지 않았거나 코드가 바뀌었을 수 있습니다. 조회되지 않는다는
              이유만으로 위조로 판단하지 않습니다.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
