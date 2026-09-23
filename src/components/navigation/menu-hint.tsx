"use client";

import { useEffect, useRef, useState } from "react";

type MenuHintProps = {
  label: string;
  description: string;
};

type Placement = { side: "right" | "left"; width: number };

/** Use inside a hoverable/focusable navigation link with the Tailwind `group` class. */
export function MenuHint({ label, description }: MenuHintProps) {
  const labelRef = useRef<HTMLSpanElement>(null);
  const [placement, setPlacement] = useState<Placement>({ side: "right", width: 256 });

  useEffect(() => {
    const measure = () => {
      const bounds = labelRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const rightSpace = Math.max(0, window.innerWidth - bounds.right - 16);
      const leftSpace = Math.max(0, bounds.left - 16);
      const side = rightSpace >= 192 || rightSpace >= leftSpace ? "right" : "left";
      const width = Math.min(256, side === "right" ? rightSpace : leftSpace);
      setPlacement((current) => current.side === side && current.width === width ? current : { side, width });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <span ref={labelRef} className="relative inline-block max-w-full">
      <span>{label}</span>
      <span className="sr-only"> — {description}</span>
      <span
        role="tooltip"
        aria-hidden="true"
        className={`pointer-events-none invisible absolute top-0 z-30 rounded-xl border border-pink-300/55 bg-pink-200/55 px-4 py-3 text-left font-normal normal-case leading-relaxed tracking-normal text-slate-600 opacity-0 shadow-xl transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100 group-focus-within:visible group-focus-within:opacity-100 after:absolute after:top-4 after:-translate-y-1/2 after:border-t-8 after:border-b-8 after:border-t-transparent after:border-b-transparent after:content-[''] ${placement.side === "right" ? "left-full ml-3 after:-left-3 after:border-r-[12px] after:border-r-pink-200/55" : "right-full mr-3 after:-right-3 after:border-l-[12px] after:border-l-pink-200/55"}`}
        style={{ fontSize: "calc(1em - 1.2px)", width: placement.width }}
      >
        {description}
      </span>
    </span>
  );
}
