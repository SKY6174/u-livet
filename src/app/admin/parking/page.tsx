import Link from "next/link";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/workspace-navigation";
import { getAdminParkingContext } from "@/lib/parking/data";
import {
  PARKING_CENTERS,
  PARKING_STATUS_LABELS,
  type ParkingCenterCode,
} from "@/lib/parking/types";
import { PageIntro } from "@/components/portal/ui";
import { ParkingPrintButton } from "@/components/parking/print-button";
import {
  addParkingStock,
  assignParkingCenter,
  decideParkingVoucher,
} from "./actions";

const field =
  "mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900";
const dateText = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(value))
    : "";

export default async function AdminParkingPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    center?: string;
    notice?: string;
    error?: string;
  }>;
}) {
  const me = await requireIdentity("/admin/parking");
  if (!hasRole(me, "COURSE_MANAGER", "SYSTEM_ADMIN")) notFound();
  const params = await searchParams;
  const currentYear = Number(
    new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Seoul",
      year: "numeric",
    }).format(new Date()),
  );
  const year =
    /^\d{4}$/.test(params.year ?? "") &&
    Number(params.year) >= 2020 &&
    Number(params.year) <= 2100
      ? Number(params.year)
      : currentYear;
  const center = PARKING_CENTERS.includes(params.center as ParkingCenterCode)
    ? (params.center as ParkingCenterCode)
    : null;
  const data = await getAdminParkingContext(year, center);
  const orgs = data?.organizations ?? [];
  const pending = data?.requests.filter((r) => r.status === "PENDING") ?? [];
  const issued = data?.requests.filter((r) => r.status === "APPROVED") ?? [];
  const header = <input type="hidden" name="year" value={year} />;
  const filterCenter = (
    <input type="hidden" name="filter_center" value={center ?? ""} />
  );
  return (
    <div className="page-shell space-y-8">
      <div className="parking-screen">
        <PageIntro eyebrow="PARKING VOUCHERS" title="무료 주차권 관리">
          과정별 담당 센터를 지정하고, 재고 입고·신청·승인 이력을 한곳에서
          관리합니다. 실제 발급 내역은 원본 양식의 사용대장 열로 인쇄할 수
          있습니다.
        </PageIntro>
      </div>
      {!data ? (
        <p role="alert" className="panel parking-screen">
          주차권 자료를 불러오지 못했습니다. 데이터베이스와 추가 인증 상태를
          확인해 주세요.
        </p>
      ) : (
        <>
          <div className="parking-screen space-y-6">
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
            <div className="flex flex-wrap items-end justify-between gap-4">
              <form method="get" className="flex flex-wrap items-end gap-3">
                <label className="text-sm font-semibold">
                  연도
                  <input
                    className={field + " w-28"}
                    name="year"
                    type="number"
                    min="2020"
                    max="2100"
                    defaultValue={year}
                  />
                </label>
                <label className="text-sm font-semibold">
                  센터
                  <select
                    className={field}
                    name="center"
                    defaultValue={center ?? ""}
                  >
                    <option value="">전체</option>
                    {data.centers.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="btn-secondary" type="submit">
                  조회
                </button>
              </form>
              <ParkingPrintButton />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {data.centers.map((c) => (
                <div key={c.code} className="panel">
                  <p className="text-sm font-semibold text-teal-800">
                    {c.label}
                  </p>
                  <p className="mt-2 text-2xl font-bold">
                    {data.stock
                      .filter((s) => s.center_code === c.code)
                      .reduce((sum, s) => sum + s.balance, 0)
                      .toLocaleString("ko-KR")}
                    매
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    승인: {c.reviewer_name} 선임연구원
                  </p>
                  <p className="text-xs text-slate-500">{c.reviewer_email}</p>
                </div>
              ))}
            </div>
            <section
              className="grid gap-5 lg:grid-cols-2"
              aria-label="주차권 운영 설정"
            >
              <div className="panel">
                <h2 className="text-lg font-bold">과정 담당 센터 지정</h2>
                <p className="mt-1 text-sm text-slate-600">
                  아카데미와 센터는 별도 정보입니다. 과정을 선택해 지정해
                  주세요.
                </p>
                <form action={assignParkingCenter} className="mt-4 space-y-3">
                  {header}
                  {filterCenter}
                  <label className="block text-sm font-semibold">
                    교육과정
                    <select
                      name="offering_id"
                      required
                      className={field}
                      defaultValue=""
                    >
                      <option value="" disabled>
                        과정 선택
                      </option>
                      {data.offerings.map((o) => (
                        <option value={o.id} key={o.id}>
                          {o.name} ({o.center_code ?? "미지정"})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-semibold">
                    담당 센터
                    <select
                      name="center_code"
                      required
                      className={field}
                      defaultValue=""
                    >
                      <option value="" disabled>
                        센터 선택
                      </option>
                      {data.centers.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.label} · {c.reviewer_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="btn-primary"
                    type="submit"
                    disabled={!data.offerings.length}
                  >
                    센터 저장
                  </button>
                </form>
              </div>
              <div className="panel">
                <h2 className="text-lg font-bold">주차권 재고 입고</h2>
                <p className="mt-1 text-sm text-slate-600">
                  실물 주차권을 받은 수량을 등록합니다. 승인 시 여기서
                  차감됩니다.
                </p>
                <form action={addParkingStock} className="mt-4 space-y-3">
                  {header}
                  {filterCenter}
                  <label className="block text-sm font-semibold">
                    사업단
                    <select
                      name="org_id"
                      required
                      className={field}
                      defaultValue={orgs[0]?.id ?? ""}
                    >
                      {orgs.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-semibold">
                      센터
                      <select
                        name="center_code"
                        required
                        className={field}
                        defaultValue=""
                      >
                        <option value="" disabled>
                          선택
                        </option>
                        {data.centers.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-sm font-semibold">
                      입고 매수
                      <input
                        type="number"
                        name="quantity"
                        className={field}
                        min="1"
                        max="10000"
                        required
                      />
                    </label>
                  </div>
                  <label className="block text-sm font-semibold">
                    입고 사유
                    <input
                      name="note"
                      className={field}
                      placeholder="예: 9월 주차권 50매 수령"
                      maxLength={500}
                      required
                    />
                  </label>
                  <button
                    className="btn-primary"
                    type="submit"
                    disabled={!orgs.length}
                  >
                    재고 등록
                  </button>
                </form>
              </div>
            </section>
            <section aria-labelledby="parking-pending">
              <h2 id="parking-pending" className="section-title">
                승인 대기 · {pending.length}건
              </h2>
              {!pending.length ? (
                <p className="panel text-sm text-slate-600">
                  승인 대기 신청이 없습니다.
                </p>
              ) : (
                <div className="grid gap-4">
                  {pending.map((r) => (
                    <article className="panel" key={r.id}>
                      <div className="flex flex-wrap justify-between gap-3">
                        <div>
                          <h3 className="font-bold">{r.course_name}</h3>
                          <p className="mt-1 text-sm text-slate-600">
                            {r.center_code} · 교육일 {r.use_on} · {r.quantity}매
                          </p>
                        </div>
                        <span className="badge">
                          {PARKING_STATUS_LABELS[r.status]}
                        </span>
                      </div>
                      <p className="mt-3 text-sm">
                        요청자 {r.requester_name} · 수령자 {r.recipient_name} ·
                        연락처 {r.phone}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        신청일 {dateText(r.requested_at)}
                      </p>
                      {r.can_decide ? (
                        <form
                          action={decideParkingVoucher}
                          className="mt-4 flex flex-wrap items-end gap-3"
                        >
                          {header}
                          {filterCenter}
                          <input type="hidden" name="request_id" value={r.id} />
                          <label className="min-w-[15rem] flex-1 text-sm font-semibold">
                            처리 메모·반려 사유
                            <input
                              name="note"
                              className={field}
                              maxLength={500}
                              placeholder="반려 시 사유 필수"
                            />
                          </label>
                          <button
                            className="btn-primary"
                            name="decision"
                            value="approve"
                            type="submit"
                          >
                            승인·발급
                          </button>
                          <button
                            className="btn-secondary"
                            name="decision"
                            value="reject"
                            type="submit"
                          >
                            반려
                          </button>
                        </form>
                      ) : (
                        <p className="mt-3 text-sm text-amber-800">
                          {
                            data.centers.find((c) => c.code === r.center_code)
                              ?.reviewer_name
                          }{" "}
                          담당자의 본인 계정·추가 인증으로 승인할 수 있습니다.
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
            <section aria-labelledby="parking-all">
              <h2 id="parking-all" className="section-title">
                신청·처리 기록
              </h2>
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full min-w-[750px] text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="p-3">신청일</th>
                      <th className="p-3">센터·과정</th>
                      <th className="p-3">신청자·수령자</th>
                      <th className="p-3">사용일</th>
                      <th className="p-3">매수</th>
                      <th className="p-3">상태</th>
                      <th className="p-3">확인자</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.requests.map((r) => (
                      <tr key={r.id}>
                        <td className="p-3">{dateText(r.requested_at)}</td>
                        <td className="p-3">
                          <strong>{r.center_code}</strong>
                          <br />
                          {r.course_name}
                        </td>
                        <td className="p-3">
                          {r.requester_name} · {r.recipient_name}
                          <br />
                          <span className="text-slate-500">{r.phone}</span>
                        </td>
                        <td className="p-3">{r.use_on}</td>
                        <td className="p-3">{r.quantity}</td>
                        <td className="p-3">
                          {PARKING_STATUS_LABELS[r.status]}
                          {r.status === "APPROVED" && (
                            <span className="block text-xs text-slate-500">
                              잔여 {r.remaining_after}매
                            </span>
                          )}
                        </td>
                        <td className="p-3">{r.reviewer_name ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.requests.length && (
                  <p className="p-5 text-sm text-slate-600">
                    이 연도의 신청 기록이 없습니다.
                  </p>
                )}
              </div>
            </section>
            <Link
              href="/admin"
              className="text-sm font-semibold text-teal-800 underline"
            >
              사업단 관리로 돌아가기
            </Link>
          </div>
          <div className="parking-print-root">
            {data.centers
              .filter((c) => center === null || c.code === center)
              .map((c) => {
                const rows = issued.filter((r) => r.center_code === c.code);
                return (
                  <section className="parking-ledger" key={c.code}>
                    <h1>무료 주차권 사용대장</h1>
                    <p className="parking-ledger-sub">
                      ({c.label})　{year}년　·　확인 담당 {c.reviewer_name}
                    </p>
                    <table>
                      <colgroup>
                        <col style={{ width: "10%" }} />
                        <col style={{ width: "10%" }} />
                        <col style={{ width: "27%" }} />
                        <col style={{ width: "10%" }} />
                        <col style={{ width: "15%" }} />
                        <col style={{ width: "9%" }} />
                        <col style={{ width: "9%" }} />
                        <col style={{ width: "10%" }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>일자</th>
                          <th>요청자</th>
                          <th>
                            지급사유
                            <br />
                            (구체적으로)
                          </th>
                          <th>수령자명</th>
                          <th>연락처</th>
                          <th>지급 매수</th>
                          <th>남은 매수</th>
                          <th>확인자</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.id}>
                            <td>{dateText(r.reviewed_at)}</td>
                            <td>{r.requester_name}</td>
                            <td>
                              {r.course_name}
                              <br />
                              <small>교육일 {r.use_on}</small>
                            </td>
                            <td>{r.recipient_name}</td>
                            <td>{r.phone}</td>
                            <td>{r.quantity}</td>
                            <td>{r.remaining_after}</td>
                            <td>{r.reviewer_name}</td>
                          </tr>
                        ))}
                        {!rows.length && (
                          <tr>
                            <td colSpan={8} className="empty-ledger">
                              발급 내역 없음
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    <p className="parking-ledger-foot">
                      ※ 단체교육: 요청자(담당부서장), 지급사유(교육프로그램명),
                      지급매수(지급수량) 기재
                    </p>
                  </section>
                );
              })}
          </div>
        </>
      )}
      <style>{`@media screen {.parking-print-root{display:none}} @media print {@page{size:A4 portrait;margin:12mm}body *{visibility:hidden!important}.parking-print-root,.parking-print-root *{visibility:visible!important}.parking-print-root{display:block!important;position:absolute;top:0;left:0;width:100%;font-family:Arial,"Apple SD Gothic Neo",sans-serif;color:#111}.parking-screen{display:none!important}.parking-ledger{break-after:page;padding:0}.parking-ledger:last-child{break-after:auto}.parking-ledger h1{text-align:center;font-size:20px;margin:0 0 14px}.parking-ledger-sub{text-align:right;font-size:11px;margin:0 0 8px}.parking-ledger table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:8px}.parking-ledger th,.parking-ledger td{border:1px solid #222;padding:5px 3px;text-align:center;overflow-wrap:anywhere}.parking-ledger th{background:#f3f3f3;font-weight:700;height:38px}.parking-ledger td{height:30px}.parking-ledger td:nth-child(3){text-align:left}.parking-ledger thead{display:table-header-group}.parking-ledger tr{break-inside:avoid}.parking-ledger small{color:#555}.parking-ledger-foot{font-size:8px;margin-top:9px}.empty-ledger{height:80px!important}}`}</style>
    </div>
  );
}
