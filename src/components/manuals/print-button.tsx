"use client";

import { Printer } from "lucide-react";

export function ManualPrintButton() {
  return <button className="btn-secondary gap-2" type="button" onClick={() => window.print()}>
    <Printer className="h-4 w-4" aria-hidden="true" />인쇄
  </button>;
}
