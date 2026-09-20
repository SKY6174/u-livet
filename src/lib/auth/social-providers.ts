import "server-only";
export const SOCIAL_PROVIDERS = ["kakao", "naver", "google"] as const;
export type SocialProvider = typeof SOCIAL_PROVIDERS[number];
export function socialProvider(value: unknown): SocialProvider | null {
  return SOCIAL_PROVIDERS.find(provider => provider === value) ?? null;
}
export function socialProviderEnabled(provider: SocialProvider) {
  return provider === "kakao" || process.env[provider === "google" ? "AUTH_GOOGLE_ENABLED" : "AUTH_NAVER_ENABLED"] === "true";
}
export function socialProviderOptions() {
  return SOCIAL_PROVIDERS.map(id => ({ id, enabled: socialProviderEnabled(id) }));
}
