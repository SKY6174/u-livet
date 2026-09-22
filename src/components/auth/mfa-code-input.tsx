"use client";

import { useEffect, useRef, useState } from "react";

export function MfaCodeInput({
  id,
  value,
  onChange,
  disabled,
  describedBy,
  autoFocus = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  describedBy: string;
  autoFocus?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  useEffect(() => {
    if (autoFocus && !disabled) inputRef.current?.focus();
  }, [autoFocus, disabled]);
  const readSelection = (input: HTMLInputElement) => {
    setSelection({
      start: input.selectionStart ?? value.length,
      end: input.selectionEnd ?? value.length,
    });
  };
  const update = (input: HTMLInputElement, next: string, caret: number) => {
    input.value = next;
    input.setSelectionRange(caret, caret);
    onChange(next);
    readSelection(input);
  };

  return (
    <div className="relative mx-auto sm:w-3/5">
      <input
        ref={inputRef}
        id={id}
        name="code"
        className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0 disabled:cursor-not-allowed"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        value={value}
        aria-describedby={describedBy}
        disabled={disabled}
        onFocus={(e) => {
          setFocused(true);
          readSelection(e.currentTarget);
        }}
        onBlur={() => setFocused(false)}
        onSelect={(e) => readSelection(e.currentTarget)}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          const input = e.currentTarget;
          const bounds = input.getBoundingClientRect();
          const slot = Math.floor(((e.clientX - bounds.left) / bounds.width) * 6);
          const start = Math.max(0, Math.min(slot, 5, value.length));
          input.focus();
          input.setSelectionRange(start, Math.min(start + 1, value.length));
          readSelection(input);
        }}
        onChange={(e) => {
          const input = e.currentTarget;
          const caret = input.value.slice(0, input.selectionStart ?? input.value.length).replace(/\D/g, "").length;
          update(input, input.value.replace(/\D/g, "").slice(0, 6), Math.min(caret, 6));
        }}
        onPaste={(e) => {
          e.preventDefault();
          const digits = e.clipboardData.getData("text").replace(/\D/g, "");
          if (!digits) return;
          const input = e.currentTarget;
          const start = input.selectionStart ?? value.length;
          const end = input.selectionEnd ?? start;
          const next = digits.length >= 6 ? digits.slice(0, 6) : (value.slice(0, start) + digits + value.slice(end)).slice(0, 6);
          update(input, next, digits.length >= 6 ? 6 : Math.min(start + digits.length, 6));
        }}
      />
      <div aria-hidden="true" className={`grid grid-cols-6 gap-2 sm:gap-3 ${disabled ? "opacity-50" : ""}`}>
        {Array.from({ length: 6 }, (_, index) => {
          const active = focused && (selection.start === selection.end
            ? index === Math.min(selection.start, 5)
            : index >= selection.start && index < selection.end);
          return (
            <span
              key={index}
              className={`flex h-14 min-w-0 items-center justify-center rounded-lg border-2 font-mono text-3xl font-bold text-slate-900 sm:h-16 ${active ? "border-teal-700 bg-teal-50 ring-2 ring-teal-700/20" : "border-slate-300 bg-white"}`}
            >
              {value[index] ?? ""}
            </span>
          );
        })}
      </div>
    </div>
  );
}
