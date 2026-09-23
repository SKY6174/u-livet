"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, X } from "lucide-react";

const MESSAGES = {
  created: "구성원을 등록했습니다.",
  saved: "구성원 정보를 저장했습니다.",
  deleted: "구성원을 삭제했습니다. 서비스 이용은 중지되고 기존 이력은 보존됩니다.",
};

export function MemberNotice({ kind }: { kind?: keyof typeof MESSAGES }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!kind) return;
    const url = new URL(window.location.href);
    // Consume only a fresh result, including when a cached page is revisited.
    if (url.searchParams.get(kind) !== "1") return;
    Object.keys(MESSAGES).forEach(key => url.searchParams.delete(key));
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    setVisible(true);
  }, [kind]);

  useEffect(() => {
    if (!visible) return;
    const dismiss = () => setVisible(false);
    const onAction = (event: Event) => {
      if (event.target instanceof Element && event.target.closest("a, button, input, select, textarea, [role='button']")) dismiss();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    const timer = window.setTimeout(dismiss, 5000);
    document.addEventListener("click", onAction, true);
    document.addEventListener("input", dismiss, true);
    document.addEventListener("submit", dismiss, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("popstate", dismiss);
    window.addEventListener("pagehide", dismiss);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("click", onAction, true);
      document.removeEventListener("input", dismiss, true);
      document.removeEventListener("submit", dismiss, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("popstate", dismiss);
      window.removeEventListener("pagehide", dismiss);
    };
  }, [visible]);

  if (!visible || !kind) return null;
  return <aside aria-label="작업 완료 알림" className="fixed bottom-6 left-4 right-4 z-50 flex items-start gap-3 rounded-2xl border border-teal-200 bg-white p-4 shadow-xl sm:left-auto sm:right-6 sm:w-96">
    <span aria-hidden="true" className="absolute -bottom-1.5 right-8 h-3 w-3 rotate-45 border-b border-r border-teal-200 bg-white" />
    <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
    <p role="status" aria-atomic="true" className="flex-1 text-sm font-medium leading-6 text-slate-800">{MESSAGES[kind]}</p>
    <button type="button" onClick={() => setVisible(false)} aria-label="완료 알림 닫기" className="-m-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700"><X aria-hidden="true" className="h-4 w-4" /></button>
  </aside>;
}
