"use client";
import Link from "next/link";
import { useId, useState } from "react";
import type { WorkspaceLink } from "@/lib/auth/workspace-navigation";

export function MenuSearch({ sections, onSelect }: { sections: { title: string; links: WorkspaceLink[] }[]; onSelect?: () => void }) {
  const id = useId(), [query, setQuery] = useState(""), [open, setOpen] = useState(false), [active, setActive] = useState(-1);
  const normalized = query.trim().replace(/\s/g, "").toLowerCase();
  const matches = normalized ? sections.flatMap(section => section.links.map(link => ({ ...link, group: section.title }))).filter(link => `${link.label}${link.description}${link.group}`.replace(/\s/g, "").toLowerCase().includes(normalized)).slice(0, 12) : [];
  const expanded = open && !!normalized;
  return <div className="relative mb-4 w-full text-sm" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
    <label className="field" htmlFor={id}>관리자 메뉴 검색</label>
    <input id={id} role="combobox" autoComplete="off" aria-autocomplete="list" aria-expanded={expanded} aria-controls={`${id}-results`} aria-activedescendant={expanded && active >= 0 ? `${id}-${active}` : undefined}
      placeholder="예: 수강생, 강사, 수강료, 환불" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3" value={query} onFocus={() => setOpen(true)} onChange={e => { setQuery(e.target.value); setActive(-1); setOpen(true); }}
      onKeyDown={e => {
        if (e.key === "Escape") { setOpen(false); setActive(-1); e.stopPropagation(); }
        if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setOpen(true); setActive(previous => matches.length ? previous < 0 ? (e.key === "ArrowDown" ? 0 : matches.length - 1) : (previous + (e.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length : -1); }
        if (e.key === "Enter" && expanded && matches.length) { e.preventDefault(); document.getElementById(`${id}-${active >= 0 ? active : 0}`)?.click(); }
      }}/>
    {expanded && <div className="absolute inset-x-0 top-full z-[60] mt-1 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
      <ul id={`${id}-results`} role="listbox" aria-label="메뉴 검색 결과">{matches.map((link, index) => <li key={`${link.href}-${link.label}`} role="presentation"><Link id={`${id}-${index}`} role="option" aria-selected={active === index} href={link.href}
        className={`block rounded-lg px-3 py-3 ${active === index ? "bg-teal-50 text-teal-900" : "hover:bg-slate-50"}`} onClick={() => { setOpen(false); setQuery(""); onSelect?.(); }}>
        <strong>{link.label}</strong><span className="ml-2 text-xs text-slate-500">{link.group}</span><span className="mt-1 block text-xs text-slate-600">{link.description}</span>
      </Link></li>)}</ul>{!matches.length && <p role="status" className="p-3 text-slate-600">일치하는 메뉴가 없습니다.</p>}
    </div>}
  </div>;
}
