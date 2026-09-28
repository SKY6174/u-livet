"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";

type MenuHintProps = {
  label: string;
  description: string;
};

type Placement = {
  side: "above" | "below";
  left: number;
  top: number;
  width: number;
  arrowLeft: number;
  fontSize: string;
};

const VIEWPORT_INSET = 16;
const CARD_GAP = 12;
const MAX_WIDTH = 256;

/** Use inside a hoverable/focusable navigation link with the Tailwind `group` class. */
export function MenuHint({ label, description }: MenuHintProps) {
  const labelRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);

  useEffect(() => {
    const link = labelRef.current?.closest(".group");
    if (!link) return;

    const show = () => {
      setPlacement(null);
      setOpen(true);
    };
    const hide = () => {
      if (!link.matches(":hover, :focus-within")) setOpen(false);
    };
    link.addEventListener("mouseenter", show);
    link.addEventListener("mouseleave", hide);
    link.addEventListener("focusin", show);
    link.addEventListener("focusout", hide);
    if (link.matches(":hover, :focus-within")) show();

    return () => {
      link.removeEventListener("mouseenter", show);
      link.removeEventListener("mouseleave", hide);
      link.removeEventListener("focusin", show);
      link.removeEventListener("focusout", hide);
    };
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const label = labelRef.current;
    const link = label?.closest(".group");
    const tooltip = tooltipRef.current;
    if (!label || !link || !tooltip) return;

    const measure = () => {
      const bounds = link.getBoundingClientRect();
      const width = Math.max(1, Math.min(MAX_WIDTH, window.innerWidth - VIEWPORT_INSET * 2));
      const fontSize = `calc(${getComputedStyle(label).fontSize} - 1.2px)`;
      tooltip.style.fontSize = fontSize;
      const height = tooltip.offsetHeight;
      const center = bounds.left + bounds.width / 2;
      const left = Math.max(VIEWPORT_INSET, Math.min(
        center - width / 2,
        window.innerWidth - width - VIEWPORT_INSET,
      ));
      const maxTop = Math.max(VIEWPORT_INSET, window.innerHeight - height - VIEWPORT_INSET);
      const menuLinks = Array.from(document.querySelectorAll("a.group, button.group"));
      const candidates = (["above", "below"] as const).map((side) => {
        const desiredTop = side === "above" ? bounds.top - height - CARD_GAP : bounds.bottom + CARD_GAP;
        const top = Math.max(VIEWPORT_INSET, Math.min(desiredTop, maxTop));
        let score = Math.abs(desiredTop - top) * width;
        for (const menuLink of menuLinks) {
          const card = menuLink.getBoundingClientRect();
          const overlapWidth = Math.max(0, Math.min(left + width, card.right) - Math.max(left, card.left));
          const overlapHeight = Math.max(0, Math.min(top + height, card.bottom) - Math.max(top, card.top));
          score += overlapWidth * overlapHeight;
        }
        return { side, top, score };
      });
      const { side, top } = candidates[1].score < candidates[0].score ? candidates[1] : candidates[0];
      const arrowLeft = Math.max(16, Math.min(center - left, width - 16));
      setPlacement({ side, left, top, width, arrowLeft, fontSize });
    };

    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open]);

  return (
    <span ref={labelRef} className="inline-block max-w-full">
      <span>{label}</span><span className="sr-only"> — {description}</span>
      {open && createPortal(
        <span
          ref={tooltipRef}
          role="tooltip"
          aria-hidden="true"
          className={`pointer-events-none fixed z-[100] rounded-xl border border-pink-300/55 bg-pink-200/35 px-4 py-3 text-left font-normal normal-case leading-relaxed tracking-normal text-slate-700 shadow-xl backdrop-blur-sm after:absolute after:left-[var(--hint-arrow-left)] after:-translate-x-1/2 after:border-x-8 after:border-x-transparent after:content-[''] ${placement ? "visible" : "invisible"} ${placement?.side === "above" ? "after:-bottom-3 after:border-t-[12px] after:border-t-pink-200/35" : "after:-top-3 after:border-b-[12px] after:border-b-pink-200/35"}`}
          style={{
            fontSize: placement?.fontSize ?? "calc(1em - 1.2px)",
            width: placement?.width ?? Math.max(1, Math.min(MAX_WIDTH, window.innerWidth - VIEWPORT_INSET * 2)),
            left: placement?.left ?? 0,
            top: placement?.top ?? 0,
            "--hint-arrow-left": `${placement?.arrowLeft ?? MAX_WIDTH / 2}px`,
          } as CSSProperties}
        >
          {description}
        </span>,
        document.body,
      )}
    </span>
  );
}
