import Link from "next/link";
import { randomUUID } from "node:crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PageIntro, Empty } from "@/components/portal/ui";
import { ActionForm } from "@/components/portal/action-form";
import { previewMessage } from "@/app/message-actions";
import { dateTime } from "@/lib/portal/data";
import {
  messageLabel,
  type MessageOptions,
  type MessageJob,
} from "@/lib/messaging/types";
export default async function Messages() {
  const db = await createServerSupabaseClient();
  const [options, history] = await Promise.all([
    db.rpc("life_message_options"),
    db.rpc("life_message_overview"),
  ]);
  if (options.error || history.error)
    return (
      <div className="page-shell">
        <Empty title="안내문자 정보를 불러오지 못했습니다" />
      </div>
    );
  const data = options.data as MessageOptions,
    jobs = history.data as MessageJob[];
  const scheduled = new Date(Date.now() + (9 * 60 + 10) * 60000)
    .toISOString()
    .slice(0, 16);
  return (
    <div className="page-shell">
      <PageIntro eyebrow="MESSAGES" title="안내문자 관리">
        기수별 대상과 문안을 확인하고 예약·취소 이력을 관리합니다.
      </PageIntro>
      <p className="notice mb-8">
        실제 문자 발송은 연결 전입니다. 업체·발신번호·요금이 확정되면
        연결합니다. 지금 저장한 예약은 실제 전송되지 않으며 자동으로 발송을
        시작하지 않습니다.
      </p>
      <section className="panel mb-10">
        <h2 className="section-title">1. 문안과 대상 미리보기</h2>
        {!data.templates.length || !data.offerings.length ? (
          <Empty title="승인 문안과 기수 등록이 필요합니다">
            승인 문안에는 운영·홍보 구분과 대상 조건이 지정되어야 합니다.
          </Empty>
        ) : (
          <ActionForm action={previewMessage} label="대상·문안 미리보기">
            <input type="hidden" name="request_key" value={randomUUID()} />
            <div className="grid gap-4 md:grid-cols-2">
              <label className="field">
                대상 기수
                <select name="f" required>
                  <option value="">기수를 선택하세요</option>
                  {data.offerings.map((o) => (
                    <option value={o.id} key={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                승인 문안 · 종류 · 대상
                <select name="t" required>
                  <option value="">같은 기관의 문안을 선택하세요</option>
                  {data.templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {messageLabel(t.kind)} · {t.title} ·{" "}
                      {messageLabel(t.audience)} ({t.version})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                예약시각 (한국시간 · 30일 이내)
                <input
                  type="datetime-local"
                  name="scheduled"
                  defaultValue={scheduled}
                  required
                />
              </label>
            </div>
            <p className="text-sm text-slate-600">
              승인 문안은 다음 화면에서 확인합니다. 연락처 미인증, 대상 조건
              불일치, 홍보 미동의 등을 자동 제외합니다.
            </p>
          </ActionForm>
        )}
      </section>
      <h2 className="section-title">
        최근 예약·처리 이력{" "}
        <span className="text-sm font-normal text-slate-500">최근 100개</span>
      </h2>
      {!jobs.length ? (
        <Empty title="저장된 작업이 없습니다" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {jobs.map((j) => (
            <Link
              key={j.id}
              href={`/admin/messages/${j.id}`}
              className="panel min-w-0 hover:border-teal-700"
            >
              <div className="flex flex-wrap gap-2">
                <span className="badge">{messageLabel(j.status)}</span>
                <span className="badge">{messageLabel(j.kind)}</span>
              </div>
              <h3 className="mt-3 text-lg font-bold">{j.title}</h3>
              <p className="mt-2 break-words text-sm">{j.name}</p>
              <p className="mt-3 text-sm text-slate-500">
                예약 {dateTime(j.scheduled_at)} · 모집단 {j.total}명
              </p>
              <p className="mt-2 text-sm font-semibold text-teal-800">
                문안·대상·처리 이력 보기 →
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
