// Contact-only revisions. Original approved documents remain unchanged evidence.
const SUPERSEDED_VERSIONS: Record<string, readonly string[]> = {
  "ACCOUNT-2026-09-20-v4": [
    "ACCOUNT-2026-09-19-v1",
    "ACCOUNT-2026-09-19-v2",
    "ACCOUNT-2026-09-20-v3",
  ],
  "INSTRUCTOR-PRIVACY-2026-09-20-v2": ["INSTRUCTOR-PRIVACY-2026-09-20-v1"],
  "INSTRUCTOR-REVIEW-2026-09-20-v2": ["INSTRUCTOR-REVIEW-2026-09-20-v1"],
};

export function currentContactPolicies<T extends { org_id: string; kind: string; version: string }>(policies: T[]): T[] {
  return policies.filter((policy) => !policies.some((replacement) =>
    replacement.org_id === policy.org_id && replacement.kind === policy.kind &&
    Object.hasOwn(SUPERSEDED_VERSIONS, replacement.version) &&
    SUPERSEDED_VERSIONS[replacement.version]?.includes(policy.version),
  ));
}
