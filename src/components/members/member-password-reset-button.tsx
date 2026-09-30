"use client";

import { useActionState } from "react";
import { sendMemberPasswordReset } from "@/app/admin/accounts/actions";
import type { MemberGroup } from "@/lib/members/model";

export function MemberPasswordResetButton({ personId, name, group }: {
  personId: string;
  name: string;
  group: MemberGroup;
}) {
  const [state, action, pending] = useActionState(sendMemberPasswordReset, { message: "" });
  return <form action={action} className="min-w-0">
    <input type="hidden" name="person_id" value={personId} />
    <input type="hidden" name="group" value={group} />
    <button type="submit" disabled={pending} aria-label={`${name} 비밀번호 재설정 메일 발송`}
      className="inline-flex min-h-10 items-center whitespace-nowrap rounded-lg border border-teal-200 px-3 font-medium text-teal-800 hover:border-teal-500 hover:bg-teal-50 disabled:cursor-wait disabled:opacity-60">
      {pending ? "발송 중…" : "재설정 메일 발송"}
    </button>
    {state.message && <p role={state.ok ? "status" : "alert"} className={`mt-1 max-w-44 text-xs leading-5 ${state.ok ? "text-teal-800" : "text-rose-700"}`}>{state.message}</p>}
  </form>;
}
