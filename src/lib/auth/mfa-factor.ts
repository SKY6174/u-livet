export type MfaFactor = { id: string; name: string; verified: boolean };

export function formatMfaFactors(factors: {
  id: string;
  factor_type: string;
  friendly_name?: string;
  created_at: string;
  status: string;
}[]): MfaFactor[] {
  return factors.filter((factor) => factor.factor_type === "totp").map((factor) => ({
    id: factor.id,
    name: factor.friendly_name?.startsWith("U-LIFE ") || factor.friendly_name?.startsWith("U-LiVE ") || factor.friendly_name?.startsWith("U-LiVET ")
      ? `인증 앱 · ${new Date(factor.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
      : factor.friendly_name ?? "인증 앱",
    verified: factor.status === "verified",
  }));
}
