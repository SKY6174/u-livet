import { SUPPORT_CONTACTS } from "@/lib/portal/contact";

export function SupportContact({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const rowHeight = compact ? "min-h-[22px]" : "min-h-11";
  return (
    <div className={`min-w-0 text-[14.5px] ${compact ? "grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 leading-[22px]" : "leading-6"} ${className}`}>
      <p className={`whitespace-nowrap text-[16.5px] font-bold ${compact ? `flex ${rowHeight} items-center` : ""}`}>센터별 문의</p>
      <ul aria-label="센터별 문의 연락처" className={compact ? "min-w-0" : "mt-3 space-y-4"}>
        {SUPPORT_CONTACTS.map((contact) => (
          <li key={contact.center} className={compact ? "flex flex-wrap items-center gap-x-3" : ""}>
            <p className={`font-semibold ${compact ? `flex ${rowHeight} items-center` : ""}`}>{contact.center} · {contact.name}</p>
            <div className="flex min-w-0 flex-wrap gap-x-3">
              <a href={contact.phoneHref} className={`inline-flex ${rowHeight} items-center rounded-sm no-underline`}>
                {contact.phone}
              </a>
              <a href={contact.emailHref} className={`inline-flex ${rowHeight} items-center break-all rounded-sm no-underline`}>
                {contact.email}
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
