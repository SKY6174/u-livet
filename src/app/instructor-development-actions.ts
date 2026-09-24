"use server";
import { MFA_REAUTH_MESSAGE } from "@/lib/auth/mfa-message";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/portal/data";
import type { ActionState } from "@/lib/portal/types";
const value = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const messages: Record<string, string> = {
  MFA_REAUTH_REQUIRED: MFA_REAUTH_MESSAGE,
  FORBIDDEN: "처리 권한과 본인·기관 정보를 확인해 주세요.",
  AUTH_REQUIRED: "로그인이 필요합니다.",
  PROPOSER_REQUIRED: "현재 강사 역할 또는 유효한 이력 승인이 필요합니다.",
  APPROVED_POLICY_REQUIRED:
    "유효한 승인 안내문·심사 기준을 선택하고 확인해 주세요.",
  CONSENT_REQUIRED: "별도 공개 안내를 확인하고 동의해 주세요.",
  CURRENT_APPROVAL_REQUIRED:
    "현재 유효한 최신 승인본이 필요합니다. 승인 정책도 확인해 주세요.",
  REVISION_CHANGED:
    "다른 화면에서 자료가 변경되었습니다. 새로고침 후 다시 확인해 주세요.",
  INVALID_TRANSITION: "현재 상태에서는 처리할 수 없습니다.",
  SELF_APPROVAL_FORBIDDEN: "본인 자료를 직접 심사·승인할 수 없습니다.",
  VERIFICATION_REQUIRED: "증빙 확인과 유효기간을 입력해 주세요.",
  QUALIFICATION_EXPIRES:
    "이력 승인 유효기간이 제출 자격의 만료일을 넘을 수 없습니다.",
  REASON_REQUIRED: "검토 근거·사유를 2,000자 이내로 입력해 주세요.",
  HOURS_MISMATCH: "차시별 시간 합계가 이론·실습 총시간과 일치해야 합니다.",
  INVALID_DATE: "날짜와 기간의 순서·사업연도 범위를 확인해 주세요.",
  INVALID_INPUT: "필수 항목, 항목별 길이와 숫자를 확인해 주세요.",
  CURRICULUM_TOO_LONG:
    "차시 내용이 너무 깁니다. 전체 공개 교육내용을 20,000자 이내로 줄여 주세요.",
  IDEMPOTENCY_CONFLICT:
    "같은 요청에 다른 내용이 들어왔습니다. 개설 이력을 먼저 확인해 주세요.",
};
async function run(name: string, args: Record<string, unknown>) {
  if (!(await getSessionIdentity()))
    return {
      state: { message: "로그인이 필요합니다." } as ActionState,
      data: null,
    };
  try {
    const { data, error } = await (
      await createServerSupabaseClient()
    ).rpc(name, args);
    if (error)
      return {
        state: {
          message:
            messages[error.message] ??
            "처리하지 못했습니다. 입력값과 현재 상태를 확인해 주세요.",
        } as ActionState,
        data: null,
      };
    revalidatePath("/", "layout");
    return {
      state: {
        ok: true,
        message: "저장되었습니다. 현재 상태와 이력을 확인해 주세요.",
      } as ActionState,
      data,
    };
  } catch {
    return {
      state: {
        message:
          "연결하지 못했습니다. 저장 여부를 확인한 뒤 다시 시도해 주세요.",
      } as ActionState,
      data: null,
    };
  }
}
function ids(f: FormData, keys: string[]) {
  return keys.every((k) => UUID.test(value(f, k)));
}
function rev(f: FormData) {
  return /^\d{1,9}$/.test(value(f, "revision"));
}
const invalid = () => ({ message: "대상 정보와 입력 항목을 확인해 주세요." });
export async function startDossier(_: ActionState, f: FormData) {
  if (!ids(f, ["o", "privacy"]) || f.get("confirmed") !== "on")
    return invalid();
  const r = await run("life_start_dossier", {
    o: value(f, "o"),
    privacy: value(f, "privacy"),
    confirmed: true,
  });
  if (r.state.ok) redirect("/mypage/instructor?org=" + value(f, "o"));
  return r.state;
}
export async function saveDossier(_: ActionState, f: FormData) {
  if (!ids(f, ["v"]) || !rev(f)) return invalid();
  let claims;
  try {
    const raw = value(f, "claims");
    if (raw.length > 50000) return invalid();
    claims = JSON.parse(raw);
  } catch {
    return invalid();
  }
  return (
    await run("life_save_dossier", {
      v: value(f, "v"),
      revision: Number(value(f, "revision")),
      payload: {
        specialty: value(f, "specialty"),
        introduction: value(f, "introduction"),
        public_intro: value(f, "public_intro"),
        claims,
      },
    })
  ).state;
}
export async function submitDossier(_: ActionState, f: FormData) {
  if (!ids(f, ["v", "policy"]) || !rev(f) || f.get("confirmed") !== "on")
    return invalid();
  return (
    await run("life_submit_dossier", {
      v: value(f, "v"),
      revision: Number(value(f, "revision")),
      policy: value(f, "policy"),
      confirmed: true,
    })
  ).state;
}
export async function decideDossier(_: ActionState, f: FormData) {
  if (
    !ids(f, ["v"]) ||
    !["APPROVED", "CHANGES_REQUESTED", "REJECTED"].includes(
      value(f, "decision"),
    ) ||
    value(f, "reason").length > 2000
  )
    return invalid();
  return (
    await run("life_decide_dossier", {
      v: value(f, "v"),
      decision: value(f, "decision"),
      reason: value(f, "reason"),
      valid_until: value(f, "valid_until") || null,
      verified: f.get("verified") === "on",
    })
  ).state;
}
export async function withdrawDossier(_: ActionState, f: FormData) {
  if (!ids(f, ["v"]) || value(f, "reason").length > 2000) return invalid();
  return (
    await run("life_withdraw_dossier", {
      v: value(f, "v"),
      reason: value(f, "reason"),
    })
  ).state;
}
export async function setInstructorPublic(_: ActionState, f: FormData) {
  const enabled = value(f, "enabled") === "true";
  if (
    !ids(f, ["d"]) ||
    !rev(f) ||
    !["true", "false"].includes(value(f, "enabled")) ||
    (enabled && (!ids(f, ["policy"]) || f.get("confirmed") !== "on"))
  )
    return invalid();
  return (
    await run("life_set_instructor_public", {
      d: value(f, "d"),
      enabled,
      policy: enabled ? value(f, "policy") : null,
      confirmed: enabled,
      revision: Number(value(f, "revision")),
    })
  ).state;
}
export async function startDevelopment(_: ActionState, f: FormData) {
  const continuation = Boolean(value(f, "p"));
  if (
    !ids(f, ["o", "y"]) ||
    (value(f, "p") && !ids(f, ["p"])) ||
    (value(f, "target") && !ids(f, ["target"])) ||
    (!continuation && !["RCC", "AID-X", "ECC", "ICC", "SANHAK_PLANNING", "SANHAK_SUPPORT"].includes(value(f, "track")))
  )
    return invalid();
  const r = await run(continuation ? "life_start_development" : "life_start_development_classified", {
    o: value(f, "o"),
    y: value(f, "y"),
    kind: value(f, "kind"),
    target: value(f, "target") || null,
    ...(continuation ? { p: value(f, "p") } : { track: value(f, "track") }),
  });
  if (r.state.ok && typeof r.data === "string" && UUID.test(r.data))
    redirect("/development/" + r.data);
  return r.state;
}
export async function saveDevelopment(_: ActionState, f: FormData) {
  if (!ids(f, ["v"]) || !rev(f)) return invalid();
  let sessions;
  try {
    const raw = value(f, "sessions");
    if (raw.length > 90000) return invalid();
    sessions = JSON.parse(raw);
  } catch {
    return invalid();
  }
  const payload: Record<string, unknown> = { sessions };
  for (const k of [
    "title",
    "academy",
    "summary",
    "rationale",
    "target",
    "outcomes",
    "prerequisites",
    "assessment",
    "materials",
    "budget",
  ])
    payload[k] = value(f, k);
  for (const k of ["capacity", "theory_minutes", "practice_minutes"]) {
    if (!/^\d{1,5}$/.test(value(f, k))) return invalid();
    payload[k] = Number(value(f, k));
  }
  return (
    await run("life_save_development", {
      v: value(f, "v"),
      revision: Number(value(f, "revision")),
      payload,
    })
  ).state;
}
export async function submitDevelopment(_: ActionState, f: FormData) {
  if (
    !ids(f, ["v", "policy", "completion"]) ||
    !rev(f) ||
    f.get("confirmed") !== "on"
  )
    return invalid();
  return (
    await run("life_submit_development", {
      v: value(f, "v"),
      revision: Number(value(f, "revision")),
      policy: value(f, "policy"),
      completion: value(f, "completion"),
      confirmed: true,
    })
  ).state;
}
export async function decideDevelopment(_: ActionState, f: FormData) {
  if (
    !ids(f, ["v"]) ||
    !["APPROVED", "CHANGES_REQUESTED", "REJECTED"].includes(
      value(f, "decision"),
    ) ||
    value(f, "reason").length > 2000
  )
    return invalid();
  return (
    await run("life_decide_development", {
      v: value(f, "v"),
      decision: value(f, "decision"),
      reason: value(f, "reason"),
    })
  ).state;
}
export async function withdrawDevelopment(_: ActionState, f: FormData) {
  if (!ids(f, ["v"]) || value(f, "reason").length > 2000) return invalid();
  return (
    await run("life_withdraw_development", {
      v: value(f, "v"),
      reason: value(f, "reason"),
    })
  ).state;
}
export async function revokeDevelopment(_: ActionState, f: FormData) {
  if (
    !ids(f, ["v"]) ||
    f.get("confirmed") !== "on" ||
    value(f, "reason").length > 2000
  )
    return invalid();
  return (
    await run("life_revoke_development", {
      v: value(f, "v"),
      reason: value(f, "reason"),
    })
  ).state;
}
export async function openDevelopment(_: ActionState, f: FormData) {
  if (
    !ids(f, ["v", "request_key", "year"]) ||
    !/^\d{1,4}$/.test(value(f, "capacity"))
  )
    return invalid();
  const input: Record<string, unknown> = {
    capacity: Number(value(f, "capacity")),
  };
  for (const k of [
    "year",
    "name",
    "mode",
    "location",
    "selection_method",
    "starts_on",
    "ends_on",
  ])
    input[k] = value(f, k);
  for (const k of ["apply_from", "apply_until"])
    input[k] = value(f, k) + "+09:00";
  const r = await run("life_open_development", {
    v: value(f, "v"),
    request_key: value(f, "request_key"),
    input,
  });
  if (r.state.ok && typeof r.data === "string" && UUID.test(r.data))
    redirect("/admin/offerings/" + r.data);
  return r.state;
}
