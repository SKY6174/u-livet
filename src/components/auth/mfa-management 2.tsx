"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeMfa, type MfaResult } from "@/app/auth/mfa-actions";
import type { SecurityStatus } from "@/lib/auth/mfa";
import type { MfaFactor } from "@/lib/auth/mfa-factor";

export function MfaManagement({ status, factors }: {
  status: SecurityStatus;
  factors: MfaFactor[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<MfaResult>({ message: "" });
  const verified = factors.filter((factor) => factor.verified);
  const cannotRemove = pending || !status.recent || (status.staff_required && verified.length <= 1);
  const remove = (id: string) => {
    if (cannotRemove) return;
    startTransition(async () => {
      try {
        const response = await removeMfa(id);
        setResult(response);
        if (response.ok) router.refresh();
      } catch {
        setResult({ message: "연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요." });
      }
    });
  };
  return (
    <details>
      <summary className="min-h-11 cursor-pointer font-semibold">
        연결된 인증 앱 관리
      </summary>
      {verified.length === 0 ? (
        <p>연결된 인증 앱이 없습니다.</p>
      ) : (
        <ul className="space-y-4">
          {verified.map((factor) => (
            <li key={factor.id} className="space-y-2">
              <p>{factor.name}</p>
              <button
                className="btn-secondary"
                type="button"
                disabled={cannotRemove}
                onClick={() => remove(factor.id)}
              >
                {pending ? "해제 중…" : "이 인증 앱 연결 해제"}
              </button>
            </li>
          ))}
        </ul>
      )}
      {status.staff_required && (
        <p className="mt-4 leading-7">
          관리자는 마지막 인증 앱을 해제할 수 없습니다. 교체할 인증 앱을
          먼저 추가해 주세요.
        </p>
      )}
      {status.staff_required && !status.recent && (
        <Link className="btn-secondary mt-4" href="/auth/security?next=%2Fmypage">
          추가 인증 후 관리하기
        </Link>
      )}
      {result.message && (
        <p role={result.ok ? "status" : "alert"} className={`mt-4 leading-7 ${result.ok ? "text-emerald-800" : "text-red-700"}`}>
          {result.message}
        </p>
      )}
    </details>
  );
}
