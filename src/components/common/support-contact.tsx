import { SUPPORT_CONTACTS } from "@/lib/portal/contact";

export function SupportContact({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={`min-w-0 text-[12.5px] leading-6 ${compact ? "grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4" : ""} ${className}`}>
      <p className={`whitespace-nowrap text-[14.5px] font-bold ${compact ? "flex min-h-11 items-center" : ""}`}>센터별 문의</p>
      <ul aria-label="센터별 문의 연락처" className={compact ? "min-w-0" : "mt-3 space-y-4"}>
        {SUPPORT_CONTACTS.map((contact) => (
          <li key={contact.center} className={compact ? "flex flex-wrap items-center gap-x-3" : ""}>
            <p className={`font-semibold ${compact ? "flex min-h-11 items-center" : ""}`}>{contact.center} · {contact.name}</p>
            <div className="flex min-w-0 flex-wrap gap-x-3">
              <a href={contact.phoneHref} className="inline-flex min-h-11 items-center rounded-sm underline underline-offset-4">
                {contact.phone}
              </a>
              <a href={contact.emailHref} className="inline-flex min-h-11 items-center break-all rounded-sm underline underline-offset-4">
                {contact.email}
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
