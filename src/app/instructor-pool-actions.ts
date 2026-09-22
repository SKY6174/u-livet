"use server";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSessionIdentity } from "@/lib/auth/session";
import { UUID } from "@/lib/portal/data";
import type { ActionState } from "@/lib/portal/types";
import { MFA_REAUTH_MESSAGE } from "@/lib/auth/mfa-message";
import { validatePoolInput, type PoolBoard } from "@/lib/instructors/pool";
const messages: Record<string, string> = {
 FORBIDDEN: "담당 기관의 전문가 관리 권한을 확인해 주세요.", MFA_REAUTH_REQUIRED: MFA_REAUTH_MESSAGE,
 REVISION_CHANGED: "다른 담당자가 수정했습니다. 새로고침 후 다시 확인해 주세요.",
 DUPLICATE_INSTRUCTOR: "같은 성명·구분·소속의 강사가 있습니다. 기존 강사를 확인해 주세요.",
 NAME_MISMATCH: "계정과 연결된 성명은 회원 관리에서 확인해 주세요.", POOL_PROFILE_REQUIRED: "먼저 강사 기본정보를 등록하고 활동 상태를 확인해 주세요.",
 COURSE_SCOPE_MISMATCH: "같은 담당 기관의 과정만 연결할 수 있습니다.", FINAL_RECORD_IMMUTABLE: "지급 완료·취소 기록은 수정할 수 없습니다.",
 DOCUMENTS_REQUIRED: "신분증·통장사본·이력서를 모두 확인한 후 지급완료를 기록해 주세요.", PAYMENT_EVIDENCE_REQUIRED: "활동 이후의 지급일, 거래·결의번호와 지급 근거를 확인해 주세요.",
};
const value = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
async function run(rpc: string, args: Record<string, unknown>): Promise<ActionState> {
 if (!(await getSessionIdentity())) return { message: "로그인이 필요합니다." };
 try {
  const { error } = await (await createServerSupabaseClient()).rpc(rpc, args);
  if (error) return { message: messages[error.message] ?? (error.code === "23505" ? "이미 등록한 강사 또는 같은 지급 참조입니다. 기존 내역을 확인해 주세요." : "저장하지 못했습니다. 입력값·금액·현재 상태를 확인해 주세요.") };
  revalidatePath("/admin/instructors", "layout");
  return { ok: true, message: "저장했습니다. 최신 목록과 합계에 반영되었습니다." };
 } catch { return { message: "연결을 확인한 뒤 다시 시도해 주세요." }; }
}
export async function savePoolPerson(_: ActionState, form: FormData) {
 try {
  const o = value(form, "o"), p = value(form, "p"), request_key = value(form, "request_key"), revision = value(form, "revision");
  if (!UUID.test(o) || (p && !UUID.test(p)) || !UUID.test(request_key) || !/^\d{1,9}$/.test(revision)) return { message: "등록 대상을 확인해 주세요." };
  const payload = validatePoolInput({ ...Object.fromEntries(["name","kind","affiliation","department","position","specialty","phone","email","notes","status"].map(k => [k,value(form,k)])), documents_required: form.get("documents_required") === "on" });
  return run("life_instructor_pool_save", { o, p: p || null, expected_revision: Number(revision), request_key, payload });
 } catch (error) { return { message: error instanceof Error ? error.message : "입력값을 확인해 주세요." }; }
}
export async function importPoolPeople(o: string, rows: { request_key: string; payload: unknown }[]): Promise<ActionState> {
 if (!UUID.test(o) || !Array.isArray(rows) || rows.length < 1 || rows.length > 200) return { message: "등록할 기관과 자료를 확인해 주세요." };
 try {
  const verified = rows.map(row => { if (!UUID.test(row.request_key)) throw new Error("등록 요청을 다시 준비해 주세요."); return { request_key: row.request_key, payload: validatePoolInput(row.payload) }; });
  return run("life_instructor_pool_import", { o, rows: verified });
 } catch (error) { return { message: error instanceof Error ? error.message : "입력값을 확인해 주세요." }; }
}
export async function saveAllowance(_: ActionState, form: FormData) {
 const o = value(form,"o"), p = value(form,"p"), a = value(form,"a"), request_key = value(form,"request_key"), revision = value(form,"revision");
 if (![o,p,request_key].every(x => UUID.test(x)) || (a && !UUID.test(a)) || !/^\d{1,9}$/.test(revision)) return { message: "활동 대상을 확인해 주세요." };
 const payload = Object.fromEntries(["offering_id","title","activity_kind","activity_on","minutes","rate","withholding","evidence"].map(k => [k,value(form,k)]));
 return run("life_instructor_allowance_save", { o,p,a:a||null,request_key,expected_revision:Number(revision),payload });
}
export async function transitionAllowance(_: ActionState, form: FormData) {
 const o=value(form,"o"),a=value(form,"a"),revision=value(form,"revision"),action=value(form,"action");
 if (![o,a].every(x=>UUID.test(x)) || !/^\d{1,9}$/.test(revision) || !["PAY","CANCEL"].includes(action)) return { message: "지급 기록을 확인해 주세요." };
 if (form.get("confirmed")!=="on") return { message: "처리 내용 확인란에 체크해 주세요." };
 return run("life_instructor_allowance_transition",{o,a,expected_revision:Number(revision),action,paid_on:value(form,"paid_on")||null,reference:value(form,"reference"),evidence:value(form,"evidence")});
}
export async function exportPoolData(o: string,q: string,kind: string,p: string|null,tab: string) {
 if (!(await getSessionIdentity()) || !UUID.test(o) || (p && !UUID.test(p))) throw new Error("로그인과 기관을 확인해 주세요.");
 const db=await createServerSupabaseClient();
 const {data,error}=await db.rpc("life_instructor_pool_board",{o,q,kind,p,page_size:2000});
 if(error || !data) throw new Error("내보내기 권한과 검색 조건을 확인해 주세요.");
 const board=data as PoolBoard;
 if(tab!=="payments" && board.total>2000) throw new Error("최대 2,000명까지 내보낼 수 있습니다. 검색 조건을 좁혀 주세요.");
 if(tab==="payments") {
  if(board.allowance_total>5000) throw new Error("최대 5,000건까지 내보낼 수 있습니다. 강사를 선택해 주세요.");
  for(let page=2;page<=Math.ceil(board.allowance_total/50);page++) {
   const result=await db.rpc("life_instructor_pool_board",{o,q,kind,p,activity_page:page,page_size:1});
   if(result.error) throw new Error("지급 내역을 불러오지 못했습니다.");
   board.allowances.push(...(result.data as PoolBoard).allowances);
  }
 }
 return {items:board.items,allowances:board.allowances};
}
