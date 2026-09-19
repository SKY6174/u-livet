import Image from "next/image";
import type { ReactNode } from "react";
import type { Offering } from "@/lib/portal/types";
import {
  attendanceSummary,
  DOCUMENTS,
  emptyReport,
  feeAmount,
  hours,
  isCompleted,
  maskAccount,
  money,
  type DocumentKind,
  type ReportBundle,
} from "@/lib/reports/types";
const chunk = <T,>(rows: T[], size: number): T[][] =>
  rows.length
    ? Array.from({ length: Math.ceil(rows.length / size) }, (_, i) =>
        rows.slice(i * size, (i + 1) * size),
      )
    : [[]];
const day = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
const clock = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
function Table({ head, rows }: { head: ReactNode[]; rows: ReactNode[][] }) {
  return (
    <table className="report-table">
      <thead>
        <tr>
          {head.map((h, i) => (
            <th key={i}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length ? (
          rows.map((r, i) => (
            <tr key={i}>
              {r.map((v, j) => (
                <td key={j}>{v ?? "—"}</td>
              ))}
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={head.length}>등록된 내역 없음</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
function Sheet({
  title,
  offering,
  wide = false,
  children,
}: {
  title: string;
  offering: Offering;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`report-sheet ${wide ? "report-landscape" : "report-portrait"}`}
    >
      <div className="report-brand">
        울산과학대학교 · 지역성장 인재양성체계(앵커)사업단
      </div>
      <h1>{title}</h1>
      <p className="report-meta">
        {offering.name} · {offering.starts_on} ~ {offering.ends_on}
      </p>
      {offering.status === "ARCHIVED" && <p className="report-note">
        원본 보고서 보관 과정 · 집계는 원본 기준입니다. 개인별 명단·출결·강의확인·지급 내역은 별도 등록 전이며 원본 PDF에서 전체 자료를 확인할 수 있습니다.
      </p>}
      {children}
      <div className="report-foot">
        {offering.year_label} · {offering.academy}
      </div>
    </section>
  );
}
function Narrative({ title, body }: { title: string; body: string }) {
  return (
    <div className="report-narrative">
      <h3>{title}</h3>
      <p>{body || "미입력"}</p>
    </div>
  );
}
export function ReportDocuments({
  offering: o,
  bundle: b,
  document,
  reveal = false,
}: {
  offering: Offering;
  bundle: ReportBundle;
  document: DocumentKind | "all";
  reveal?: boolean;
}) {
  const p = b.report?.payload ?? emptyReport(o),
    source = o.status === "ARCHIVED" ? p.sourceReport : undefined,
    members = b.members,
    active = members.filter((m) => m.enrollment_status === "ACTIVE"),
    completed = members.filter(isCompleted);
  const sessions = b.sessions.filter((s) => s.status === "SCHEDULED");
  const totalMinutes = sessions.reduce(
    (n, s) => n + (Date.parse(s.ends_at) - Date.parse(s.starts_at)) / 60000,
    0,
  );
  const sumFees = p.fees.reduce((n, r) => n + feeAmount(r), 0),
    sumScholarships = source?.scholarshipAmount ?? p.scholarships.reduce((n, r) => n + r.amount, 0);
  const enrolledCount = source?.enrolled ?? active.length;
  const completedCount = source?.completed ?? completed.length;
  const details = (id: string) => p.participants.find((r) => r.personId === id);
  const member = (id: string) => members.find((m) => m.person_id === id);
  const yes = (id: string) => {
    const m = member(id);
    return m && isCompleted(m)
      ? "○"
      : m?.enrollment_status === "WITHDRAWN"
        ? "수강취소"
        : m?.stale && m.approval
          ? "재검토"
          : "미승인";
  };
  const title = (key: DocumentKind) => DOCUMENTS.find((d) => d[0] === key)![1];
  const show = (key: DocumentKind) => document === "all" || document === key;
  return (
    <div className="report-output">
      {!b.report && (
        <p className="no-print notice mx-auto max-w-4xl">
          미저장 초안입니다. 빈 항목을 작성하고 저장한 후 제출용으로 출력하세요.
        </p>
      )}
      {show("result") && (
        <>
          <Sheet title="운영 결과보고서" offering={o}>
            <div className="report-cover">
              <p>{o.year_label} 지역성장 인재양성체계(앵커)사업</p>
              <h2>{o.name}</h2>
              <p className="report-cover-date">
                {p.reportDate || "보고일 미입력"}
              </p>
              <Table
                head={["구분", "내용"]}
                rows={[
                  ["영역", p.program],
                  ["세부프로그램명", o.name],
                  ["담당 교수", p.professor || "미입력"],
                  ["운영 담당자", p.operator],
                  ["교육 기간", `${o.starts_on} ~ ${o.ends_on}`],
                  [
                    "교육 시간",
                    `${source?.classCount ?? sessions.length}회 · ${source?.educationHours ?? hours(totalMinutes)}시간${source ? " (원본 집계)" : ""}`,
                  ],
                ]}
              />
              {!b.report && <p>미저장 초안</p>}
            </div>
          </Sheet>
          <Sheet title="프로그램 운영 성과" offering={o}>
            <Narrative title="1. 프로그램명" body={p.program} />
            <Narrative title="2. 주요 내용" body={p.content} />
            <h2>3. 운영 성과</h2>
            <Table
              head={[
                "모집정원",
                "등록인원",
                "수료인원 / 수료율",
                "자격증 취득",
                "취·창업",
                "만족도 응답 / 만족도",
              ]}
              rows={[
                [
                  o.capacity,
                  enrolledCount,
                  `${completedCount} / ${enrolledCount ? ((completedCount / enrolledCount) * 100).toFixed(1) + "%" : "—"}`,
                  p.certificates === null
                    ? "미집계"
                    : `${p.certificates}명 / ${enrolledCount ? ((p.certificates / enrolledCount) * 100).toFixed(1) + "%" : "—"}`,
                  p.employed === null
                    ? "미집계"
                    : `${p.employed}명 / ${enrolledCount ? ((p.employed / enrolledCount) * 100).toFixed(1) + "%" : "—"}`,
                  `${p.surveyResponses ?? "미집계"} / ${p.satisfaction === null ? "미집계" : p.satisfaction + "%"}`,
                ],
              ]}
            />
            <p className="report-note">
              {source ? "모집·수료·시수·장학금은 원본 보고서의 집계입니다. 개인별 전산 승인이나 지급 증빙을 의미하지 않습니다. 사진·강의표는 연결된 원본 PDF를 확인하세요." : "수료인원은 유효한 최신 수료 승인을 받은 학습자 기준입니다. 등록인원은 수강취소자를 제외하며 성과 비율의 분모로 사용합니다."}
            </p>
            {source?.notes && <Narrative title="원본 확인 사항" body={source.notes} />}
            <h2>4. 강사별 교육시간 상세 내역</h2>
            <Table
              head={[
                "회차·일시",
                "강의주제 및 내용",
                "강사",
                "실강의시간",
                "확인",
              ]}
              rows={b.teaching.map((l) => {
                const s = sessions.find((s) => s.id === l.session_id)!;
                return [
                  `${sessions.indexOf(s) + 1}회 · ${day(s.starts_at)} ${clock(s.starts_at)}~${clock(s.ends_at)}`,
                  l.topic,
                  l.name,
                  `${hours(l.minutes)}h`,
                  l.current ? "승인" : "검토 중",
                ];
              })}
            />
            <p className="report-note">
              강사가 제출한 실강의시간입니다. 교육장소: {o.location}
            </p>
          </Sheet>
          {chunk(
            b.files.filter((f) => f.kind === "photo"),
            4,
          ).map((files, i) => (
            <Sheet
              title={`운영 사진${i ? ` (${i + 1})` : ""}`}
              offering={o}
              key={`photo-${i}`}
            >
              <div className="report-photos">
                {files.length ? (
                  files.map((f) => (
                    <figure key={f.id}>
                      <Image
                        src={`/api/course-reports/${o.id}/files/${f.id}`}
                        alt={f.caption || "운영사진"}
                        width={800}
                        height={560}
                        unoptimized
                        loading="eager"
                      />
                      <figcaption>{f.caption || f.filename}</figcaption>
                    </figure>
                  ))
                ) : (
                  <p>등록된 운영사진이 없습니다.</p>
                )}
              </div>
            </Sheet>
          ))}
          <Sheet title="예산집행·프로그램 품질 개선" offering={o}>
            <h2>5. 예산집행현황 (원)</h2>
            <Table
              head={["구분", "신청예산", "집행예산", "비고"]}
              rows={[
                ...p.budgets.map((r) => [
                  r.category,
                  money(r.planned),
                  money(r.spent),
                  r.note,
                ]),
                [
                  "합계",
                  money(p.budgets.reduce((n, r) => n + r.planned, 0)),
                  money(p.budgets.reduce((n, r) => n + r.spent, 0)),
                  "",
                ],
              ]}
            />
            <h2>6. 프로그램 품질 개선</h2>
            <Narrative title="교육방법" body={p.method} />
            <Narrative title="교육내용" body={p.education} />
            <Narrative title="교육생 모집·홍보" body={p.promotion} />
            <Narrative title="기타" body={p.other} />
          </Sheet>
          <Sheet title="총평·장학금 지원" offering={o}>
            <h2>7. 총평</h2>
            <Narrative title="우수한 점" body={p.strengths} />
            <Narrative title="개선할 점" body={p.improvements} />
            <Narrative title="환류 계획" body={p.followUp} />
            <h2>8. 장학금 지원</h2>
            <Table
              head={["구분", "인원수", "장학금액 (원)"]}
              rows={source ? [["학습활동 우수장학 · 원본 집계", source.scholarshipRecipients, money(source.scholarshipAmount)]] : Array.from(
                new Set(p.scholarships.map((r) => r.category)),
              ).map((k) => [
                k,
                new Set(
                  p.scholarships
                    .filter((r) => r.category === k)
                    .map((r) => r.personId),
                ).size,
                money(
                  p.scholarships
                    .filter((r) => r.category === k)
                    .reduce((n, r) => n + r.amount, 0),
                ),
              ])}
            />
            <p className="report-note">
              장학금 합계 {money(sumScholarships)}원 · {source ? "원본 보고서의 집계이며 개인별 지급일은 미등록입니다." : "지급내역의 지급일로 실제 지급 여부를 확인합니다."}
            </p>
          </Sheet>
        </>
      )}
      {show("attendance") &&
        chunk(sessions, 4).flatMap((group, si) =>
          chunk(active, 12).map((people, pi) => (
            <Sheet
              title={`${title("attendance")} · ${si + 1}-${pi + 1}`}
              offering={o}
              wide
              key={`a-${si}-${pi}`}
            >
              <p>
                총 {hours(totalMinutes)}시간 · 강사 입력 출결 / 수기 서명용
                시작·종료 칸
              </p>
              <Table
                head={[
                  "번호",
                  "성명",
                  ...group.map((s) => (
                    <span key={s.id}>
                      {sessions.indexOf(s) + 1}회 · {day(s.starts_at)}
                      <br />
                      {clock(s.starts_at)}~{clock(s.ends_at)}
                    </span>
                  )),
                  "총 인정시간 / 출석률",
                ]}
                rows={people.map((m, i) => {
                  const a = attendanceSummary(b, m.person_id);
                  return [
                    pi * 12 + i + 1,
                    m.name,
                    ...group.map((s) => {
                      const r = b.attendance.find(
                        (a) =>
                          a.session_id === s.id && a.person_id === m.person_id,
                      );
                      return (
                        <div key={s.id}>
                          <strong>
                            {r
                              ? `${hours(Number(r.credited_minutes))}h${Number(r.credited_minutes) === 0 ? " (결석)" : ""}`
                              : "미입력"}
                          </strong>
                          <div className="signature-pair">
                            <span>시작</span>
                            <span>종료</span>
                          </div>
                        </div>
                      );
                    }),
                    `${hours(a.credited)}h / ${a.percent === null ? "—" : a.percent.toFixed(1) + "%"}${a.missing ? ` (${a.missing}회 미입력)` : ""}`,
                  ];
                })}
              />
              <p className="report-note">
                출석률은 전체 등록 수업시간 대비 인정시간입니다. 미입력 회차가
                있으면 잠정 수치이며 결석 확정을 의미하지 않습니다.
              </p>
            </Sheet>
          )),
        )}
      {show("completion") &&
        chunk(members, 18).map((people, pi) => (
          <Sheet title={title("completion")} offering={o} wide key={`c-${pi}`}>
            <p>담당 교수: {p.professor || "미입력"}</p>
            <Table
              head={[
                "순번",
                "과정명",
                "교육기간",
                "성명",
                "생년월일",
                "총 교육시간",
                "이수시간",
                "출석률",
                "수료여부",
                "비고",
              ]}
              rows={people.map((m, i) => {
                const a = attendanceSummary(b, m.person_id);
                return [
                  pi * 18 + i + 1,
                  o.name,
                  `${o.starts_on} ~ ${o.ends_on}`,
                  m.name,
                  details(m.person_id)?.birthDate,
                  `${hours(a.total)}h`,
                  `${hours(a.credited)}h`,
                  a.percent === null ? "—" : `${a.percent.toFixed(1)}%`,
                  yes(m.person_id),
                  [
                    a.missing ? `${a.missing}회 미입력` : "",
                    details(m.person_id)?.note,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                ];
              })}
            />
          </Sheet>
        ))}
      {show("scholarships") &&
        chunk(p.scholarships, 14).map((rows, pi) => (
          <Sheet
            title={title("scholarships")}
            offering={o}
            wide
            key={`s-${pi}`}
          >
            <Table
              head={[
                "순번",
                "과정명",
                "성명",
                "생년월일",
                "수강료 (원)",
                "수료여부",
                "장학유형",
                "지급률",
                "금액 (원)",
                "은행",
                "계좌번호",
                "예금주",
                "지급일 / 비고",
              ]}
              rows={rows.map((r, i) => [
                pi * 14 + i + 1,
                o.name,
                member(r.personId)?.name,
                details(r.personId)?.birthDate,
                money(o.tuition),
                yes(r.personId),
                r.category,
                `${r.rate}%`,
                money(r.amount),
                r.bank,
                maskAccount(r.account, reveal),
                r.holder,
                `${r.paidOn || "미지급"} ${r.note}`,
              ])}
            />
            <p className="report-total">
              전체 합계: {money(sumScholarships)}원
            </p>
          </Sheet>
        ))}
      {show("teaching") &&
        chunk(b.teaching, 16).map((rows, pi) => (
          <Sheet title={title("teaching")} offering={o} key={`t-${pi}`}>
            <Table
              head={[
                "차수",
                "날짜 / 시간",
                "실강의시간",
                "성명",
                "제출·확인",
                "수기 서명",
              ]}
              rows={rows.map((l) => {
                const s = sessions.find((s) => s.id === l.session_id)!;
                return [
                  sessions.indexOf(s) + 1,
                  `${day(s.starts_at)} ${clock(s.starts_at)}~${clock(s.ends_at)}`,
                  `${hours(l.minutes)}h`,
                  l.name,
                  `${day(l.confirmed_at)} 제출 · ${l.current ? "운영진 승인" : "검토 중"}`,
                  <div className="signature-space" key={l.id} />,
                ];
              })}
            />
            <p className="report-note">
              강사 본인의 로그인 제출기록을 표시합니다. 수기 서명이 필요한 경우
              인쇄 후 서명하세요.
            </p>
          </Sheet>
        ))}
      {show("fees") &&
        chunk(p.fees, 14).map((rows, pi) => (
          <Sheet title={title("fees")} offering={o} wide key={`f-${pi}`}>
            <Table
              head={[
                "순번",
                "분야 / 과정명",
                "교육기간",
                "강사구분",
                "성명",
                "생년월일",
                "강의일자",
                "시수 (h)",
                "단가 (원)",
                "금액 (원)",
                "은행",
                "계좌번호",
                "예금주",
                "지급일 / 비고",
              ]}
              rows={rows.map((r, i) => [
                pi * 14 + i + 1,
                `${o.academy} / ${o.name}`,
                `${o.starts_on} ~ ${o.ends_on}`,
                r.kind,
                r.name,
                r.birthDate,
                r.dates,
                r.hours,
                money(r.rate),
                money(feeAmount(r)),
                r.bank,
                maskAccount(r.account, reveal),
                r.holder,
                `${r.paidOn || "미지급"} ${r.note}`,
              ])}
            />
            <p className="report-total">
              전체 {p.fees.reduce((n, r) => n + r.hours, 0).toFixed(2)}h ·
              강사료 합계 {money(sumFees)}원
            </p>
            <p className="report-note">
              단가가 다른 강의는 별도 행으로 표시합니다. 운영 담당자:{" "}
              {p.operator}
            </p>
          </Sheet>
        ))}
    </div>
  );
}
