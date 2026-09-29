"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ActionForm } from "@/components/portal/action-form";
import { PasswordField } from "./password-field";
import { acceptInvitation, resetPassword } from "@/app/auth/recovery-actions";
import type { Policy } from "@/lib/portal/types";

export function RecoveryForm({ invitation = false, policy }: { invitation?: boolean; policy?: Policy }) {
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
          `${window.location.pathname}${window.location.search}`,
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
          {invitation && policy && (
            <div className="space-y-3">
              <details className="rounded-lg border p-4">
                <summary className="min-h-11 cursor-pointer text-lg font-semibold leading-7">
                  {policy.title} · {policy.version}
                </summary>
                <p className="mt-4 whitespace-pre-wrap break-words text-base leading-7">{policy.body}</p>
              </details>
              <input type="hidden" name="privacy_policy_id" value={policy.id} />
              <label className="flex min-h-11 items-start gap-3 py-2 text-base">
                <input className="mt-1 h-5 w-5 shrink-0" type="checkbox" name="privacy_accepted" required />
                <span>[필수] 위 개인정보 수집·이용에 동의합니다.</span>
              </label>
            </div>
          )}
          <PasswordField signup label="새 비밀번호" />
          {!invitation && policy && (
            <section className="rounded-lg border p-4" aria-labelledby="member-first-password-privacy">
              <h2 id="member-first-password-privacy" className="text-lg font-semibold">첫 비밀번호 설정 시 개인정보 동의</h2>
              <p className="mt-2 text-sm text-slate-600">사업단·교내 강사로 처음 비밀번호를 설정하는 경우 아래 내용을 확인하고 동의해 주세요.</p>
              <p className="mt-3 font-semibold">{policy.title} · {policy.version}</p>
              <p className="mt-2 whitespace-pre-wrap break-words">{policy.body}</p>
              <input type="hidden" name="member_privacy_policy_id" value={policy.id} />
              <label className="mt-4 flex items-start gap-3">
                <input className="mt-1 h-5 w-5" type="checkbox" name="member_privacy_accepted" />
                <span>사업단 등록 구성원의 첫 비밀번호 설정에 필요한 개인정보 수집·이용에 동의합니다.</span>
              </label>
            </section>
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
