import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSignupPolicy, socialDestination } from "@/lib/auth/social";
import { socialReturnTo } from "@/lib/auth/registration";
import { completeKakaoSignup, returnToExistingLogin } from "@/app/auth/social-actions";
import { PhoneField } from "@/components/auth/phone-field";
import { ActionForm } from "@/components/portal/action-form";
export default async function CompleteSignup({ searchParams }: { searchParams: Promise<{ next?: string; step?: string }> }) {
  const params = await searchParams;
  const next = socialReturnTo(params.next);
  const showSignup = params.step === "signup";
  const choiceHref = `/auth/complete-signup?next=${encodeURIComponent(next)}`;
  const client = await createServerSupabaseClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect(`/auth/login?next=${encodeURIComponent(next)}`);
  const result = await client.rpc("life_registration_status");
  if (result.error) redirect("/auth/login?social_error=unavailable");
  if (result.data?.state !== "PENDING") redirect(await socialDestination(next));
  const policy = await getSignupPolicy();
  const existingLogin = (
    <ActionForm action={returnToExistingLogin} label="기존 계정으로 로그인" resetOnSuccess={false}>
      <input type="hidden" name="next" value={next} />
    </ActionForm>
  );
  return (
    <div className="mx-auto max-w-lg px-5 py-16">
      <p className="eyebrow">U-LIFE ACCOUNT</p>
      <h1 className="page-title">{showSignup ? "새 회원가입" : "회원가입 또는 로그인"}</h1>
      <p className="mb-8 text-base leading-7 text-slate-600">
        {showSignup
          ? "간편 인증이 완료되었습니다. U-LIFE 회원가입에 필요한 이름·휴대폰 번호와 개인정보 동의를 확인해 주세요."
          : "간편 인증이 완료되었습니다. U-LIFE가 처음이신지, 이미 가입한 계정이 있는지 선택해 주세요."}
      </p>
      {showSignup ? <div className="panel [&_button[type=submit]]:w-full [&_button[type=submit]]:text-base">
        {policy ? <ActionForm action={completeKakaoSignup} label="동의하고 가입 완료" resetOnSuccess={false}>
          <input type="hidden" name="next" value={next} />
          <label className="field text-base">이름 (필수)<input name="name" autoComplete="name" maxLength={100} required /></label>
          <PhoneField />
          <div className="rounded-xl border p-4 text-base">
            <h2 className="font-semibold">{policy.title}</h2>
            <p className="my-3 max-h-56 overflow-y-auto whitespace-pre-wrap leading-7" tabIndex={0}>{policy.body}</p>
            <input type="hidden" name="privacy_policy_id" value={policy.id} />
            <label className="flex min-h-11 items-start gap-3 leading-7"><input type="checkbox" name="privacy_accepted" className="mt-1.5 h-5 w-5 shrink-0" required /><span>[필수] 위 개인정보 수집·이용에 동의합니다.</span></label>
          </div>
          <p className="text-base leading-7 text-slate-600">신규 회원은 기본 회원으로 등록되며, 강사 업무는 사업단의 자격 확인 후 이용할 수 있습니다.</p>
        </ActionForm> : <p role="status">회원가입 안내를 준비하고 있습니다. 잠시 후 다시 이용해 주세요.</p>}
        <div className="mt-6 border-t pt-6">
          <p className="mb-3 text-base leading-7 text-slate-600">이미 가입하셨다면 가입할 때 사용한 방법으로 로그인해 주세요.</p>
          {existingLogin}
          <Link href={choiceHref} className="mt-3 flex min-h-11 items-center text-base underline">선택 화면으로 돌아가기</Link>
        </div>
      </div> : <div className="space-y-4">
        <section className="panel" aria-labelledby="new-account-title">
          <h2 id="new-account-title" className="text-xl font-bold">처음 이용하시나요?</h2>
          <p className="mb-5 mt-3 text-base leading-7 text-slate-600">회원정보와 개인정보 동의를 확인한 뒤 새 회원으로 가입할 수 있습니다.</p>
          {policy
            ? <Link href={`${choiceHref}&step=signup`} className="btn-primary w-full text-base">새 회원가입</Link>
            : <p role="status">회원가입 안내를 준비하고 있습니다. 잠시 후 다시 이용해 주세요.</p>}
        </section>
        <section className="panel [&_button[type=submit]]:w-full [&_button[type=submit]]:text-base" aria-labelledby="existing-account-title">
          <h2 id="existing-account-title" className="text-xl font-bold">이미 가입하셨나요?</h2>
          <p className="mb-5 mt-3 text-base leading-7 text-slate-600">이메일이나 다른 간편 로그인으로 가입했다면, 가입할 때 사용한 방법으로 로그인해 주세요.</p>
          {existingLogin}
        </section>
      </div>}
      <Link href="/courses" className="mt-5 flex min-h-11 items-center text-base underline">공개 교육과정 둘러보기</Link>
    </div>
  );
}
