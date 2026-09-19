import { DevelopmentBoard } from "@/components/portal/development-board";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  return <DevelopmentBoard orgId={(await searchParams).org} staff />;
}
