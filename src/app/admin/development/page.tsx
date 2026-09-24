import { DevelopmentBoard } from "@/components/portal/development-board";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; year?: string; track?: string; academy?: string }>;
}) {
  const { org, year, track, academy } = await searchParams;
  return <DevelopmentBoard orgId={org} year={year} track={track} academy={academy} staff />;
}
