"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { UUID } from "@/lib/portal/data";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const errorLabel: Record<string, string> = {
  AUTH_REQUIRED: "로그인 후 다시 신청해 주세요.",
  REQUEST_UNAVAILABLE:
    "신청할 수 없는 과정·날짜입니다. 과정 기간과 담당 센터를 확인해 주세요.",
  DUPLICATE_REQUEST:
    "이 과정의 같은 날짜에 처리 중이거나 승인된 신청이 있습니다.",
  INVALID_INPUT: "날짜, 연락처와 지급 매수를 확인해 주세요.",
  FORBIDDEN: "본인의 승인 대기 신청만 취소할 수 있습니다.",
};
function resultUrl(message: string, success = false) {
  return `/parking?${success ? "notice" : "error"}=${encodeURIComponent(message)}`;
}
export async function requestParkingVoucher(form: FormData) {
  await requireIdentity("/parking");
  const f = String(form.get("offering_id") ?? "");
  const d = String(form.get("use_on") ?? "");
  const n = Number(form.get("quantity"));
  const contact = String(form.get("phone") ?? "").trim();
  if (
    !UUID.test(f) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(d) ||
    !Number.isInteger(n) ||
    n < 1 ||
    n > 10 ||
    !/^0[0-9-]{8,15}$/.test(contact)
  )
    redirect(resultUrl("날짜, 연락처와 지급 매수를 확인해 주세요."));
  const { error } = await (
    await createServerSupabaseClient()
  ).rpc("life_parking_request", { f, d, n, contact });
  if (error)
    redirect(
      resultUrl(
        errorLabel[error.message] ??
          "신청하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      ),
    );
  revalidatePath("/parking");
  revalidatePath("/admin/parking");
  redirect(resultUrl("무료 주차권 발급을 요청했습니다.", true));
}
export async function cancelParkingVoucher(form: FormData) {
  await requireIdentity("/parking");
  const r = String(form.get("request_id") ?? "");
  if (!UUID.test(r)) redirect(resultUrl("신청 번호를 확인해 주세요."));
  const { error } = await (
    await createServerSupabaseClient()
  ).rpc("life_parking_cancel", { r });
  if (error)
    redirect(
      resultUrl(errorLabel[error.message] ?? "신청을 취소하지 못했습니다."),
    );
  revalidatePath("/parking");
  revalidatePath("/admin/parking");
  redirect(resultUrl("신청을 취소했습니다.", true));
}
