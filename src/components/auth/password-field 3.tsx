"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Circle, Eye, EyeOff } from "lucide-react";
import {
  getPasswordChecks,
  PASSWORD_GUIDANCE,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/lib/auth/password-policy";

export function PasswordField({
  signup = false,
  label = "비밀번호",
}: {
  signup?: boolean;
  label?: string;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [visible, setVisible] = useState(false);
  const checks = getPasswordChecks(value);
  const fulfilled = checks.filter((check) => check.met).length;

  useEffect(() => {
    const input = inputRef.current;
    const form = input?.form;
    const reset = () => {
      setValue("");
      setVisible(false);
      input?.setCustomValidity("");
    };
    const hide = () => setVisible(false);
    form?.addEventListener("reset", reset);
    form?.addEventListener("submit", hide);
    return () => {
      form?.removeEventListener("reset", reset);
      form?.removeEventListener("submit", hide);
    };
  }, []);

  function update(input: HTMLInputElement) {
    setValue(input.value);
    const missing = getPasswordChecks(input.value).filter(
      (check) => !check.met,
    );
    input.setCustomValidity(
      signup && input.value && missing.length ? PASSWORD_GUIDANCE : "",
    );
  }

  return (
    <div
      className="space-y-3"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setVisible(false);
      }}
    >
      <div className="field">
        <label htmlFor={id} className="text-base">
          {label}
        </label>
        <div className="relative">
          <input
            ref={inputRef}
            id={id}
            name="password"
            type={visible ? "text" : "password"}
            autoComplete={signup ? "new-password" : "current-password"}
            autoCapitalize="none"
            spellCheck={false}
            minLength={signup ? PASSWORD_MIN_LENGTH : 1}
            maxLength={PASSWORD_MAX_LENGTH}
            required
            style={{ paddingRight: "7rem" }}
            aria-describedby={signup ? `${id}-hint ${id}-rules` : undefined}
            onChange={(event) => update(event.currentTarget)}
            onFocus={(event) => update(event.currentTarget)}
          />
          <button
            type="button"
            className="absolute inset-y-1 right-1 inline-flex min-h-11 min-w-24 items-center justify-center gap-2 rounded-md px-3 text-base font-semibold text-teal-900 hover:bg-teal-50"
            aria-label={visible ? "비밀번호 숨기기" : "비밀번호 보이기"}
            aria-controls={id}
            aria-pressed={visible}
            onClick={() => setVisible((shown) => !shown)}
          >
            {visible ? (
              <EyeOff size={20} aria-hidden="true" />
            ) : (
              <Eye size={20} aria-hidden="true" />
            )}
            {visible ? "숨기기" : "보이기"}
          </button>
        </div>
      </div>
      {signup && (
        <p id={`${id}-hint`} className="text-base leading-relaxed text-slate-600">
          영문 대문자와 소문자를 각각 넣어 주세요. 공백은 특수문자에 포함되지 않습니다.
        </p>
      )}
      {signup && (
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="mb-3 font-semibold text-slate-800">
            비밀번호 조건을 함께 확인해요
          </p>
          <ul id={`${id}-rules`} className="space-y-2">
            {checks.map((check) => (
              <li
                key={check.id}
                className={`flex items-start gap-2 text-base ${check.met ? "text-emerald-800" : "text-slate-600"}`}
              >
                {check.met ? (
                  <Check
                    className="mt-0.5 shrink-0"
                    size={20}
                    aria-hidden="true"
                  />
                ) : (
                  <Circle
                    className="mt-0.5 shrink-0"
                    size={20}
                    aria-hidden="true"
                  />
                )}
                <span>
                  <span className="sr-only">
                    {check.met ? "충족: " : "미충족: "}
                  </span>
                  {check.label}
                </span>
              </li>
            ))}
          </ul>
          <p
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="mt-3 text-base font-semibold text-slate-800"
          >
            {fulfilled === checks.length
              ? "모든 조건을 충족했어요."
              : `${checks.length}개 조건 중 ${fulfilled}개를 충족했어요.`}
          </p>
        </div>
      )}
    </div>
  );
}
