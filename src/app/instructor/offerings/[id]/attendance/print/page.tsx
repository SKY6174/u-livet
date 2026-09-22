import { getAttendanceBook } from "@/lib/attendance/data";
import { AttendancePrint } from "@/components/attendance/attendance-print";
import { PrintButton } from "@/components/attendance/print-button";
import { Empty } from "@/components/portal/ui";
export const metadata = { title: "강사 출석 결과 열람 · U-LIFE" };
export default async function PrintAttendance({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { book } = await getAttendanceBook(id, "instructor");
  if (!book) return <div className="page-shell"><Empty title="출석부를 불러오지 못했습니다" /></div>;
  return <>
    <nav className="no-print mx-auto flex max-w-7xl flex-wrap items-center gap-4 p-5" aria-label="출석부 인쇄">
      <PrintButton /><p className="text-sm text-slate-600">강사용 결과 열람 · A4 {book.sessions.length <= 4 ? "세로" : "가로"} · 여백 20mm · QR 입실과 확정 출결을 구분합니다.</p>
    </nav>
    <AttendancePrint book={book} />
  </>;
}
