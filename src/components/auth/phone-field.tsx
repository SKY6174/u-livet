"use client";

import type { ChangeEvent, KeyboardEvent } from "react";
import { formatMobilePhone, MOBILE_NOTICE } from "@/lib/auth/registration";

function formatPhoneInput(event: ChangeEvent<HTMLInputElement>) {
  const input = event.currentTarget;
  const original = input.value;
  const caret = input.selectionStart ?? original.length;
  const formatted = formatMobilePhone(original);
  if (formatted === original) return;

  input.value = formatted;
  let nextCaret = formatted.length;
  if (caret < original.length) {
    const digitsBeforeCaret = original.slice(0, caret).replace(/\D/g, "").length;
    nextCaret = 0;
    let digitsPassed = 0;
    while (nextCaret < formatted.length && digitsPassed < digitsBeforeCaret) {
      if (/\d/.test(formatted[nextCaret])) digitsPassed += 1;
      nextCaret += 1;
    }
  }
  input.setSelectionRange(nextCaret, nextCaret);
}

function handlePhoneKeyDown(event: KeyboardEvent<HTMLInputElement>) {
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
  const input = event.currentTarget;
  const caret = input.selectionStart;
  if (caret === null || caret !== input.selectionEnd) return;
  // Delete the adjacent digit too, so a separator cannot trap the caret.
  if (event.key === "Backspace" && caret >= 2 && input.value[caret - 1] === "-") {
    input.setSelectionRange(caret - 2, caret);
  } else if (event.key === "Delete" && input.value[caret] === "-" && caret + 1 < input.value.length) {
    input.setSelectionRange(caret, caret + 2);
  }
}

export function PhoneField() {
  return (
    <label className="field text-base">
      휴대폰 번호 (필수)
      <input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="010-1234-5678" maxLength={30} required aria-describedby="mobile-notice" onChange={formatPhoneInput} onKeyDown={handlePhoneKeyDown} />
      <span id="mobile-notice" className="text-sm font-normal leading-6 text-slate-600">{MOBILE_NOTICE}</span>
    </label>
  );
}
