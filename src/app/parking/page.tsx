import Link from "next/link";
import { requireIdentity } from "@/lib/auth/session";
import { PageIntro } from "@/components/portal/ui";
import { getMyParkingContext } from "@/lib/parking/data";
import { PARKING_STATUS_LABELS } from "@/lib/parking/types";
import { cancelParkingVoucher, requestParkingVoucher } from "./actions";

const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
    new Date(),
  );
const shownDate = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));

export default async function ParkingPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const me = await requireIdentity("/parking");
  const data = await getMyParkingContext();
  const params = await searchParams;
  const available =
    data?.offerings.filter((offering) => offering.center_code) ?? [];
  const unassigned =
    data?.offerings.filter((offering) => !offering.center_code) ?? [];
  return (
    <div className="page-shell space-y-8">
      <PageIntro eyebrow="MY PARKING" title="무료 주차권 신청">
        수강 중인 과정 또는 담당하는 교외강사 과정의 교육일에 사용할 주차권을
        신청하세요. 담당 센터가 확인한 후 발급 여부가 표시됩니다.
      </PageIntro>
      {params.notice && (
        <p
          role="status"
          className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900"
        >
          {params.notice}
        </p>
      )}
      {params.error && (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
        >
          {params.error}
        </p>
      )}
      {!data ? (
        <p role="alert" className="panel">
          신청 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      ) : (
        <>
          <section className="panel" aria-labelledby="parking-request-title">
            <h2 id="parking-request-title" className="text-xl font-bold">
              발급 요청
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              신청자와 수령자는 로그인한 {me.name}님으로 기록됩니다. 교육일과
              연락처를 확인해 주세요.
            </p>
            {available.length ? (
              <form
                action={requestParkingVoucher}
                className="mt-6 grid gap-4 md:grid-cols-2"
              >
                <label className="text-sm font-semibold text-slate-700">
                  교육과정
                  <select
                    name="offering_id"
                    required
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      과정을 선택하세요
                    </option>
                    {available.map((o) => (
                      <option value={o.id} key={o.id}>
                        {o.name} · {o.center_code} · {o.starts_on}~{o.ends_on}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  사용일
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
                    type="date"
                    name="use_on"
                    min={today()}
                    required
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  연락처
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
                    type="tel"
                    name="phone"
                    inputMode="tel"
                    pattern="0[0-9-]{8,15}"
                    placeholder="010-1234-5678"
                    maxLength={16}
                    required
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  지급 요청 매수
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
                    type="number"
                    name="quantity"
                    min="1"
                    max="10"
                    defaultValue="1"
                    required
                  />
                </label>
                <div className="md:col-span-2">
                  <button className="btn-primary" type="submit">
                    발급 요청하기
                  </button>
                </div>
              </form>
            ) : (
              <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                현재 신청할 수 있는 교육과정이 없습니다. 수강 확정·강사 배정과
                담당 센터 지정을 확인해 주세요.
              </p>
            )}
            {!!unassigned.length && (
              <p className="mt-4 text-sm text-amber-800">
                담당 센터 지정 대기: {unassigned.map((o) => o.name).join(", ")}
              </p>
            )}
          </section>
          <section aria-labelledby="parking-history-title">
            <h2 id="parking-history-title" className="section-title">
              내 신청 내역
            </h2>
            {!data.requests.length ? (
              <p className="panel text-sm text-slate-600">
                아직 신청 내역이 없습니다.
              </p>
            ) : (
              <div className="grid gap-4">
                {data.requests.map((r) => (
                  <article key={r.id} className="panel">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-slate-900">
                          {r.course_name}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">
                          {r.center_code} · 사용일 {r.use_on} · {r.quantity}매
                        </p>
                      </div>
                      <span className="badge">
                        {PARKING_STATUS_LABELS[r.status]}
                      </span>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">
                      신청 {shownDate(r.requested_at)} · 수령자{" "}
                      {r.recipient_name} · 연락처 {r.phone}
                    </p>
                    {r.decision_note && (
                      <p className="mt-3 text-sm text-slate-700">
                        처리 메모: {r.decision_note}
                      </p>
                    )}
                    {r.status === "PENDING" && (
                      <form action={cancelParkingVoucher} className="mt-4">
                        <input type="hidden" name="request_id" value={r.id} />
                        <button type="submit" className="btn-secondary">
                          신청 취소
                        </button>
                      </form>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
      <Link
        href={
          me.roles.some((r) => r.role === "INSTRUCTOR")
            ? "/instructor"
            : "/mypage"
        }
        className="text-sm font-semibold text-teal-800 underline"
      >
        내 페이지로 돌아가기
      </Link>
    </div>
  );
}
