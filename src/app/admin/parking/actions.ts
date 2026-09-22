"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { UUID } from "@/lib/portal/data";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PARKING_CENTERS, type ParkingCenterCode } from "@/lib/parking/types";

const errorLabel: Record<string, string> = {
  FORBIDDEN:
    "권한 또는 최근 추가 인증을 확인해 주세요. 승인은 지정된 센터 담당자만 할 수 있습니다.",
  INVALID_INPUT: "입력 값을 다시 확인해 주세요.",
  PENDING_REQUESTS: "다른 센터에 배정된 승인 대기 신청을 먼저 처리해 주세요.",
  INSUFFICIENT_STOCK:
    "센터의 주차권 잔여 매수가 부족합니다. 재고를 먼저 등록해 주세요.",
  STOCK_LIMIT: "등록 가능한 재고 한도를 초과했습니다.",
};
function returnPath(form: FormData, message: string, success: boolean) {
  const year = Number(form.get("year"));
  const center = String(form.get("filter_center") ?? "");
  const params = new URLSearchParams();
  if (Number.isInteger(year) && year >= 2020 && year <= 2100)
    params.set("year", String(year));
  if (PARKING_CENTERS.includes(center as ParkingCenterCode))
    params.set("center", center);
  params.set(success ? "notice" : "error", message);
  return `/admin/parking?${params}`;
}
async function submit(
  form: FormData,
  fn: string,
  args: Record<string, unknown>,
) {
  await requireIdentity("/admin/parking");
  const { error } = await (await createServerSupabaseClient()).rpc(fn, args);
  if (error)
    redirect(
      returnPath(
        form,
        errorLabel[error.message] ??
          "처리하지 못했습니다. 권한과 입력 내용을 확인해 주세요.",
        false,
      ),
    );
  revalidatePath("/admin/parking");
  revalidatePath("/parking");
  redirect(returnPath(form, "저장했습니다.", true));
}
export async function assignParkingCenter(form: FormData) {
  const f = String(form.get("offering_id") ?? "");
  const c = String(form.get("center_code") ?? "");
  if (!UUID.test(f) || !PARKING_CENTERS.includes(c as ParkingCenterCode))
    redirect(returnPath(form, "과정과 센터를 선택해 주세요.", false));
  await submit(form, "life_parking_assign", { f, c });
}
export async function addParkingStock(form: FormData) {
  const o = String(form.get("org_id") ?? "");
  const c = String(form.get("center_code") ?? "");
  const n = Number(form.get("quantity"));
  const note = String(form.get("note") ?? "").trim();
  if (
    !UUID.test(o) ||
    !PARKING_CENTERS.includes(c as ParkingCenterCode) ||
    !Number.isInteger(n) ||
    n < 1 ||
    n > 10000 ||
    !note ||
    note.length > 500
  )
    redirect(
      returnPath(form, "센터, 입고 매수와 사유를 확인해 주세요.", false),
    );
  await submit(form, "life_parking_add_stock", { o, c, n, note });
}
export async function decideParkingVoucher(form: FormData) {
  const r = String(form.get("request_id") ?? "");
  const decision = String(form.get("decision") ?? "");
  const note = String(form.get("note") ?? "").trim();
  if (
    !UUID.test(r) ||
    !["approve", "reject"].includes(decision) ||
    note.length > 500 ||
    (decision === "reject" && !note)
  )
    redirect(returnPath(form, "결정과 반려 사유를 확인해 주세요.", false));
  await submit(form, "life_parking_decide", {
    r,
    approve: decision === "approve",
    note,
  });
}
