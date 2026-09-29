"use server";

import { createRecoveryClient } from "@/lib/auth/recovery";
import type { ActionState } from "@/lib/portal/types";

const INVALID_LINK_MESSAGE =
  "확인 링크를 사용할 수 없습니다. 이미 사용했거나 시간이 지났을 수 있습니다. 사업단에 새 확인 메일을 요청해 주세요.";
const TOKEN_HASH_PATTERN = /^(?:pkce_)?[a-f0-9]{32,128}$/i;

export async function confirmEmail(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const tokenHash = String(form.get("token_hash") ?? "");
  if (!TOKEN_HASH_PATTERN.test(tokenHash))
    return { message: INVALID_LINK_MESSAGE };

  try {
    const client = createRecoveryClient();
    const proof = await client.auth.verifyOtp({
      token_hash: tokenHash,
      type: "signup",
    });
    if (proof.error || !proof.data.user || !proof.data.user.email_confirmed_at)
      return { message: INVALID_LINK_MESSAGE };
    await client.auth.signOut({ scope: "local" }).catch(() => undefined);
    return {
      ok: true,
      message: "이메일 확인을 마쳤습니다. 가입한 이메일과 비밀번호로 로그인해 주세요.",
    };
  } catch {
    return { message: INVALID_LINK_MESSAGE };
  }
}
