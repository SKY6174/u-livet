import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PageIntro, Empty } from "@/components/portal/ui";
import { ActionForm } from "@/components/portal/action-form";
import { queueMessage, cancelMessage } from "@/app/message-actions";
import { UUID, dateTime } from "@/lib/portal/data";
import { messageLabel, type MessageJob } from "@/lib/messaging/types";
export default async function MessageDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { data, error } = await (
    await createServerSupabaseClient()
  ).rpc("life_message_overview", { j: id });
  if (error || !data?.length)
    return (
      <div className="page-shell">
        <Empty title="작업을 조회할 수 없습니다" />
      </div>
    );
  const j = data[0] as MessageJob;
  const expired =
    Date.parse(j.expires_at) <= Date.now() ||
    Date.parse(j.scheduled_at) < Date.now();
  return (
    <div className="page-shell">
      <PageIntro eyebrow="MESSAGE REVIEW" title={j.title}>
        {j.name} · {messageLabel(j.kind)} · {messageLabel(j.audience)}
      </PageIntro>
      <div className="mb-8 flex flex-wrap gap-2">
        <span className="badge">{messageLabel(j.status)}</span>
        <span className="badge">
          {j.mode === "TEST" ? "가상 처리 전용" : "실제 발송 미연결"}
        </span>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className="panel min-w-0">
          <h2 className="section-title">문안과 예약</h2>
          <p className="mb-4 text-sm text-slate-600">
            문안 버전 {j.version} · 예약 {dateTime(j.scheduled_at)}
          </p>
          <blockquote className="whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-5 leading-8">
            {j.body}
          </blockquote>
          <p className="mt-4 text-sm text-slate-600">
            예상 발송비: 미확정 (업체·요금 미등록)
          </p>
          <p className="notice mt-4">
            이 화면의 예약과 테스트 처리는 실제 문자 발송이 아닙니다. 업체 연결
            대기 건은 자동 전송되지 않습니다.
          </p>
        </section>
        <section className="panel">
          <h2 className="section-title">대상 확인 · 총 {j.total}명</h2>
          <dl className="space-y-2">
            {Object.entries(j.counts).map(([s, n]) => (
              <div key={s} className="flex justify-between gap-4 border-b pb-2">
                <dt>{messageLabel(s)}</dt>
                <dd className="font-bold">{n}명</dd>
              </div>
            ))}
          </dl>
          {Object.keys(j.exclusions).length > 0 && (
            <>
              <h3 className="mb-2 mt-5 font-bold">제외 사유</h3>
              <ul className="space-y-2 text-sm">
                {Object.entries(j.exclusions).map(([r, n]) => (
                  <li key={r}>
                    {messageLabel(r)} · {n}명
                  </li>
                ))}
              </ul>
            </>
          )}
          <details className="mt-6 text-sm">
            <summary className="cursor-pointer font-semibold">
              마스킹 표본 (최대 5명)
            </summary>
            <ul className="mt-3 space-y-2">
              {j.samples.map((s, i) => (
                <li key={i}>
                  {s.label ?? "연락처 없음"} · {messageLabel(s.state)}
                  {s.state === "SKIPPED" ? ` · ${messageLabel(s.reason)}` : ""}
                </li>
              ))}
            </ul>
          </details>
        </section>
      </div>
      <section className="panel mt-6">
        <h2 className="section-title">2. 예약 확인</h2>
        {j.status === "PREVIEW" ? (
          <>
            <p className="mb-4 text-sm">
              미리보기 유효시간: {dateTime(j.expires_at)}. 예약할 때 현재 동의와
              연락처를 다시 확인합니다.
            </p>
            {expired ? (
              <p className="notice">
                유효시간 또는 예약시각이 지났습니다. 목록에서 새 미리보기를
                만들어 주세요.
              </p>
            ) : (
              <ActionForm
                action={queueMessage}
                label="확인 후 예약 저장"
                disabled={!j.counts.ELIGIBLE}
              >
                <input type="hidden" name="j" value={j.id} />
                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    name="confirmed"
                    required
                    className="mt-1"
                  />
                  문안·대상을 확인했습니다. 실제 발송은 연결 전이며 테스트
                  결과는 발송 성공이 아님을 확인합니다.
                </label>
              </ActionForm>
            )}
          </>
        ) : (
          <p className="notice">
            {messageLabel(j.status)}. 수신동의 철회·연락처 변경·대상 자격 변경은
            처리 시 다시 확인합니다.
          </p>
        )}
        {["PREVIEW", "QUEUED", "BLOCKED_CONFIG"].includes(j.status) && (
          <div className="mt-5">
            <ActionForm
              action={cancelMessage}
              label="이 작업 취소"
              disabled={!!(j.counts.PROCESSING || j.counts.UNKNOWN)}
            >
              <input type="hidden" name="j" value={j.id} />
            </ActionForm>
          </div>
        )}
        {!!j.counts.UNKNOWN && (
          <p className="mt-4 text-sm text-amber-800">
            결과 확인이 필요한 항목입니다. 중복 처리를 막기 위해 재실행과 취소를
            제한합니다.
          </p>
        )}
      </section>
      <section className="panel mt-6">
        <h2 className="section-title">처리 이력</h2>
        <ol className="space-y-3 text-sm">
          {j.events.map((e) => (
            <li key={e.id}>
              <span className="mr-3 text-slate-500">
                {dateTime(e.created_at)}
              </span>
              {messageLabel(e.action)}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
