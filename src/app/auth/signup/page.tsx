import { AuthForm } from "@/components/auth/auth-form";
import { getSignupPolicy } from "@/lib/auth/social";
import { redirect } from "next/navigation";
export default async function Signup({ searchParams }: { searchParams: Promise<{ audience?: string }> }) {
  const requested = (await searchParams).audience;
  if (requested === "office" || requested === "internal") redirect("/auth/forgot-password?first=1");
  const audience = requested === "external" ? "external" : "learner";
  const policy = await getSignupPolicy();
  return (
    <div className="mx-auto max-w-lg px-5 py-16">
      <p className="eyebrow">START LEARNING</p>
      <h1 className="page-title">{audience === "external" ? "교외 강사 회원가입" : "수강생 회원가입"}</h1>
      {audience === "external" && <p className="mb-6 leading-7 text-slate-600">가입 후 사업단의 강사 등록·권한 확인이 완료되어야 강사 업무를 이용할 수 있습니다.</p>}
      {audience === "learner" && <p className="mb-6 leading-7 text-slate-600">처음 가입하는 학습자는 카카오·네이버·구글 간편 로그인을 권장합니다. 사업단에서 계정 설정 메일을 받았다면 메일의 링크로 기존 계정을 먼저 설정해 주세요.</p>}
      <div className="panel">
        <AuthForm signup audience={audience} policy={policy} />
      </div>
    </div>
  );
}
