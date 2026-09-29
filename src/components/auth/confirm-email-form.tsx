"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { confirmEmail } from "@/app/auth/confirm-email/actions";

const TOKEN_HASH_PATTERN = /^(?:pkce_)?[a-f0-9]{32,128}$/i;

export function ConfirmEmailForm() {
  const [token, setToken] = useState<string | null>(null);
  const [state, action, pending] = useActionState(confirmEmail, {
    message: "",
  });

  useEffect(() => {
    const candidate = new URLSearchParams(window.location.hash.slice(1)).get(
      "token_hash",
    );
    setToken(candidate && TOKEN_HASH_PATTERN.test(candidate) ? candidate : "");
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname,
    );
  }, []);

  if (token === null)
    return <p role="status">이메일 링크를 확인하고 있습니다.</p>;

  return (
    <div className="space-y-5">
      {state.ok ? (
        <p role="status" className="text-emerald-800">
          {state.message}
        </p>
      ) : token ? (
        <form action={action} className="space-y-4">
          <input type="hidden" name="token_hash" value={token} />
          <p className="text-base text-slate-600">
            아래 버튼을 누르면 이메일 확인이 완료됩니다.
          </p>
          <button className="btn-primary w-full" type="submit" disabled={pending}>
            {pending ? "확인 중…" : "이메일 확인 완료하기"}
          </button>
          {state.message && (
            <p role="alert" className="text-red-700">
              {state.message}
            </p>
          )}
        </form>
      ) : (
        <p role="status" className="rounded-xl bg-slate-100 p-4 text-base">
          확인 메일의 버튼으로 들어와 주세요. 화면을 새로고침했다면 메일의 링크를
          다시 열어 주세요. 계속 사용할 수 없다면 사업단에 새 확인 메일을 요청해
          주세요.
        </p>
      )}
      <Link className="flex min-h-11 items-center text-base underline" href="/auth/login">
        로그인으로 이동
      </Link>
    </div>
  );
}
