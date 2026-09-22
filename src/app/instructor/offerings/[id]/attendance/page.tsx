import Link from "next/link";
import { getAttendanceBook } from "@/lib/attendance/data";
import { PageIntro, Empty } from "@/components/portal/ui";
import { AttendanceBook } from "@/components/attendance/attendance-book";
import { AttendanceEditor } from "@/components/attendance/attendance-editor";
import { SessionForm } from "@/components/attendance/session-form";
export default async function TeachingAttendance({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { book } = await getAttendanceBook(id, "instructor");
  if (!book) return <div className="page-shell"><Empty title="출석부를 불러오지 못했습니다">잠시 후 다시 시도해 주세요.</Empty></div>;
  return <div className="page-shell">
    <PageIntro eyebrow="ATTENDANCE BOOK" title="강사 출석부">{book.offering.name} · 수강 확정 명단으로 수업별 출결을 기록합니다.</PageIntro>
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <Link className="btn-primary flex items-center gap-1.5" href={`/instructor/offerings/${id}/attendance/qr`}>
        <span>실시간 스마트 QR 출석 화면 띄우기</span>
      </Link>
      <Link className="btn-secondary" href={`/instructor/offerings/${id}/attendance/print`} target="_blank" rel="noreferrer">출석부 인쇄·PDF 저장</Link>
      <Link className="btn-secondary" href={`/instructor/offerings/${id}/evaluation`}>시험·개별 출결 관리</Link>
    </div>
    <SessionForm book={book} />
    <AttendanceBook book={book} />
    <AttendanceEditor book={book} />
  </div>;
}
