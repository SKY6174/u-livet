import { DevelopmentBoard } from "@/components/portal/development-board";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; year?: string; track?: string }>;
}) {
  const { org, year, track } = await searchParams;
  return <DevelopmentBoard orgId={org} year={year} track={track} staff={false} />;
}
