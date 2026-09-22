import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PageIntro, Empty } from "@/components/portal/ui";
import { ActionForm } from "@/components/portal/action-form";
import { setMarketing, disconnectContact } from "@/app/message-actions";
import { dateTime } from "@/lib/portal/data";
import type { NotificationPreference } from "@/lib/messaging/types";
export default async function Notifications() {
  const { data, error } = await (
    await createServerSupabaseClient()
  ).rpc("life_notification_preferences");
  const settings = (data ?? []) as NotificationPreference[];
  return (
    <div className="page-shell">
      <PageIntro eyebrow="NOTIFICATION SETTINGS" title="연락처·홍보 수신 설정">
        홍보 수신은 선택 사항입니다. 동의하지 않거나 철회해도 수강 신청과 학습을
        이용할 수 있습니다.
      </PageIntro>
      <p className="notice mb-8">
        휴대전화 등록은 본인확인 서비스 연결 후 제공됩니다. 현재 실제 문자
        발송은 연결 전입니다. 운영 안내와 홍보 수신동의는 별도로 관리합니다.
      </p>
      {error ? (
        <Empty title="설정을 불러오지 못했습니다" />
      ) : (
        settings.map((s) => (
          <article key={s.id} className="panel mb-6">
            <h2 className="section-title">{s.name}</h2>
            <div className="grid items-start gap-8 md:grid-cols-2">
              <section>
                <h3 className="mb-3 font-bold">인증 연락처</h3>
                <p>
                  {s.contact
                    ? `${s.contact.label} · ${s.contact.valid ? "인증 유효" : "인증 만료"}`
                    : "연결된 인증 연락처가 없습니다."}
                </p>
                {s.contact && (
                  <>
                    <p className="mt-2 text-sm text-slate-500">
                      인증 유효기한 {dateTime(s.contact.until)}
                    </p>
                    <div className="mt-5">
                      <ActionForm
                        action={disconnectContact}
                        label="연락처 연결 해제"
                      >
                        <input type="hidden" name="o" value={s.id} />
                        <label className="flex items-start gap-3 text-sm">
                          <input
                            type="checkbox"
                            name="confirmed"
                            required
                            className="mt-1"
                          />
                          연결 해제 후에는 운영 안내 문자도 받을 수 없음을
                          확인합니다.
                        </label>
                      </ActionForm>
                    </div>
                  </>
                )}
              </section>
              <section>
                <h3 className="mb-3 font-bold">SMS 홍보 수신 (선택)</h3>
                <span className="badge">
                  {s.effective
                    ? "수신 동의 중"
                    : s.accepted
                      ? "동의문 유효기간 확인 필요"
                      : "수신 미동의"}
                </span>
                {s.accepted && (
                  <div className="mt-5">
                    <ActionForm action={setMarketing} label="홍보 동의 철회">
                      <input type="hidden" name="o" value={s.id} />
                      <input type="hidden" name="accepted" value="false" />
                      <p className="text-sm">
                        예약 대기 중인 홍보 대상에서 즉시 제외됩니다.
                      </p>
                    </ActionForm>
                  </div>
                )}
                {!s.policies.length && (
                  <p className="notice mt-5">
                    승인된 홍보 동의문 등록 후 동의 설정을 제공합니다.
                  </p>
                )}
                {s.policies.map((p) => (
                  <details key={p.id} className="mt-5 rounded-lg border p-4">
                    <summary className="cursor-pointer font-semibold">
                      {p.title} · {p.version}
                    </summary>
                    <p className="my-5 whitespace-pre-wrap break-words text-sm leading-7">
                      {p.body}
                    </p>
                    <ActionForm
                      action={setMarketing}
                      label="이 동의문으로 수신 동의"
                    >
                      <input type="hidden" name="o" value={s.id} />
                      <input type="hidden" name="policy" value={p.id} />
                      <input type="hidden" name="accepted" value="true" />
                      <label className="flex items-start gap-3 text-sm">
                        <input
                          type="checkbox"
                          name="confirmed"
                          required
                          className="mt-1"
                        />
                        위 원문을 확인하고 SMS 홍보 수신에 선택 동의합니다.
                      </label>
                    </ActionForm>
                  </details>
                ))}
              </section>
            </div>
            <details className="mt-8 border-t pt-5">
              <summary className="cursor-pointer font-semibold">
                나의 동의·철회 이력 (최근 20개)
              </summary>
              {s.events.length ? (
                <ol className="mt-4 space-y-3 text-sm">
                  {s.events.map((e) => (
                    <li key={e.id}>
                      {dateTime(e.recorded_at)} · {e.accepted ? "동의" : "철회"}{" "}
                      · {e.title ?? "기존 동의 없음"} {e.version ?? ""}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  기록된 변경이 없습니다.
                </p>
              )}
            </details>
          </article>
        ))
      )}
    </div>
  );
}
