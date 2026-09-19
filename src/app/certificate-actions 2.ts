"use server";
import { MFA_REAUTH_MESSAGE } from "@/lib/auth/mfa-message";
import { revalidatePath } from "next/cache";
import { getSessionIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateApprovedCertificate } from "@/lib/certificates/service";
import type { ActionState } from "@/lib/portal/types";
const value = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const errors: Record<string, string> = {
  MFA_REAUTH_REQUIRED: MFA_REAUTH_MESSAGE,
  FORBIDDEN: "담당 범위 또는 발급권한을 확인해 주세요.",
  SELF_APPROVAL_FORBIDDEN: "본인 실적·본인 증명은 승인할 수 없습니다.",
  REVISION_CHANGED: "기록이 바뀌었습니다. 새로고침 후 확인하세요.",
  CLASS_NOT_FINISHED: "종료된 정상 수업의 실제 강의시간만 기록할 수 있습니다.",
  CERTIFICATE_EVIDENCE_REQUIRED:
    "현재 승인된 수료 또는 강의실적이 필요합니다. 자료 변경 여부를 확인하세요.",
  ISSUER_TEMPLATE_REQUIRED:
    "해당 기관·증명종류에 맞는 승인 발급권과 서식을 선택하세요.",
  CORRECTION_REASON_REQUIRED: "정정이 필요한 원본과 정정 사유를 확인하세요.",
};
async function mutate(
  rpc: string,
  args: Record<string, unknown>,
  generate = false,
): Promise<ActionState> {
  if (!(await getSessionIdentity())) return { message: "로그인이 필요합니다." };
  try {
    const { data, error } = await (
      await createServerSupabaseClient()
    ).rpc(rpc, args);
    if (error)
      return {
        message:
          errors[error.message] ??
          "저장하지 못했습니다. 입력 내용과 현재 상태를 확인하세요.",
      };
    if (generate) {
      try {
        await generateApprovedCertificate(String(data));
      } catch {
        revalidatePath("/", "layout");
        return {
          message:
            "승인은 저장되었으나 PDF 생성을 완료하지 못했습니다. 발급 설정·근거를 확인한 뒤 다시 생성하세요.",
        };
      }
    }
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: generate
        ? "발급 처리를 확인했습니다. 아래 현재 상태에서 PDF 완료 여부를 확인하세요."
        : "저장되었습니다.",
    };
  } catch {
    return { message: "연결에 실패했습니다. 다시 시도해 주세요." };
  }
}
export async function submitTeaching(_: ActionState, f: FormData) {
  if (!value(f, "minutes")) return { message: "실제 강의시간을 입력하세요." };
  return mutate("life_submit_teaching", {
    s: value(f, "session"),
    minutes: Number(value(f, "minutes")),
    notes: value(f, "notes"),
    expected_revision: Number(value(f, "revision")),
  });
}
export async function approveTeaching(_: ActionState, f: FormData) {
  return mutate("life_approve_teaching", {
    l: value(f, "log"),
    expected_revision: Number(value(f, "revision")),
  });
}
export async function requestCertificate(_: ActionState, f: FormData) {
  return mutate("life_request_certificate", {
    f: value(f, "offering"),
    k: value(f, "kind"),
    supersedes: value(f, "supersedes") || null,
    reason: value(f, "reason"),
  });
}
export async function approveCertificate(_: ActionState, f: FormData) {
  if (f.get("reviewed") !== "on")
    return { message: "발급권과 근거 검토에 체크하세요." };
  return mutate(
    "life_approve_certificate",
    {
      r: value(f, "request"),
      issuer: value(f, "issuer"),
      template: value(f, "template"),
    },
    true,
  );
}
export async function retryCertificate(_: ActionState, f: FormData) {
  return mutate("life_retry_certificate", { i: value(f, "issue") }, true);
}
export async function revokeCertificate(_: ActionState, f: FormData) {
  return mutate("life_revoke_certificate", {
    i: value(f, "issue"),
    reason: value(f, "reason"),
  });
}
