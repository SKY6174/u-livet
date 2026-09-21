import Link from "next/link";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { getAttendanceBook } from "@/lib/attendance/data";
import { PageIntro, Empty } from "@/components/portal/ui";
import { QrPresenter } from "@/components/attendance/qr-presenter";

export default async function InstructorQrAttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session?: string }>;
}) {
  const { id } = await params;
  const { session: selectedSessionId } = await searchParams;

  // 강사 본인 확인
  const me = await requireIdentity(`/instructor/offerings/${id}/attendance/qr`);
  if (!me.roles.some((r) => r.role === "INSTRUCTOR")) notFound();

  // 출석부 및 세션 정보 조회
  const { book } = await getAttendanceBook(id, "instructor");
  if (!book) {
    return (
      <div className="page-shell">
        <Empty title="강좌 정보를 불러오지 못했습니다">
          잠시 후 다시 시도해 주세요.
        </Empty>
      </div>
    );
  }

  // 현재 진행 중이거나 가장 가까운 세션 찾기
  const now = Date.now();
  const sessions = book.sessions ?? [];
  
  // 선택된 세션이 있거나, 없으면 가장 현재 시간에 가까운 세션을 기본 선택
  let activeSession = sessions.find((s) => s.id === selectedSessionId);
  if (!activeSession && sessions.length > 0) {
    // 진행 중이거나 아직 끝나지 않은 첫 번째 세션 또는 첫 번째 세션
    activeSession = sessions.find((s) => s.status === "SCHEDULED" && Date.parse(s.starts_at) <= now && Date.parse(s.ends_at) > now) ?? sessions.find((s) => s.status === "SCHEDULED" && Date.parse(s.ends_at) > now) ?? sessions[0];
  }

  return (
    <div className="page-shell max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link className="text-sm font-semibold text-teal-800 hover:underline" href={`/instructor/offerings/${id}/attendance`}>
          ← 출석부 관리로 돌아가기
        </Link>
        <Link className="text-sm font-semibold text-teal-800 hover:underline" href="/instructor">
          My Room 홈 →
        </Link>
      </div>

      <PageIntro 
        eyebrow="SMART QR ATTENDANCE" 
        title="스마트 실시간 QR 출석 체크"
      >
        강의실 화면에 QR을 띄워 수강생의 입실 시각을 확인합니다. 수업 종료 후 출석부에서 실제 출석시간을 확정하세요.
      </PageIntro>

      {!sessions.length ? (
        <Empty title="등록된 수업 세션 일정이 없습니다">
          먼저 출석부 관리에서 수업 차시 일정을 생성해 주세요.
        </Empty>
      ) : !activeSession ? (
        <Empty title="선택된 수업 세션이 없습니다">
          차시 목록에서 수업을 선택해 주세요.
        </Empty>
      ) : (
        <QrPresenter key={activeSession.id}
          offering={book.offering}
          sessions={sessions}
          activeSession={activeSession}
          enrolledCount={book.members.length}
        />
      )}
    </div>
  );
}
