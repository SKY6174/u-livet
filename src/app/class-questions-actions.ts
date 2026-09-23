"use server";

import { revalidatePath } from "next/cache";
import { getSessionIdentity } from "@/lib/auth/session";
import { UUID } from "@/lib/portal/data";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/portal/types";

const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const errorMessage = (message: string) => {
  if (message === "FORBIDDEN") return "이 수업의 질문을 처리할 권한이 없습니다.";
  if (message === "RATE_LIMITED") return "질문은 한 시간에 10건까지 등록할 수 있습니다. 잠시 후 다시 시도해 주세요.";
  return "질문을 처리하지 못했습니다. 내용을 확인한 뒤 다시 시도해 주세요.";
};

export async function askClassQuestion(_: ActionState, form: FormData): Promise<ActionState> {
  const offering = value(form, "offering");
  const body = value(form, "body");
  const visibility = value(form, "visibility");
  if (!UUID.test(offering) || body.length < 1 || body.length > 2000 || !["PRIVATE", "COURSE"].includes(visibility))
    return { message: "질문 내용과 공개 범위를 확인해 주세요. 질문은 2,000자 이내입니다." };
  if (!(await getSessionIdentity())) return { message: "다시 로그인해 주세요." };
  try {
    const { error } = await (await createServerSupabaseClient()).rpc("life_ask_class_question", {
      f: offering, question_body: body, question_visibility: visibility,
    });
    if (error) return { message: errorMessage(error.message) };
    revalidatePath(`/learning/${offering}`);
    revalidatePath(`/instructor/offerings/${offering}`);
    revalidatePath("/");
    return { ok: true, message: "질문을 등록했습니다." };
  } catch {
    return { message: "연결에 실패했습니다. 잠시 후 다시 시도해 주세요." };
  }
}

export async function answerClassQuestion(_: ActionState, form: FormData): Promise<ActionState> {
  const question = value(form, "question");
  const body = value(form, "body");
  if (!UUID.test(question) || body.length < 1 || body.length > 5000)
    return { message: "답변을 5,000자 이내로 입력해 주세요." };
  if (!(await getSessionIdentity())) return { message: "다시 로그인해 주세요." };
  try {
    const { data, error } = await (await createServerSupabaseClient()).rpc("life_answer_class_question", {
      qid: question, answer_body: body,
    });
    if (error) return { message: errorMessage(error.message) };
    if (typeof data !== "string" || !UUID.test(data)) return { message: "답변 결과를 확인하지 못했습니다." };
    revalidatePath(`/instructor/offerings/${data}`);
    revalidatePath(`/learning/${data}`);
    revalidatePath("/");
    return { ok: true, message: "답변을 저장했습니다." };
  } catch {
    return { message: "연결에 실패했습니다. 잠시 후 다시 시도해 주세요." };
  }
}
