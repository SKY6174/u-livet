import Link from "next/link";
import type { Metadata } from "next";
import { requireIdentity } from "@/lib/auth/session";
import { UUID } from "@/lib/portal/data";
import { QR_TOKEN } from "@/lib/attendance/qr";
import { PageIntro, Empty } from "@/components/portal/ui";
import { QrCheckin } from "@/components/attendance/qr-checkin";
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function StudentAttendanceCheckinPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session?: string; t?: string }>;
}) {
  const { id } = await params;
  const { session, t } = await searchParams;
  if (!UUID.test(id) || typeof session !== "string" || !UUID.test(session) || typeof t !== "string" || !QR_TOKEN.test(t))
    return <div className="page-shell max-w-lg"><Empty title="올바른 출석 QR이 아닙니다">강의실 화면의 새 QR을 다시 스캔해 주세요.</Empty></div>;
  const nextUrl = `/learning/${id}/attendance/checkin?${new URLSearchParams({ session, t })}`;
  const me = await requireIdentity(nextUrl);
  return <div className="page-shell max-w-lg">
    <PageIntro eyebrow="QR ATTENDANCE" title="QR 시작·종료 확인">로그인한 본인의 QR 확인 시각을 기록합니다.</PageIntro>
    <QrCheckin offering={id} session={session} token={t} name={me.name} />
    <Link className="btn-secondary mt-5" href={`/learning/${id}/attendance`}>나의 출석 내역</Link>
  </div>;
}
