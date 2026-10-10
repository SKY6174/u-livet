"use client";

import { Info, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

const AUTO_HIDE_MS = 7000;
const BUBBLE_GAP = 12;
const VIEWPORT_PADDING = 20;
const MAX_BUBBLE_WIDTH = 576;

export function PageDescriptionHint({ label, children }: { label: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const bubbleId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [bubbleWidth, setBubbleWidth] = useState(MAX_BUBBLE_WIDTH);

  useEffect(() => {
    const button = buttonRef.current;
    if (!button) return;
    const updateWidth = () => setBubbleWidth(Math.max(0, Math.min(MAX_BUBBLE_WIDTH,
      window.innerWidth - button.getBoundingClientRect().right - BUBBLE_GAP - VIEWPORT_PADDING)));
    updateWidth();
    window.addEventListener("resize", updateWidth);
    const observer = new ResizeObserver(updateWidth);
    const titleRow = button.parentElement?.parentElement?.parentElement;
    if (titleRow) observer.observe(titleRow);
    return () => {
      window.removeEventListener("resize", updateWidth);
      observer.disconnect();
    };
  }, [label]);

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = null;
  }, []);
  const scheduleHide = useCallback((delay = AUTO_HIDE_MS) => {
    clearHideTimer();
    hideTimer.current = setTimeout(() => setOpen(false), delay);
  }, [clearHideTimer]);

  useEffect(() => {
    setOpen(true);
    scheduleHide();
    return clearHideTimer;
  }, [pathname, scheduleHide, clearHideTimer]);

  const close = () => {
    clearHideTimer();
    setOpen(false);
  };

  return <div className="mt-1 basis-full sm:basis-auto">
    <div className="relative inline-flex">
    <button
      ref={buttonRef}
      type="button"
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100"
      aria-label={`${label} 설명 ${open ? "닫기" : "보기"}`}
      aria-expanded={open}
      aria-controls={bubbleId}
      onClick={() => {
        if (open) close();
        else {
          setOpen(true);
          scheduleHide();
        }
      }}
      onMouseEnter={clearHideTimer}
      onMouseLeave={() => { if (open) scheduleHide(3000); }}
      onFocus={clearHideTimer}
      onBlur={() => { if (open) scheduleHide(3000); }}
      onKeyDown={event => { if (event.key === "Escape") close(); }}
    >
      <Info className="h-5 w-5" aria-hidden="true" />
    </button>
    <div
      id={bubbleId}
      hidden={!open}
      role="status"
      style={{ width: bubbleWidth }}
      className="absolute left-full top-1/2 z-30 ml-3 -translate-y-1/2 rounded-2xl border border-teal-200 bg-white text-sm leading-relaxed text-slate-700 shadow-xl before:absolute before:-left-2 before:top-1/2 before:h-4 before:w-4 before:-translate-y-1/2 before:rotate-45 before:border-b before:border-l before:border-teal-200 before:bg-white"
      onMouseEnter={clearHideTimer}
      onMouseLeave={() => scheduleHide(3000)}
      onFocusCapture={clearHideTimer}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) scheduleHide(3000); }}
      onKeyDown={event => {
        if (event.key === "Escape") {
          close();
          buttonRef.current?.focus();
        }
      }}
    >
      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="설명 닫기" onClick={close}><X className="h-5 w-5" aria-hidden="true" /></button>
      <div className="max-h-[50vh] overflow-y-auto p-5 pr-12">{children}</div>
    </div>
    </div>
  </div>;
}
