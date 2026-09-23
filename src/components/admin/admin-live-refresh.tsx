"use client";

import { useCallback, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

const REFRESH_INTERVAL_MS = 30_000;

export function AdminLiveRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const refresh = useCallback(() => startTransition(() => router.refresh()), [router]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return (
    <button
      type="button"
      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:border-teal-300 hover:text-teal-800 disabled:cursor-wait disabled:opacity-60"
      onClick={refresh}
      disabled={pending}
    >
      <RefreshCw aria-hidden="true" className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
      {pending ? "갱신 중" : "지금 갱신"}
    </button>
  );
}
