type MenuHintProps = {
  label: string;
  description: string;
  align?: "start" | "end";
};

/** Use inside a hoverable/focusable navigation link with the Tailwind `group` class. */
export function MenuHint({ label, description, align = "start" }: MenuHintProps) {
  return (
    <span className="relative inline-block max-w-full">
      <span>{label}</span>
      <span className="sr-only"> — {description}</span>
      <span
        role="tooltip"
        aria-hidden="true"
        className={`pointer-events-none invisible absolute top-full z-30 mt-3 w-80 max-w-[calc(100vw-3rem)] rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal normal-case leading-relaxed tracking-normal text-slate-600 opacity-0 shadow-xl transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100 group-focus-within:visible group-focus-within:opacity-100 after:absolute after:-top-1.5 after:h-3 after:w-3 after:rotate-45 after:border-l after:border-t after:border-slate-200 after:bg-slate-50 ${align === "end" ? "right-0 text-left after:right-5" : "left-0 text-left after:left-5"}`}
        style={{ fontSize: "calc(1em - 1.2px)" }}
      >
        {description}
      </span>
    </span>
  );
}
