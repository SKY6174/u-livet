"use client";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ActionState } from "@/lib/portal/types";
import { usePathname } from "next/navigation";
import { MFA_REAUTH_MESSAGE } from "@/lib/auth/mfa-message";
import { BotCheck, type BotProtection } from "@/components/auth/bot-check";
function Submit({
  label,
  disabled,
  pending,
}: {
  label: string;
  disabled?: boolean;
  pending: boolean;
}) {
  return (
    <button
      className="btn-primary"
      disabled={pending || disabled}
      type="submit"
    >
      {pending ? "처리 중…" : label}
    </button>
  );
}
export function ActionForm({
  action,
  children,
  label,
  disabled,
  botProtection,
  resetOnSuccess = true,
  className = "space-y-4",
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children?: React.ReactNode;
  label: string;
  disabled?: boolean;
  botProtection?: BotProtection;
  resetOnSuccess?: boolean;
  className?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const pathname = usePathname();
  const [state, formAction, pending] = useActionState(action, { message: "" });
  useEffect(() => {
    if (state.ok && resetOnSuccess) formRef.current?.reset();
  }, [state, resetOnSuccess]);
  const [botReady, setBotReady] = useState(false);
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const seconds = Math.max(0, Math.min(3600, state.retryAfter ?? 0));
    const until = Date.now() + seconds * 1000;
    setRemaining(seconds);
    if (!seconds) return;
    const timer = setInterval(() => {
      const value = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setRemaining(value);
      if (!value) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [state]);
  const blocked =
    disabled ||
    remaining > 0 ||
    botProtection?.unavailable ||
    (!!botProtection?.siteKey && !botReady);
  return (
    <form
      ref={formRef}
      action={formAction}
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        if (pending || blocked) return;
        const data = new FormData(event.currentTarget);
        // Dispatch manually so a rejected business operation preserves entered values.
        startTransition(() => formAction(data));
      }}
    >
      {children}
      {botProtection?.unavailable && (
        <p role="alert" className="text-red-700">
          로그인 보안 서비스가 준비 중입니다. 잠시 후 다시 시도하거나 사업단에
          문의해 주세요.
        </p>
      )}
      {botProtection?.siteKey && (
        <BotCheck
          siteKey={botProtection.siteKey}
          resetKey={state}
          onReady={setBotReady}
        />
      )}
      <Submit
        label={remaining ? `${remaining}초 후 다시 시도` : label}
        disabled={blocked}
        pending={pending}
      />
      {!!state.retryAfter && (
        <p className="text-base text-slate-600">
          {remaining
            ? "잠시 기다려 주세요. 시간이 지나면 버튼을 다시 누를 수 있습니다."
            : "다시 시도할 수 있습니다."}
        </p>
      )}
      {state.message && (
        <p
          role={state.ok ? "status" : "alert"}
          className={state.ok ? "text-emerald-800" : "text-red-700"}
        >
          {state.message}
        </p>
      )}
      {state.message === MFA_REAUTH_MESSAGE && (
        <a
          className="btn-secondary inline-flex"
          target="_blank"
          rel="noopener noreferrer"
          href={`/auth/security?next=${encodeURIComponent(pathname)}`}
        >
          추가 인증하기 (새 창)
        </a>
      )}
    </form>
  );
}
