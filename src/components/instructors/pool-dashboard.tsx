import Link from "next/link";
import {
  Users,
  Building2,
  GraduationCap,
  FileCheck2,
  Wallet,
  Plus,
  ArrowUpRight,
  Search,
  BookOpen,
  BadgeCheck,
  CircleHelp,
  ClipboardList,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  ACTIVITY_LABELS,
  KIND_LABELS,
  PAYMENT_LABELS,
  documentReady,
  money,
  type PoolBoard,
  type PoolPerson,
} from "@/lib/instructors/pool";
import { PoolPersonForm, AllowanceForm, PaymentForm } from "./pool-forms";
import { PoolExcel } from "./pool-excel";
import { PoolRowActions } from "./pool-row-actions";
import { DocumentPopup } from "@/components/instructor-documents/document-popup";
export type PoolQuery = {
  org?: string;
  tab?: string;
  q?: string;
  kind?: string;
  page?: string;
  person?: string;
  new?: string;
  edit?: string;
  activity_page?: string;
  add?: string;
  allowance?: string;
  d?: string;
};
const TABS = [
  ["master", "강사 마스터", Users],
  ["history", "강의·활동 이력", BookOpen],
  ["payments", "수당 지급", Wallet],
  ["review", "이력 심사", FileCheck2],
] as const;
function Badge({ kind }: { kind: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${kind === "INTERNAL" ? "bg-emerald-50 text-emerald-700" : kind === "EXTERNAL" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}
    >
      {KIND_LABELS[kind]}
    </span>
  );
}
function DocumentCell({
  person,
  org,
  kind,
}: {
  person: PoolPerson;
  org: string;
  kind: "identity" | "resume" | "privacy" | "criminal" | "integrity";
}) {
  const complete =
    kind === "identity"
      ? person.documents.id && person.documents.bank
      : person.documents[kind];
  const label = {
    identity: "신분증·통장사본",
    resume: "이력서",
    privacy: "개인정보동의",
    criminal: "성범죄 조회동의",
    integrity: "청렴서약",
  }[kind];
  const required =
    kind === "identity"
      ? person.documents_required
      : kind === "resume"
        ? person.kind === "EXTERNAL" || person.documents_required
        : person.kind === "EXTERNAL";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`rounded-full px-2 py-1 text-xs font-semibold ${complete ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
      >
        {complete ? "제출 완료" : !required ? "필수 제출 면제" : "미제출"}
      </span>
      {person.document_access && (
        <DocumentPopup
          href={`/admin/instructors/documents?org=${org}&person=${person.id}&document=${kind}`}
          label={`${person.name} ${label} 입력 (새 창)`}
          className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-600 hover:bg-blue-100"
        >
          ↥ {kind === "identity" || kind === "resume" ? "입력" : label}
        </DocumentPopup>
      )}
    </div>
  );
}
export function PoolDashboard({
  org,
  orgs,
  board,
  query,
  review,
}: {
  org: string;
  orgs: { id: string; name: string }[];
  board: PoolBoard;
  query: PoolQuery;
  review?: ReactNode;
}) {
  const tab = TABS.some(([id]) => id === query.tab) ? query.tab! : "master";
  const q = query.q ?? "",
    kind = query.kind ?? "ALL",
    selected = board.selected;
  const url = (change: Partial<PoolQuery>) => {
    const all = { ...query, org, ...change };
    const params = new URLSearchParams();
    Object.entries(all).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return `/admin/instructors?${params}`;
  };
  const changeTab = (value: string) =>
    url({
      tab: value,
      page: undefined,
      activity_page: undefined,
      person: undefined,
      new: undefined,
      edit: undefined,
      add: undefined,
      allowance: undefined,
      d: undefined,
    });
  const docUrl = (id: string) =>
    `/admin/instructors/documents?org=${org}&person=${id}`;
  const allowance = board.selected_allowance;
  const cards = [
    {
      label: "등록 강사",
      value: `${board.counts.total}명`,
      sub: `구분 확인 ${board.counts.unclassified}명`,
      icon: Users,
      color: "text-blue-700 bg-blue-50",
    },
    {
      label: "교내 강사",
      value: `${board.counts.internal}명`,
      sub: "대학 소속 강사",
      icon: Building2,
      color: "text-emerald-700 bg-emerald-50",
    },
    {
      label: "교외 강사",
      value: `${board.counts.external}명`,
      sub: "외부 전문가·실무 강사",
      icon: GraduationCap,
      color: "text-amber-700 bg-amber-50",
    },
    {
      label: "서류 준비",
      value: `${board.counts.ready}명`,
      sub: "필수 제출 완료·면제",
      icon: FileCheck2,
      color: "text-violet-700 bg-violet-50",
    },
    {
      label: "지급 대기",
      value: money(board.counts.pending),
      sub: `누적 실지급 ${money(board.counts.paid)}`,
      icon: Wallet,
      color: "text-blue-700 bg-blue-50",
    },
  ];
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8 md:px-8">
      <header className="flex flex-wrap items-center justify-between gap-6 rounded-3xl border border-blue-100 bg-gradient-to-br from-white via-white to-blue-50 p-6 shadow-sm md:p-8">
        <div className="flex items-start gap-4">
          <div className="hidden rounded-2xl bg-blue-600 p-4 text-white sm:block">
            <Users size={28} />
          </div>
          <div>
            <p className="mb-2 text-xs font-extrabold tracking-widest text-blue-600">
              INSTRUCTOR POOL
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">
              평생직업교육 강사 관리
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              교내·교외 강사의 기본정보부터 강의 참여, 증빙서류, 수당 지급
              기록까지 한곳에서 관리합니다.
            </p>
          </div>
        </div>
        <form className="flex items-end gap-2">
          <label className="field !gap-1 text-xs">
            담당 기관
            <select
              className="max-w-[270px] !py-2"
              name="org"
              defaultValue={org}
            >
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <button className="btn-secondary !px-3 !py-2">적용</button>
        </form>
      </header>
      <div className="my-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.map(({ label, value, sub, icon: Icon, color }) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-500">
                {label}
              </span>
              <span className={`rounded-lg p-2 ${color}`}>
                <Icon size={18} />
              </span>
            </div>
            <p className="mt-3 text-xl font-extrabold tracking-tight text-slate-900 md:text-2xl">
              {value}
            </p>
            <p className="mt-1 text-xs text-slate-500">{sub}</p>
          </div>
        ))}
      </div>
      <nav
        aria-label="강사 관리"
        className="mb-6 flex gap-2 overflow-x-auto border-b border-slate-200"
      >
        {TABS.map(([id, label, Icon]) => (
          <Link
            key={id}
            href={changeTab(id)}
            aria-current={tab === id ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-4 text-sm font-bold ${tab === id ? "border-blue-600 bg-blue-50 text-blue-700" : "border-transparent text-slate-500 hover:text-blue-700"}`}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>
      {tab === "review" ? (
        review
      ) : (
        <>
          <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">
                  {tab === "master"
                    ? "강사 마스터 대장"
                    : tab === "history"
                      ? "강의 참여와 활동 이력"
                      : "수당 지급 대장"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {tab === "master"
                    ? "기본정보·제출 서류·과정 참여 현황을 확인하세요."
                    : tab === "history"
                      ? "강사별 과정 배정과 확정 강의시간, 별도 활동을 함께 확인하세요."
                      : "활동 산출액, 공제액, 실제 지급과 증빙 참조를 관리합니다."}
                </p>
              </div>
              <Link
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
                href={url({
                  tab: "master",
                  new: "1",
                  person: undefined,
                  edit: undefined,
                  allowance: undefined,
                })}
              >
                <Plus size={18} />
                강사 신규 등록
              </Link>
            </div>
            <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
              <form className="flex max-w-full items-center gap-2">
                <input type="hidden" name="org" value={org} />
                <input type="hidden" name="tab" value={tab} />
                <input type="hidden" name="kind" value={kind} />
                <label className="relative">
                  <span className="sr-only">성명·소속·전문분야 검색</span>
                  <Search
                    className="absolute left-3 top-3 text-slate-400"
                    size={17}
                  />
                  <input
                    className="w-64 max-w-[65vw] rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm"
                    name="q"
                    defaultValue={q}
                    placeholder="성명·소속·전문분야 검색"
                    maxLength={100}
                  />
                </label>
                <button className="btn-secondary !px-3 !py-2.5 text-sm">
                  검색
                </button>
              </form>
              <PoolExcel
                org={org}
                q={q}
                kind={kind}
                person={query.person ?? null}
                tab={tab}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(KIND_LABELS).map(([value, label]) => (
                <Link
                  key={value}
                  href={url({
                    kind: value,
                    page: undefined,
                    activity_page: undefined,
                    person: undefined,
                    edit: undefined,
                    new: undefined,
                    allowance: undefined,
                    add: undefined,
                  })}
                  className={`rounded-full border px-4 py-2 text-xs font-bold ${kind === value ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"}`}
                >
                  {label}{" "}
                  {value === "ALL"
                    ? board.counts.total
                    : value === "INTERNAL"
                      ? board.counts.internal
                      : value === "EXTERNAL"
                        ? board.counts.external
                        : board.counts.unclassified}
                </Link>
              ))}
            </div>
          </section>
          {(query.new === "1" ||
            (query.edit === "1" && selected && !selected.removed)) && (
            <section className="panel mb-6 border-blue-200">
              <div className="mb-5 flex justify-between gap-4">
                <h2 className="text-lg font-bold">
                  {query.new === "1"
                    ? "강사 신규 등록"
                    : `${selected!.name} · 기본정보`}
                </h2>
                <Link
                  className="text-sm text-slate-500"
                  href={url({ new: undefined, edit: undefined })}
                >
                  닫기
                </Link>
              </div>
              <PoolPersonForm
                key={`${selected?.id ?? "new"}-${selected?.revision ?? 0}`}
                org={org}
                person={query.new === "1" ? undefined : (selected ?? undefined)}
                requestKey={crypto.randomUUID()}
              />
            </section>
          )}
          {tab === "master" && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b p-5">
                <p className="text-sm text-slate-600">
                  검색 결과{" "}
                  <strong className="text-blue-700">{board.total}명</strong>
                </p>
                <span className="text-xs text-slate-400">
                  개인정보·계좌 원문은 비공개 서류함에서 확인
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1080px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      {[
                        "강사",
                        "소속 / 부서 · 직위",
                        "전문분야",
                        "참여 과정",
                        "신분증·통장사본",
                        "이력서",
                        "동의서·서약서",
                        "누적 실지급액",
                        "관리",
                      ].map((h) => (
                        <th key={h} className="px-4 py-4 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {board.items.map((person) => (
                      <tr key={person.id} className="hover:bg-blue-50/30">
                        <td className="px-4 py-5">
                          <Link
                            className="font-bold text-blue-700"
                            href={url({
                              tab: "history",
                              person: person.id,
                              edit: undefined,
                              new: undefined,
                            })}
                          >
                            {person.name}
                          </Link>
                          <div className="mt-2 flex gap-1">
                            <Badge kind={person.kind} />
                            {person.teaching_role === "ASSISTANT" && (
                              <span className="rounded-full bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700">
                                보조강사
                              </span>
                            )}
                            {person.status === "INACTIVE" && (
                              <span className="text-xs text-slate-400">
                                중지
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-5">
                          <p className="font-medium">
                            {person.affiliation || "소속 미등록"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {[person.department, person.position]
                              .filter(Boolean)
                              .join(" · ") || "부서·직위 미등록"}
                          </p>
                        </td>
                        <td className="max-w-[180px] px-4 py-5 text-slate-600">
                          {person.specialty || "전문분야 미등록"}
                        </td>
                        <td className="px-4 py-5">
                          <Link
                            className="whitespace-nowrap rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"
                            href={url({
                              tab: "history",
                              person: person.id,
                              edit: undefined,
                              new: undefined,
                            })}
                          >
                            {person.courses}개 과정
                          </Link>
                        </td>
                        <td className="px-4 py-5">
                          <DocumentCell
                            person={person}
                            org={org}
                            kind="identity"
                          />
                        </td>
                        <td className="px-4 py-5">
                          <DocumentCell
                            person={person}
                            org={org}
                            kind="resume"
                          />
                        </td>
                        <td className="space-y-2 px-4 py-5">
                          {(["privacy", "criminal", "integrity"] as const).map(
                            (kind) => (
                              <DocumentCell
                                key={kind}
                                person={person}
                                org={org}
                                kind={kind}
                              />
                            ),
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-5 font-semibold">
                          {money(person.paid)}
                          <p className="mt-1 text-xs font-normal text-slate-400">
                            대기 {money(person.pending)}
                          </p>
                        </td>
                        <td className="px-4 py-5">
                          <PoolRowActions
                            org={org}
                            person={person}
                            editUrl={url({
                              person: person.id,
                              edit: "1",
                              new: undefined,
                            })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!board.items.length && (
                <div className="px-5 py-14 text-center">
                  <Users size={36} className="mx-auto text-blue-200" />
                  <h3 className="mt-4 font-bold">
                    {q
                      ? "검색 조건에 맞는 강사가 없습니다"
                      : "강사 대장을 시작해 보세요"}
                  </h3>
                  <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
                    신규 등록 또는 엑셀 등록으로 교내·교외 강사를 추가하세요.
                    등록 후 서류 제출과 활동·수당 기록을 이어서 관리할 수
                    있습니다.
                  </p>
                  <Link
                    className="mt-5 inline-flex items-center gap-2 font-bold text-blue-600"
                    href={url({ new: "1", edit: undefined, person: undefined })}
                  >
                    첫 강사 등록
                    <ArrowUpRight size={16} />
                  </Link>
                </div>
              )}
            </section>
          )}
          {tab === "history" && (
            <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
              <aside className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="mb-3 text-sm font-bold">
                  강사 선택{" "}
                  <span className="text-slate-400">{board.total}명</span>
                </h3>
                <div className="flex gap-2 overflow-x-auto lg:block lg:space-y-2">
                  {board.items.map((person) => (
                    <Link
                      key={person.id}
                      href={url({
                        person: person.id,
                        add: undefined,
                        allowance: undefined,
                        activity_page: undefined,
                        edit: undefined,
                        new: undefined,
                      })}
                      className={`block min-w-[160px] rounded-xl border p-3 ${selected?.id === person.id ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-blue-200"}`}
                    >
                      <p className="font-bold">{person.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {KIND_LABELS[person.kind]} ·{" "}
                        {person.affiliation || "소속 미등록"}
                      </p>
                    </Link>
                  ))}
                </div>
                {!board.items.length && (
                  <p className="text-sm text-slate-500">
                    등록된 강사가 없습니다.
                  </p>
                )}
              </aside>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
                {selected ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-bold">
                          {selected.name}{" "}
                          <span className="font-normal text-slate-500">
                            강사 활동이력
                          </span>
                        </h2>
                        <p className="mt-2 text-sm text-slate-500">
                          {[
                            selected.affiliation,
                            selected.department,
                            selected.position,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "기본정보를 등록해 주세요."}
                        </p>
                      </div>
                      <Badge kind={selected.kind} />
                    </div>
                    <div className="my-5 flex flex-wrap items-center gap-3">
                      <span className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
                        누적 실지급 {money(selected.paid)}
                      </span>
                      {selected.document_access && (
                        <DocumentPopup
                          className="btn-secondary !px-3 !py-2 text-xs"
                          href={docUrl(selected.id)}
                        >
                          비공개 서류함
                        </DocumentPopup>
                      )}
                      {!selected.removed && (
                        <>
                          <Link
                            className="btn-secondary !px-3 !py-2 text-xs"
                            href={url({ edit: "1", new: undefined })}
                          >
                            기본정보 수정
                          </Link>
                          <Link
                            className="btn-primary !px-3 !py-2 text-xs"
                            href={
                              selected.registered
                                ? url({ add: "1", allowance: undefined })
                                : url({ edit: "1" })
                            }
                          >
                            <Plus size={16} />
                            활동·수당 등록
                          </Link>
                        </>
                      )}
                      {selected.removed && (
                        <span className="text-sm text-slate-500">
                          대장에서 삭제된 강사 · 기존 지급 이력 보존
                        </span>
                      )}
                    </div>
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
                      <h3 className="flex items-center gap-2 text-sm font-bold text-emerald-800">
                        <BadgeCheck size={17} />
                        교육과정 자동 연계
                      </h3>
                      <p className="my-2 text-xs text-slate-500">
                        과정 배정과 승인된 강의 실적을 조회합니다. 수당은 아래
                        지급 기록에서 관리합니다.
                      </p>
                      {board.teaching.length ? (
                        <div className="divide-y divide-emerald-100">
                          {board.teaching.map((t) => (
                            <div
                              key={t.id}
                              className="flex flex-wrap items-center justify-between gap-3 py-3"
                            >
                              <div>
                                <Link
                                  href={`/admin/offerings/${t.id}`}
                                  className="text-sm font-semibold"
                                >
                                  {t.name} ↗
                                </Link>
                                <p className="mt-1 text-xs text-slate-500">
                                  {t.starts_on} ~ {t.ends_on} · {t.sessions}차시
                                </p>
                              </div>
                              <span className="text-sm font-bold text-emerald-700">
                                확정 {Number(t.confirmed_minutes) / 60}시간
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="py-6 text-center text-sm text-slate-500">
                          연결된 교육과정이 없습니다. 배정된 과정은 여기에
                          표시됩니다.
                        </p>
                      )}
                    </div>
                    <details className="mt-5 rounded-xl border border-slate-200 p-4">
                      <summary className="cursor-pointer text-sm font-bold">
                        소속·구분 변경 이력{" "}
                        <span className="ml-1 text-slate-400">
                          최근 {board.profile_history?.length ?? 0}건
                        </span>
                      </summary>
                      <div className="mt-3 divide-y divide-slate-100">
                        {board.profile_history?.map((h) => (
                          <div key={h.id} className="py-3 text-sm">
                            <p className="font-medium">
                              {h.snapshot.teaching_role === "ASSISTANT"
                                ? "교외 보조강사"
                                : KIND_LABELS[h.snapshot.kind]}{" "}
                              ·{" "}
                              {[
                                h.snapshot.affiliation,
                                h.snapshot.department,
                                h.snapshot.position,
                              ]
                                .filter(Boolean)
                                .join(" · ") || "소속 미등록"}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {new Date(h.changed_at).toLocaleString("ko-KR", {
                                timeZone: "Asia/Seoul",
                              })}{" "}
                              ·{" "}
                              {h.snapshot.status === "ACTIVE"
                                ? "활동 중"
                                : "활동 중지"}
                            </p>
                          </div>
                        ))}
                        {!board.profile_history?.length && (
                          <p className="text-sm text-slate-500">
                            기본정보 등록 이후 변경 이력이 기록됩니다.
                          </p>
                        )}
                      </div>
                    </details>
                    <div className="mt-5 rounded-xl border border-slate-200 p-4">
                      <h3 className="mb-3 text-sm font-bold">서류 준비 현황</h3>
                      <div className="flex flex-wrap gap-4">
                        <div>
                          <p className="mb-2 text-xs text-slate-500">
                            신분증·통장사본
                          </p>
                          <DocumentCell
                            person={selected}
                            org={org}
                            kind="identity"
                          />
                        </div>
                        <div>
                          <p className="mb-2 text-xs text-slate-500">이력서</p>
                          <DocumentCell
                            person={selected}
                            org={org}
                            kind="resume"
                          />
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-slate-500">
                        {selected.phone || "연락처 미등록"} ·{" "}
                        {selected.email || "이메일 미등록"}
                      </p>
                      {selected.notes && (
                        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">
                          {selected.notes}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="py-20 text-center">
                    <BookOpen size={32} className="mx-auto text-blue-200" />
                    <h3 className="mt-4 font-bold">
                      강사를 선택하여 활동이력을 확인하세요
                    </h3>
                    <p className="mt-2 text-sm text-slate-500">
                      교육과정, 확정 강의시간과 수당 지급 기록이 함께
                      표시됩니다.
                    </p>
                  </div>
                )}
              </section>
            </div>
          )}
          {((query.add === "1" && selected && !selected.removed) ||
            (allowance &&
              selected &&
              allowance.status === "PLANNED" &&
              query.edit === "activity")) && (
            <section className="panel my-5 border-blue-200">
              <div className="mb-4 flex justify-between">
                <h2 className="text-lg font-bold">
                  {selected!.name} · 활동 및 수당 산출
                </h2>
                <Link
                  href={url({
                    add: undefined,
                    edit: undefined,
                    allowance: undefined,
                  })}
                  className="text-sm text-slate-500"
                >
                  닫기
                </Link>
              </div>
              {selected!.registered && selected!.status === "ACTIVE" ? (
                <AllowanceForm
                  key={`${allowance?.id ?? "new"}-${allowance?.revision ?? 0}`}
                  org={org}
                  person={selected!}
                  offerings={board.offerings}
                  allowance={query.edit === "activity" ? allowance : undefined}
                  requestKey={crypto.randomUUID()}
                />
              ) : (
                <p className="notice">
                  먼저 강사 기본정보를 등록하고 활동 상태를 확인해 주세요.
                </p>
              )}
            </section>
          )}
          {(tab === "payments" || (tab === "history" && selected)) && (
            <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
                <h2 className="font-bold">
                  {selected ? `${selected.name} · ` : ""}활동·지급 기록{" "}
                  <span className="ml-1 text-sm font-normal text-slate-400">
                    {board.allowance_total}건
                  </span>
                </h2>
                {selected && (
                  <Link
                    className="text-sm font-bold text-blue-700"
                    href={url({
                      add: "1",
                      allowance: undefined,
                      edit: undefined,
                    })}
                  >
                    + 활동·수당 등록
                  </Link>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      {[
                        "강사 / 활동일",
                        "강의·활동 / 과정",
                        "시간·단가",
                        "산출 / 공제",
                        "실지급액",
                        "지급 상태",
                        "관리",
                      ].map((h) => (
                        <th className="px-4 py-4" key={h}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {board.allowances.map((a) => (
                      <tr key={a.id}>
                        <td className="px-4 py-4">
                          <Link
                            className="font-bold text-blue-700"
                            href={url({
                              tab: "history",
                              person: a.person_id,
                              allowance: undefined,
                              activity_page: undefined,
                            })}
                          >
                            {a.name}
                          </Link>
                          <p className="mt-1 text-xs text-slate-500">
                            {a.activity_on}
                          </p>
                        </td>
                        <td className="max-w-xs px-4 py-4">
                          <p className="text-xs text-blue-600">
                            {ACTIVITY_LABELS[a.activity_kind]}
                          </p>
                          <p className="mt-1 font-semibold">{a.title}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {a.offering_name ?? "개별 활동"}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          {a.minutes}분
                          <p className="mt-1 text-xs text-slate-500">
                            {money(a.rate)} / 시간
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          {money(a.gross)}
                          <p className="mt-1 text-xs text-slate-500">
                            공제 {money(a.withholding)}
                          </p>
                        </td>
                        <td className="px-4 py-4 font-bold">{money(a.net)}</td>
                        <td className="px-4 py-4">
                          <span
                            className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-bold ${a.status === "PAID" ? "bg-emerald-50 text-emerald-700" : a.status === "CANCELLED" ? "bg-slate-100 text-slate-500" : "bg-amber-50 text-amber-700"}`}
                          >
                            {PAYMENT_LABELS[a.status]}
                          </span>
                          <p className="mt-2 text-xs text-slate-400">
                            {a.paid_on ?? ""}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <Link
                            className="text-xs font-bold text-blue-700"
                            href={url({
                              person: a.person_id,
                              allowance: a.id,
                              activity_page: undefined,
                              add: undefined,
                              edit: undefined,
                            })}
                          >
                            상세·처리 →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!board.allowances.length && (
                <div className="py-12 text-center">
                  <Wallet size={30} className="mx-auto text-blue-200" />
                  <p className="mt-3 font-semibold">
                    아직 등록된 활동·수당 기록이 없습니다
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    강사를 선택한 후 활동과 지급 산출 내역을 등록하세요.
                  </p>
                  {!selected && (
                    <Link
                      className="mt-4 inline-block text-sm font-bold text-blue-600"
                      href={changeTab("history")}
                    >
                      강사 선택하기 →
                    </Link>
                  )}
                </div>
              )}
              {board.allowance_total > 50 && (
                <div className="flex justify-between border-t p-4 text-sm">
                  {board.activity_page > 1 ? (
                    <Link
                      href={url({
                        activity_page: String(board.activity_page - 1),
                        allowance: undefined,
                      })}
                    >
                      ← 이전 내역
                    </Link>
                  ) : (
                    <span />
                  )}
                  <span>
                    {board.activity_page} /{" "}
                    {Math.ceil(board.allowance_total / 50)}
                  </span>
                  {board.activity_page * 50 < board.allowance_total ? (
                    <Link
                      href={url({
                        activity_page: String(board.activity_page + 1),
                        allowance: undefined,
                      })}
                    >
                      다음 내역 →
                    </Link>
                  ) : (
                    <span />
                  )}
                </div>
              )}
            </section>
          )}
          {allowance && query.edit !== "activity" && (
            <section className="panel mt-5">
              <div className="mb-4 flex justify-between gap-3">
                <h2 className="font-bold">
                  {allowance.name} · {allowance.title}
                </h2>
                <Link
                  className="text-sm text-slate-500"
                  href={url({ allowance: undefined })}
                >
                  닫기
                </Link>
              </div>
              <dl className="mb-5 grid grid-cols-2 gap-2 text-sm">
                <dt className="text-slate-500">등록 당시 소속</dt>
                <dd>
                  {[
                    allowance.instructor_snapshot.teaching_role === "ASSISTANT"
                      ? "교외 보조강사"
                      : KIND_LABELS[allowance.person_kind],
                    allowance.instructor_snapshot.affiliation,
                    allowance.instructor_snapshot.department,
                    allowance.instructor_snapshot.position,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </dd>
                <dt className="text-slate-500">실지급액</dt>
                <dd className="font-bold">{money(allowance.net)}</dd>
                <dt className="text-slate-500">기록 상태</dt>
                <dd>{PAYMENT_LABELS[allowance.status]}</dd>
                <dt className="text-slate-500">거래·결의번호</dt>
                <dd>{allowance.reference || "미등록"}</dd>
                <dt className="text-slate-500">근거</dt>
                <dd className="whitespace-pre-wrap">
                  {allowance.evidence || "미등록"}
                </dd>
                {allowance.cancel_reason && (
                  <>
                    <dt className="text-slate-500">취소 사유</dt>
                    <dd>{allowance.cancel_reason}</dd>
                  </>
                )}
              </dl>
              {allowance.status === "PLANNED" && (
                <>
                  <Link
                    className="mb-5 inline-block text-sm font-bold text-blue-700"
                    href={url({ edit: "activity" })}
                  >
                    활동·산출 내역 수정 →
                  </Link>
                  {selected?.document_access && !documentReady(selected) && (
                    <p className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
                      필수 서류를 준비해 주세요.{" "}
                      <DocumentPopup
                        className="underline"
                        href={docUrl(selected.id)}
                      >
                        서류 확인·입력
                      </DocumentPopup>
                    </p>
                  )}
                  <PaymentForm org={org} allowance={allowance} action="PAY" />
                </>
              )}
              {allowance.status !== "CANCELLED" && (
                <details className="mt-6 border-t pt-4">
                  <summary className="cursor-pointer text-sm text-slate-500">
                    기록 취소
                  </summary>
                  <div className="mt-4">
                    <PaymentForm
                      org={org}
                      allowance={allowance}
                      action="CANCEL"
                    />
                  </div>
                </details>
              )}
            </section>
          )}
          {tab !== "payments" && board.total > board.page_size && (
            <div className="mt-5 flex justify-center gap-5 text-sm">
              {board.page > 1 && (
                <Link href={url({ page: String(board.page - 1) })}>
                  ← 이전 강사
                </Link>
              )}
              <span>
                {board.page} / {Math.ceil(board.total / board.page_size)}
              </span>
              {board.page * board.page_size < board.total && (
                <Link href={url({ page: String(board.page + 1) })}>
                  다음 강사 →
                </Link>
              )}
            </div>
          )}
          {tab === "master" && (
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {[
                {
                  icon: Users,
                  title: "01 · 강사 정보 등록",
                  text: "교내·교외 구분, 소속과 전문분야를 등록합니다.",
                },
                {
                  icon: FileCheck2,
                  title: "02 · 지급 서류 준비",
                  text: "신분증·통장사본·이력서를 비공개 서류함에서 관리합니다.",
                },
                {
                  icon: ClipboardList,
                  title: "03 · 활동과 수당 관리",
                  text: "강의 실적을 확인하고 산출액과 실제 지급 내역을 남깁니다.",
                },
              ].map(({ icon: Icon, title, text }) => (
                <div
                  className="rounded-2xl border border-slate-200/70 bg-white/60 p-5"
                  key={title}
                >
                  <Icon size={19} className="mb-3 text-blue-500" />
                  <h3 className="text-sm font-bold">{title}</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <p className="mt-6 flex items-center gap-2 text-xs text-slate-400">
        <CircleHelp size={14} />
        사업단 담당자 전용 · 서류는 비공개 보관 · 지급 대장은 실제 지급 확인
        기록입니다.
      </p>
    </div>
  );
}
