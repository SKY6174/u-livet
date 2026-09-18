import { AuthForm } from "@/components/auth/auth-form";
import { getPolicies } from "@/lib/portal/data";
export default async function Signup() {
  const policies = await getPolicies("ACCOUNT_PRIVACY");
  return (
    <div className="mx-auto max-w-lg px-5 py-16">
      <p className="eyebrow">START LEARNING</p>
      <h1 className="page-title">회원가입</h1>
      <div className="panel">
        <AuthForm signup policy={policies[0]} />
      </div>
    </div>
  );
}
