"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export function DocumentPopup({
  href,
  children,
  className = "",
  label,
  windowName,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  label?: string;
  windowName?: string;
}) {
  const router = useRouter(),
    opened = useRef(false);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const refresh = () => {
      if (opened.current) {
        opened.current = false;
        router.refresh();
      }
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [router]);
  return (
    <>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        aria-label={label}
        onClick={(event) => {
          if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
            return;
          event.preventDefault();
          const popup = window.open(
            href,
            windowName ?? "instructor-document-" +
              new URL(href, window.location.origin).searchParams.get("person"),
            `popup=yes,width=${Math.min(1680, screen.availWidth)},height=${Math.min(1000, screen.availHeight)},resizable=yes,scrollbars=yes`,
          );
          if (popup) {
            popup.opener = null;
            opened.current = true;
            setBlocked(false);
            popup.focus();
          } else setBlocked(true);
        }}
      >
        {children}
      </a>
      {blocked && (
        <span className="block max-w-xs text-xs text-amber-800" role="status">
          팝업이 차단되었습니다.{" "}
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            새 탭에서 입력 화면 열기
          </a>
        </span>
      )}
    </>
  );
}
