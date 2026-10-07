import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { workspaceKind } from "@/lib/auth/workspace-navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getLearnerProfile } from "@/lib/learner-profile/data";
import { ProfileEditor } from "@/components/learner-profile/profile-editor";

export const metadata: Metadata = {
  title: "내 정보 | U-LiVET",
  robots: { index: false, follow: false },
};

export default async function LearnerProfilePage() {
  const identity = await requireIdentity("/mypage/profile");
  if (workspaceKind(identity) !== "learner") notFound();
  const client = await createServerSupabaseClient();
  const [{ data: { user } }, profile] = await Promise.all([
    client.auth.getUser(), getLearnerProfile().catch(() => null),
  ]);
  let photoUrl: string | null = null;
  if (user && profile?.photo_path?.startsWith(`${user.id}/`)) {
    const signed = await client.storage.from("learner-profile-photos")
      .createSignedUrl(profile.photo_path, 600);
    photoUrl = signed.data?.signedUrl ?? null;
  }
  return <div className="page-shell max-w-5xl">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm font-bold tracking-[0.2em] text-teal-700">MY PROFILE</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">내 정보</h1>
        <p className="mt-3 text-slate-600">학습 안내를 받을 연락처와 나를 표현할 프로필을 관리하세요.</p>
      </div>
      <Link href="/mypage" className="btn-secondary">나의 학습으로 돌아가기</Link>
    </div>
    {!user || !profile ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
      정보를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.
    </section> : <ProfileEditor name={identity.name} email={user.email ?? ""}
      pendingEmail={user.new_email ?? null} profile={profile} photoUrl={photoUrl} />}
  </div>;
}
