import { notFound } from "next/navigation";
import { GuestDocumentPortal } from "@/components/instructor-documents/guest-portal";
export const metadata = {
  title: "강사 서류 제출 | U-LiVE",
  robots: { index: false, follow: false },
};
export default async function InstructorDocumentInvite({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(code)) notFound();
  return <GuestDocumentPortal code={code} />;
}
