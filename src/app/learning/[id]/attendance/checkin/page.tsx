import Link from "next/link";
import { redirect } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { PageIntro, Empty } from "@/components/portal/ui";
import { CheckCircle2, AlertCircle, Clock, Calendar, ChevronRight } from "lucide-react";
import { recordStudentQrCheckin } from "../checkin-actions";

export default async function StudentAttendanceCheckinPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session?: string; t?: string }>;
}) {
  const { id } = await params;
  const { session: sessionId } = await searchParams;

  // 1. 로그인 여부 확인 및 리다이렉트
  const nextUrl = `/learning/${id}/attendance/checkin?session=${sessionId ?? ""}`;
  const me = await requireIdentity(nextUrl);

  // 2. 세션 파라미터가 없는 경우
  if (!sessionId) {
    return (
      <div className="page-shell max-w-lg">
        <Empty title="수업 세션 정보가 없습니다">
          QR 코드를 다시 스캔하거나 담당 강사에게 문의해 주세요.
        </Empty>
      </div>
    );
  }

  // 3. QR 출석 서버 액션 실행
  const result = await recordStudentQrCheckin(id, sessionId);

  return (
    <div className="page-shell max-w-lg">
      <PageIntro eyebrow="SMART CHECK-IN" title="스마트 QR 출석 체크">
        울산과학대학교 평생직업교육 플랫폼 실시간 출결 시스템
      </PageIntro>

      <div className="panel text-center py-8">
        {result.ok ? (
          <div className="space-y-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-10 w-10" />
            </div>

            <div>
              <span className="badge bg-emerald-100 text-emerald-800 border-emerald-300">출석 완료</span>
              <h2 className="mt-3 text-2xl font-bold text-slate-900">
                출석이 정상 확인되었습니다!
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {result.sessionTitle ?? "수업 차시"}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-600 max-w-sm mx-auto space-y-2">
              <div className="flex justify-between">
                <span>학습자명:</span>
                <strong className="text-slate-800">{me.name} 님</strong>
              </div>
              <div className="flex justify-between">
                <span>출석 인증 시각:</span>
                <strong className="text-emerald-700 font-bold">{result.checkedInAt}</strong>
              </div>
              <div className="flex justify-between">
                <span>인증 방식:</span>
                <span>실시간 보안 QR 스캔</span>
              </div>
            </div>

            <div className="pt-4 flex flex-col gap-2">
              <Link 
                href={`/learning/${id}`}
                className="btn-primary w-full flex items-center justify-center gap-1.5"
              >
                <span>나의 강의실로 이동</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
              <Link 
                href={`/learning/${id}/attendance`}
                className="btn-secondary w-full text-xs"
              >
                나의 전체 출석 내역 확인
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <AlertCircle className="h-10 w-10" />
            </div>

            <div>
              <span className="badge bg-amber-100 text-amber-800 border-amber-300">확인 필요</span>
              <h2 className="mt-3 text-xl font-bold text-slate-900">
                출석을 완료하지 못했습니다
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {result.message}
              </p>
            </div>

            <div className="pt-4 flex flex-col gap-2">
              <Link 
                href={`/learning/${id}`}
                className="btn-primary w-full"
              >
                나의 강의실로 돌아가기
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
