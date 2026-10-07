import { NextResponse } from "next/server";
import { getSessionIdentity } from "@/lib/auth/session";
import { workspaceKind } from "@/lib/auth/workspace-navigation";
import { getLearnerProfile } from "@/lib/learner-profile/data";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isReviewOnly } from "@/lib/deployment/review-mode";

const BUCKET = "learner-profile-photos";
const MAX_SIZE = 2 * 1024 * 1024;
const json = (message: string, status: number) => NextResponse.json({ message }, {
  status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
});

async function authorized(request: Request) {
  if (isReviewOnly() || request.headers.get("origin") !== new URL(request.url).origin) return null;
  const identity = await getSessionIdentity();
  if (!identity || workspaceKind(identity) !== "learner") return null;
  const client = await createServerSupabaseClient();
  const { data: { user }, error } = await client.auth.getUser();
  return error || !user ? null : { client, user };
}

function photoExtension(type: string, bytes: Uint8Array) {
  if (type === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (type === "image/png" && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) return "png";
  if (type === "image/webp" && new TextDecoder().decode(bytes.subarray(0, 4)) === "RIFF"
    && new TextDecoder().decode(bytes.subarray(8, 12)) === "WEBP") return "webp";
  return null;
}

export async function POST(request: Request) {
  try {
    const member = await authorized(request);
    if (!member) return json("수강생 계정으로 다시 로그인해 주세요.", 403);
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_SIZE + 100_000) return json("2MB 이하의 사진을 선택해 주세요.", 413);
    const data = await request.formData();
    const file = data.get("photo");
    if (!(file instanceof File) || !file.size || file.size > MAX_SIZE) return json("2MB 이하의 사진을 선택해 주세요.", 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const extension = photoExtension(file.type, bytes);
    if (!extension) return json("JPG, PNG 또는 WebP 사진을 선택해 주세요.", 400);
    const previous = await getLearnerProfile();
    const path = `${member.user.id}/${crypto.randomUUID()}.${extension}`;
    const storage = member.client.storage.from(BUCKET);
    const uploaded = await storage.upload(path, bytes, { contentType: file.type, upsert: false });
    if (uploaded.error) return json("사진을 업로드하지 못했습니다. 다시 시도해 주세요.", 500);
    const saved = await member.client.rpc("life_set_learner_photo", { p_path: path });
    if (saved.error) {
      await storage.remove([path]);
      return json("사진을 저장하지 못했습니다. 다시 시도해 주세요.", 500);
    }
    if (previous.photo_path && previous.photo_path.startsWith(`${member.user.id}/`)) {
      const removed = await storage.remove([previous.photo_path]);
      if (removed.error) console.error("Old learner photo cleanup deferred");
    }
    return json("사진을 저장했습니다.", 200);
  } catch {
    return json("사진을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.", 500);
  }
}

export async function DELETE(request: Request) {
  try {
    const member = await authorized(request);
    if (!member) return json("수강생 계정으로 다시 로그인해 주세요.", 403);
    const previous = await getLearnerProfile();
    const saved = await member.client.rpc("life_set_learner_photo", { p_path: null });
    if (saved.error) return json("사진을 삭제하지 못했습니다. 다시 시도해 주세요.", 500);
    if (previous.photo_path?.startsWith(`${member.user.id}/`)) {
      const removed = await member.client.storage.from(BUCKET).remove([previous.photo_path]);
      if (removed.error) console.error("Learner photo cleanup deferred");
    }
    return json("사진을 삭제했습니다.", 200);
  } catch {
    return json("사진을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.", 500);
  }
}
