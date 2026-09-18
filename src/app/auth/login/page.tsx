import { AuthForm } from "@/components/auth/auth-form";
import { safeReturnTo } from "@/lib/auth/session";
export default async function Login(props: {
  searchParams: Promise<{ next?: string }>;
}) {
  const searchParams = await props.searchParams;
  return (
    <div className="mx-auto max-w-lg px-5 py-16">
      <p className="eyebrow">U-LIFE ACCOUNT</p>
      <h1 className="page-title">다시 만나 반갑습니다</h1>
      <p className="mb-8 text-slate-600">배움과 경력을 한곳에서 이어가세요.</p>
      <div className="panel">
        <AuthForm next={safeReturnTo(searchParams.next)} />
      </div>
    </div>
  );
}
