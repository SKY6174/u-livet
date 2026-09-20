import { SUPPORT_CONTACT } from "@/lib/portal/contact";

export function SupportContact({ className = "" }: { className?: string }) {
  return (
    <div className={`text-sm leading-6 ${className}`}>
      <p>문의 담당: {SUPPORT_CONTACT.name} {SUPPORT_CONTACT.title}</p>
      <div className="flex flex-wrap gap-x-4">
        <a href={SUPPORT_CONTACT.phoneHref} className="inline-flex min-h-11 items-center rounded-sm font-semibold underline underline-offset-4">
          {SUPPORT_CONTACT.phone}
        </a>
        <a href={SUPPORT_CONTACT.emailHref} className="inline-flex min-h-11 items-center break-all rounded-sm underline underline-offset-4">
          {SUPPORT_CONTACT.email}
        </a>
      </div>
    </div>
  );
}
