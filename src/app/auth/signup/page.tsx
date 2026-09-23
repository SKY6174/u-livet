import { AuthForm } from "@/components/auth/auth-form";
import { getSignupPolicy } from "@/lib/auth/social";
export default async function Signup({ searchParams }: { searchParams: Promise<{ audience?: string }> }) {
  const requested = (await searchParams).audience;
  const audience = requested === "office" || requested === "internal" ? requested : "learner";
  const activation = audience !== "learner";
  const policy = await getSignupPolicy();
  return (
    <div className="mx-auto max-w-lg px-5 py-16">
      <p className="eyebrow">START LEARNING</p>
      <h1 className="page-title">{activation ? "등록된 구성원 계정 활성화" : "회원가입"}</h1>
      {activation && <p className="mb-6 leading-7 text-slate-600">사업단에 등록한 이메일로 가입 정보를 입력하고 이메일 인증을 완료해 주세요. 기존 구성원 정보와 자동으로 연결됩니다.</p>}
      <div className="panel">
        <AuthForm signup audience={audience} policy={policy} />
      </div>
    </div>
  );
}
