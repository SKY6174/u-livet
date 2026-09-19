import { AuthForm } from "@/components/auth/auth-form";
import { getSignupPolicy } from "@/lib/auth/social";
export default async function Signup() {
  const policy = await getSignupPolicy();
  return (
    <div className="mx-auto max-w-lg px-5 py-16">
      <p className="eyebrow">START LEARNING</p>
      <h1 className="page-title">회원가입</h1>
      <div className="panel">
        <AuthForm signup policy={policy} />
      </div>
    </div>
  );
}
