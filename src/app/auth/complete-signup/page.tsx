import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSignupPolicy, socialDestination } from "@/lib/auth/social";
import { socialReturnTo } from "@/lib/auth/registration";
import { completeKakaoSignup, } from "@/app/auth/social-actions";
import { signOut } from "@/app/auth/actions";
import { PhoneField } from "@/components/auth/phone-field";
import { ActionForm } from "@/components/portal/action-form";
export default async function CompleteSignup({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = socialReturnTo((await searchParams).next);
  const client = await createServerSupabaseClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect(`/auth/login?next=${encodeURIComponent(next)}`);
  const result = await client.rpc("life_registration_status");
  if (result.error) redirect("/auth/login?social_error=unavailable");
  if (result.data?.state !== "PENDING") redirect(await socialDestination(next));
  const policy = await getSignupPolicy();
  return (
    <div className="mx-auto max-w-lg px-5 py-16">
      <p className="eyebrow">U-LIFE ACCOUNT</p>
      <h1 className="page-title">가입을 마무리해 주세요</h1>
      <p className="mb-8 text-base leading-7 text-slate-600">카카오 로그인이 완료되었습니다. 아래 정보를 입력하면 수강생으로 이용할 수 있습니다.</p>
      <div className="panel">
        {policy ? <ActionForm action={completeKakaoSignup} label="동의하고 수강생 가입 완료" resetOnSuccess={false}>
          <input type="hidden" name="next" value={next} />
          <label className="field text-base">이름 (필수)<input name="name" autoComplete="name" maxLength={100} required /></label>
          <PhoneField />
          <div className="rounded-xl border p-4 text-base">
            <h2 className="font-semibold">{policy.title}</h2>
            <p className="my-3 max-h-56 overflow-y-auto whitespace-pre-wrap leading-7" tabIndex={0}>{policy.body}</p>
            <input type="hidden" name="privacy_policy_id" value={policy.id} />
            <label className="flex min-h-11 items-start gap-3 leading-7"><input type="checkbox" name="privacy_accepted" className="mt-1.5 h-5 w-5 shrink-0" required /><span>[필수] 위 개인정보 수집·이용에 동의합니다.</span></label>
          </div>
        </ActionForm> : <p role="status">회원가입 안내를 준비하고 있습니다. 잠시 후 다시 이용해 주세요.</p>}
        <form action={signOut} className="mt-6"><button type="submit" className="min-h-11 text-base underline">가입 중단하고 로그아웃</button></form>
        <Link href="/courses" className="mt-2 flex min-h-11 items-center text-base underline">공개 교육과정 둘러보기</Link>
      </div>
    </div>
  );
}
