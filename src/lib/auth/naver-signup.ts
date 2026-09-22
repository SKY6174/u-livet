/** Use Auth-verified fields, never client-editable user_metadata, for this gate. */
export function naverSignupNeedsEmail(user: {
  email?: string;
  email_confirmed_at?: string;
  identities?: { provider: string }[];
}): boolean {
  return !!user.identities?.some(identity => identity.provider === "custom:naver")
    && (!user.email || !user.email_confirmed_at);
}

export function signupEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
