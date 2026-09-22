import { notFound, redirect } from "next/navigation";
import { getManual, manualHref } from "@/lib/manuals/data";

export default async function CurrentManual({ params }: { params: Promise<{ audience: string }> }) {
  const { audience } = await params;
  const result = getManual(audience);
  if (!result) notFound();
  redirect(manualHref(result.manual, result.release.version));
}
