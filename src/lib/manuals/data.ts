import catalog from "@/content/manuals/releases.json";
import firstRelease from "@/content/manuals/1.0.0.json";
import secondRelease from "@/content/manuals/1.1.0.json";
import thirdRelease from "@/content/manuals/1.2.0.json";
import fourthRelease from "@/content/manuals/1.3.0.json";

export type ManualSection = {
  id: string; title: string; path: string; entry: string; prepare: string;
  steps: string[]; done: string; note: string;
};
export type Manual = {
  id: string; code: string; title: string; audience: string; summary: string; owner: string;
  prerequisites: string[]; sections: ManualSection[]; checklist: string[];
  faq: { question: string; answer: string }[]; sources: string[];
};
export type ManualRelease = {
  version: string; releasedOn: string; title: string; status: string; sourceCommit: string;
  scope: string; changes: string[]; common: { title: string; body: string }[]; manuals: Manual[];
};

// Keep every published import: an old URL must always render its own complete snapshot.
export const MANUAL_RELEASES: ManualRelease[] = [firstRelease, secondRelease, thirdRelease, fourthRelease];
export const CURRENT_MANUAL_VERSION = catalog.current;
if (catalog.versions.length !== MANUAL_RELEASES.length ||
    catalog.versions.some(version => !MANUAL_RELEASES.some(release => release.version === version)) ||
    !catalog.versions.includes(catalog.current)) throw new Error("매뉴얼 버전 목록과 원문 등록이 일치하지 않습니다.");

export const getManualRelease = (version = CURRENT_MANUAL_VERSION) =>
  MANUAL_RELEASES.find(release => release.version === version);
export function getManual(audience: string, version = CURRENT_MANUAL_VERSION) {
  const release = getManualRelease(version);
  const manual = release?.manuals.find(item => item.id === audience);
  return release && manual ? { release, manual } : null;
}
export function searchManuals(release: ManualRelease, query: string) {
  const terms = query.trim().toLocaleLowerCase("ko").split(/\s+/).filter(Boolean);
  return release.manuals.filter(manual => {
    const text = JSON.stringify(manual).toLocaleLowerCase("ko");
    return terms.every(term => text.includes(term));
  });
}
export const manualHref = (manual: Manual, version = CURRENT_MANUAL_VERSION) => `/manuals/${manual.id}/${version}`;
export const manualFile = (version: string, id = "all", format = "pdf") => `/manuals/${version}/${id}.${format}`;
