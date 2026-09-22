import Link from "next/link";
import { getSecurityContext } from "@/lib/auth/mfa";
import { formatMfaFactors } from "@/lib/auth/mfa-factor";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { MfaManagement } from "@/components/auth/mfa-management";

export async function AccountSecurity() {
  const context = await getSecurityContext();
  if (context && !context.status.staff_required) return null;
  let unavailable = !context;
  let factors: ReturnType<typeof formatMfaFactors> = [];
  if (context) {
    try {
      const { data, error } = await (await createServerSupabaseClient()).auth.mfa.listFactors();
      unavailable = !!error;
      if (!error) factors = formatMfaFactors(data?.all ?? []);
    } catch {
      unavailable = true;
    }
  }
  return (
    <section aria-label="계정 보안" className="panel mb-8 max-w-2xl text-base">
      {unavailable || !context ? (
        <p role="alert">인증 앱 목록을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.</p>
      ) : (
        <MfaManagement status={context.status} factors={factors} />
      )}
      <Link className="btn-secondary mt-4" href="/auth/security">
        인증 앱 추가·확인
      </Link>
    </section>
  );
}
