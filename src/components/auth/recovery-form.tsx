"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ActionForm } from "@/components/portal/action-form";
import { PasswordField } from "./password-field";
import { acceptInvitation, resetPassword } from "@/app/auth/recovery-actions";

export function RecoveryForm({ invitation = false }: { invitation?: boolean }) {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    const capture = () => {
      const candidate = new URLSearchParams(window.location.hash.slice(1)).get(
        "token_hash",
      );
      if (candidate !== null) {
        setToken(/^[a-f0-9]{32,128}$/i.test(candidate) ? candidate : "");
        window.history.replaceState(
          window.history.state,
          "",
          window.location.pathname,
        );
      } else {
        setToken((current) => current ?? "");
      }
    };
    capture();
    window.addEventListener("hashchange", capture);
    return () => window.removeEventListener("hashchange", capture);
  }, []);
  if (token === null)
    return <p role="status">이메일 링크를 확인하고 있습니다.</p>;
  return (
    <div className="space-y-5 [&_button[type=submit]]:w-full [&_button[type=submit]]:text-base">
      {token ? (
        <ActionForm
          key={token}
          action={invitation ? acceptInvitation : resetPassword}
          label={invitation ? "비밀번호 설정하기" : "비밀번호 바꾸기"}
        >
          <input type="hidden" name="token_hash" value={token} />
          <PasswordField signup label="새 비밀번호" />
          {!invitation && (
            <>
              <label className="block text-base" htmlFor="recovery-mfa-code">
                인증 앱의 6자리 코드
                <input
                  id="recovery-mfa-code"
                  name="mfa_code"
                  className="min-h-12 rounded-lg border border-slate-300 bg-white px-3 py-3 text-slate-900 mt-2 w-full"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  aria-describedby="recovery-mfa-help"
                />
              </label>
              <p id="recovery-mfa-help" className="text-base text-slate-600">
                추가 인증을 설정한 계정은 반드시 입력해 주세요. 인증 앱을 연결한
                적이 없다면 비워 두세요.
              </p>
            </>
          )}
          <p className="text-base text-slate-600">
            {invitation
              ? "다른 사람이 알기 어려운 비밀번호를 만들어 주세요. 설정 후 이메일과 새 비밀번호로 로그인합니다."
              : "이전과 다른 비밀번호를 만들어 주세요. 변경 후에는 새 비밀번호로 다시 로그인합니다."}
          </p>
        </ActionForm>
      ) : (
        <p role="status" className="rounded-xl bg-slate-100 p-4 text-base">
          {invitation
            ? "초대 메일의 ‘처음 비밀번호 설정하기’로 들어와 주세요. 화면을 새로고침했다면 메일의 링크를 다시 열어 주세요. 계속 사용할 수 없다면 사업단에 새 초대를 요청해 주세요."
            : "이메일의 재설정 링크로 들어와 주세요. 화면을 새로고침했거나 링크를 사용할 수 없다면 메일을 다시 요청해 주세요."}
        </p>
      )}
      {!invitation && (
        <Link
          className="flex min-h-11 items-center text-base underline"
          href="/auth/forgot-password"
        >
          새 재설정 메일 요청
        </Link>
      )}
      <Link
        className="flex min-h-11 items-center text-base underline"
        href="/auth/login"
      >
        로그인으로 이동
      </Link>
    </div>
  );
}
