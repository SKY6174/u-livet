import Image from "next/image";
import type { ReactNode } from "react";
import { AttendancePrint } from "@/components/attendance/attendance-print";
import type { AttendanceBook } from "@/lib/attendance/model";
import { buildTeachingLedger } from "@/lib/reports/teaching-ledger";
import type { Offering } from "@/lib/portal/types";
import {
  attendanceSummary,
  attachmentTitle,
  emptyReport,
  feeAmount,
  hours,
  isCompleted,
  maskAccount,
  money,
  type DocumentKind,
  type ReportBundle,
} from "@/lib/reports/types";
import type { ScholarshipDetail } from "@/lib/operation-documents/model";
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
  attendanceBook,
  officialScholarships = [],
}: {
  offering: Offering;
  bundle: ReportBundle;
  document: DocumentKind | "all";
  reveal?: boolean;
  attendanceBook?: AttendanceBook | null;
  officialScholarships?: ScholarshipDetail[];
}) {
  const p = b.report?.payload ?? emptyReport(o),
    source = o.status === "ARCHIVED" ? p.sourceReport : undefined,
    members = b.members,
    active = members.filter((m) => m.enrollment_status === "ACTIVE"),
    completed = members.filter(isCompleted),
    scholarships = officialScholarships.length
      ? officialScholarships.map((row) => ({
          personId: row.personId,
          category: row.category,
          rate: Number(row.rate || 0),
          amount: Number(row.amount || 0),
          bank: row.bank,
          account: row.account,
          holder: row.holder,
          paidOn: row.paidOn,
          note: row.note,
        }))
      : p.scholarships,
    scholarshipNames = new Map(officialScholarships.map((row) => [row.personId, row.name]));
  const sessions = b.sessions.filter((s) => s.status === "SCHEDULED");
  const teachingRows = document === "teaching" || document === "all"
    ? buildTeachingLedger(sessions, b.teaching)
    : [];
  const approvedTeachingMinutes = b.teaching
    .filter((log) => log.current)
    .reduce((sum, log) => sum + Number(log.minutes), 0);
  const totalMinutes = sessions.reduce(
    (n, s) => n + (Date.parse(s.ends_at) - Date.parse(s.starts_at)) / 60000,
    0,
  );
  const sumFees = p.fees.reduce((n, r) => n + feeAmount(r), 0),
    sumScholarships = officialScholarships.length
      ? scholarships.reduce((n, r) => n + r.amount, 0)
      : source?.scholarshipAmount ?? scholarships.reduce((n, r) => n + r.amount, 0);
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
  const title = (key: DocumentKind) => attachmentTitle(key);
  const show = (key: DocumentKind) => document === "all" || document === key;
  return (
    <div className="report-output">
      {!b.report && ["all", "result", "scholarships", "fees"].includes(document) && (
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
      {show("attendance") && (attendanceBook
        ? <AttendancePrint official book={attendanceBook} title={title("attendance")} />
        : <section className="report-sheet report-form-20"><h1>{title("attendance")}</h1><p>QR·확정 출결 자료를 불러오지 못했습니다. 다시 시도해 주세요.</p></section>)}
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
        chunk(scholarships, 14).map((rows, pi) => (
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
                scholarshipNames.get(r.personId) ?? member(r.personId)?.name,
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
      {show("teaching") && chunk(teachingRows,12).map((rows, pi) => (
        <section className="report-sheet report-portrait report-form-20 report-teaching-ledger" key={`t-${pi}`}>
          <h1>{title("teaching")}</h1>
          <Table head={["과정명","강의기간","승인된 실강의시간"]} rows={[[
            o.name,`${o.starts_on} ~ ${o.ends_on}`,
            `${hours(approvedTeachingMinutes)}시간`,
          ]]} />
          <Table head={["차수","날짜","시간","실강의시간","성명","서명"]} rows={rows.map((row) => [
            row.session,day(`${row.date}T00:00:00+09:00`),`${row.period} ${row.time}`,
            row.minutes === null ? "—" : `${hours(row.minutes)}시간`,row.name,
            row.signature ? <Image key={row.key} src={row.signature} width={110} height={42} unoptimized alt={`${row.name} 본인 서명`} className="report-teaching-signature" /> : row.note || "—",
          ])} />
          <p className="report-note">승인된 실강의시간만 합산하고 유효한 본인 서명만 날인합니다. 미등록·승인 대기는 표시하되 자동 날인하지 않습니다.</p>
          <Image className="report-form-logo" src="/images/anchor-form-logo.png" width={432} height={71} alt="울산과학대학교 지역성장 인재양성체계(앵커)사업단" unoptimized />
        </section>
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
