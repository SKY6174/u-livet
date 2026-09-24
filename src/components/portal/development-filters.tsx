"use client";

import { useRouter } from "next/navigation";

const PROJECT_YEARS = [2025, 2026, 2027, 2028, 2029] as const;
const ACADEMIES = ["스마트테크", "라이프케어", "로컬창업", "팝업"] as const;
const TRACK_OPTIONS: Record<string, { value: string; label: string }[]> = {
  "uc-anchor": [
    { value: "ECC", label: "ECC" },
    { value: "ICC", label: "ICC" },
    { value: "RCC", label: "RCC" },
    { value: "AID-X", label: "AID-X" },
  ],
  "uc-sanhak": [
    { value: "SANHAK_PLANNING", label: "산학기획팀" },
    { value: "SANHAK_SUPPORT", label: "산학지원팀" },
  ],
};

export const developmentTrackOptions = (slug: string) => TRACK_OPTIONS[slug] ?? [];

export function DevelopmentFilters({
  basePath,
  organizations,
  organizationId,
  organizationSlug,
  year,
  track,
  academy,
}: {
  basePath: string;
  organizations: { id: string; slug: string; name: string }[];
  organizationId: string;
  organizationSlug: string;
  year: number;
  track: string;
  academy: string;
}) {
  const router = useRouter();
  const navigate = (change: Record<string, string>) => {
    const next = { org: organizationId, year: String(year), track, academy, ...change };
    const query = new URLSearchParams({ org: next.org, year: next.year });
    if (next.track) query.set("track", next.track);
    if (next.academy) query.set("academy", next.academy);
    router.push(`${basePath}?${query.toString()}`);
  };

  return (
    <section className="panel mb-6" aria-label="과정 개발 분류">
      <div className="flex flex-wrap items-end gap-4">
        <label className="field min-w-44 flex-1 lg:flex-none">
          사업연도
          <select value={year} onChange={(event) => navigate({ year: event.target.value })}>
            {PROJECT_YEARS.map((value) => (
              <option key={value} value={value}>{value}년 ({value - 2024}차년도)</option>
            ))}
          </select>
        </label>
        <label className="field min-w-44 flex-1 lg:flex-none">
          주관기관
          <select value={organizationId} onChange={(event) => navigate({ org: event.target.value, track: "" })}>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.slug === "uc-anchor" ? "앵커사업단" : org.slug === "uc-sanhak" ? "산학협력단" : org.name}
              </option>
            ))}
          </select>
        </label>
        {developmentTrackOptions(organizationSlug).length > 0 && (
          <label className="field min-w-44 flex-1 lg:ml-8 lg:flex-none">
            {organizationSlug === "uc-anchor" ? "주관 센터" : "담당 팀"}
            <select value={track} onChange={(event) => navigate({ track: event.target.value })}>
              <option value="">전체</option>
              {developmentTrackOptions(organizationSlug).map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        )}
        <label className="field min-w-40 flex-1 lg:flex-none">
          아카데미
          <select value={academy} onChange={(event) => navigate({ academy: event.target.value })}>
            <option value="">전체</option>
            {ACADEMIES.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      </div>
    </section>
  );
}
