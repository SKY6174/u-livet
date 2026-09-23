/* eslint-disable @next/next/no-img-element -- Embedded private photographs and signatures are also used by the PDF renderer. */
import type { ReactNode } from "react";
import {
  ACADEMIES,
  RECRUITMENT,
  tables,
  documentLabel,
  type DocumentKind,
} from "@/lib/operation-documents/schema";
import {
  money,
  percentage,
  scholarshipSummary,
  type Content,
  type Budget,
} from "@/lib/operation-documents/model";
import {
  formatScheduleDate,
  formatScheduleTime,
  splitScheduleLocation,
  splitScheduleTopic,
} from "@/lib/operation-documents/schedule-print";
import "./documents.css";
const sum = (rows: Record<string, string>[], key: string) =>
  rows.reduce((n, r) => n + Number(r[key] || 0), 0);
const groups = <T,>(rows: T[], size: number): T[][] =>
  rows.length
    ? Array.from({ length: Math.ceil(rows.length / size) }, (_, i) =>
        rows.slice(i * size, (i + 1) * size),
      )
    : [[]];
const date = (s: string) =>
  s ? s.replaceAll("-", ". ") + "." : "     .     .     .";
function Grid({
  headers,
  rows,
  blank = 1,
}: {
  headers: ReactNode[];
  rows: ReactNode[][];
  blank?: number;
}) {
  return (
    <table className="op-table">
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th key={i}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {(rows.length
          ? rows
          : Array.from({ length: blank }, () => headers.map(() => ""))
        ).map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j}>{cell || "\u00a0"}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
function Box({ children }: { children: ReactNode }) {
  return <div className="op-text-box">{children || "\u00a0"}</div>;
}
function ScheduleDateTimeCell({ row }: { row?: Record<string, string> }) {
  const time = formatScheduleTime(row?.startTime || "", row?.endTime || "");
  return (
    <td className="op-schedule-datetime">
      {row?.date ? (
        <span className="op-schedule-date">{formatScheduleDate(row.date)}</span>
      ) : (
        "\u00a0"
      )}
      {time && (
        <>
          <br />
          <span className="op-schedule-time">{time}</span>
        </>
      )}
    </td>
  );
}
function ScheduleLocationCell({ value }: { value?: string }) {
  const location = splitScheduleLocation(value || "");
  return (
    <td className="op-schedule-location">
      {location.name ? (
        <>
          <span>{location.name}</span>
          {location.room && (
            <>
              <br />
              <span className="op-schedule-room">{location.room}</span>
            </>
          )}
        </>
      ) : (
        "\u00a0"
      )}
    </td>
  );
}
function ScheduleTopicCell({ value }: { value?: string }) {
  const topic = splitScheduleTopic(value || "");
  return (
    <td className="op-schedule-topic">
      {topic.main || "\u00a0"}
      {topic.detail && (
        <>
          <br />
          <span className="op-schedule-topic-detail">{topic.detail}</span>
        </>
      )}
    </td>
  );
}
export function DocumentPreview({
  kind,
  content,
  budget,
  responsibleAffiliation = "",
  status = "DRAFT",
  revision = 0,
}: {
  kind: DocumentKind;
  content: Content;
  budget: Budget;
  responsibleAffiliation?: string;
  status?: string;
  revision?: number;
}) {
  const v = content.fields,
    tt = content.tables;
  const responsibleSignature = content.signature || content.sourceSignature?.image;
  const photos = kind === "result" ? content.photos.filter((photo) => !!photo.image) : [];
  const pages: ReactNode[] = [];
  pages.push(
    <div
      className={`op-cover ${kind === "result" ? "op-result-cover" : ""}`}
      key="cover"
    >
      <div className="op-kicker">
        {v.year || "2026"}학년도 지역성장 인재양성체계(앵커)사업
      </div>
      {kind === "plan" && (
        <div className="op-academies">
          <Grid
            headers={["선택", "교육 프로그램"]}
            rows={ACADEMIES.map((a) => [
              v.academy.includes(a) ? "✓" : "",
              `${a} 교육 프로그램`,
            ])}
          />
        </div>
      )}
      <div className="op-cover-title">
        <h1>{v.title || "(과정명)"}</h1>
        <h1>{kind === "plan" ? "운 영 계 획 서" : "운영결과보고서"}</h1>
      </div>
      {kind === "plan" && (
        <p className="op-audience">
          {v.audience.includes("성인") ? "☑" : "☐"} 성인학습자　{" "}
          {v.audience.includes("주민") ? "☑" : "☐"} 지역주민
        </p>
      )}
      <p className="op-cover-date">{date(v.documentDate)}</p>
      {kind === "plan" ? (
        <div className="op-signature">
          <b>담당교수</b>
          <b>{v.professor || "성함"}</b>
          <span>
            서명{" "}
            {content.signature && (
              <img src={content.signature} alt="담당교수 서명" />
            )}
          </span>
        </div>
      ) : (
        <>
          <Grid
            headers={["구분", "내용"]}
            rows={[
              ["영 역", v.academy],
              ["세 부 프 로 그 램 명", v.program],
              ["교 육 기 간", `${date(v.startsOn)} ~ ${date(v.endsOn)}`],
              [
                "책 임 강 사",
                <div className="op-result-responsible" key="responsible">
                  <span>{responsibleAffiliation || "소속 미등록"}</span>
                  <b>{v.professor || "성함"}</b>
                  <span className="op-result-responsible-signature">
                    (서명)
                    {responsibleSignature && (
                      <img src={responsibleSignature} alt="책임강사 서명" />
                    )}
                  </span>
                </div>,
              ],
            ]}
          />
        </>
      )}
    </div>,
  );
  if (kind === "plan") {
    pages.push(
      <div className="op-overview" key="overview">
        <h1>운 영 계 획 서</h1>
        <h2>1-1. 과정명 : {v.title}</h2>
        <h2>1-2. 주요내용 :</h2>
        <Box>{v.content}</Box>
        <h2>1-3. 교육방법 :</h2>
        <Box>{v.method}</Box>
        <h2>1-4. 기대효과 :</h2>
        <Box>{v.effects}</Box>
      </div>,
    );
    pages.push(
      <div key="recruitment">
        <h2>
          2. 모집 대상 계획 <small>(총 모집인원 중 모집 계획)</small>
        </h2>
        <p>가. 모집인원 : {v.capacity}명</p>
        <p>나. 주요대상 :</p>
        <Grid
          headers={["구분", ...RECRUITMENT]}
          rows={[
            [
              "인원",
              ...RECRUITMENT.map(
                (c) =>
                  `${tt.recruitment.find((r) => r.category === c)?.count || ""}명`,
              ),
            ],
            [
              "비율",
              ...RECRUITMENT.map(
                (c) =>
                  `${tt.recruitment.find((r) => r.category === c)?.ratio || ""}%`,
              ),
            ],
          ]}
        />
        <p>다. 주요목적 :</p>
        <Grid
          headers={[
            "자격증",
            "취창업",
            "취미·여가",
            "자기계발",
            "진로진학",
            "기타",
          ]}
          rows={[
            ["자격증", "취창업", "취미", "자기계발", "진로진학", "기타"].map(
              (p) => (v.purposes.includes(p) ? "✓" : ""),
            ),
          ]}
        />
        <p>{v.purposes}</p>
        <h2>3. 거버넌스 활용 계획</h2>
        <table className="op-table op-governance">
          <thead>
            <tr>
              <th colSpan={2}>구 분</th>
              <th>내 용</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={2}>거버넌스 기관명</td>
              <td>{v.partner}</td>
            </tr>
            <tr>
              <td colSpan={2}>거버넌스 기관 분야</td>
              <td>{v.partnerField}</td>
            </tr>
            {[
              ["교육과정개발", "partnerDevelopment"],
              ["취·창업연계", "partnerEmployment"],
              ["인턴십연계", "partnerInternship"],
              ["봉사 및 기여활동", "partnerService"],
            ].map(([label, key], i) => (
              <tr key={key}>
                {i === 0 && (
                  <td rowSpan={4}>
                    거버넌스 연계
                    <br />
                    활용방안
                  </td>
                )}
                <td>{label}</td>
                <td>{v[key]}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={2}>교육종료 후 활성화 방안</td>
              <td>{v.partnerFollowUp}</td>
            </tr>
          </tbody>
        </table>
      </div>,
    );
    pages.push(
      <div key="qualifications">
        <h2>4. 관련 자격증</h2>
        <p>{v.qualificationNote}</p>
        {tables("plan")
          .filter((t) => ["national", "private"].includes(t.key))
          .map((t) => (
            <section key={t.key}>
              <h3>{t.label}</h3>
              <Grid
                headers={t.columns.map((c) => c.label)}
                rows={tt[t.key].map((r) => t.columns.map((c) => r[c.key]))}
                blank={2}
              />
            </section>
          ))}
        <table className="op-table">
          <tbody>
            <tr>
              <th>
                자격 발급
                <br />
                기관 정보
              </th>
              <td>{v.issuerInfo}</td>
              <th>
                환불
                <br />
                규정
              </th>
              <td>{v.refundPolicy}</td>
            </tr>
            <tr>
              <td colSpan={4} className="op-left">
                &lt;소비자 알림사항&gt;
                <br />① 상기 민간자격은 자격기본법에 따라 등록한 민간자격으로,
                국가로부터 인정받은 자격이 아닙니다.
                <br />② 민간자격 등록 및 공인 제도에 대한 상세내용은
                민간자격정보서비스(www.pqi.or.kr)를 참조하세요.
              </td>
            </tr>
          </tbody>
        </table>
      </div>,
    );
  } else {
    const labels = [
      "모집정원",
      "모집인원",
      "수료인원\n(수료율)",
      "자격증 취득 수\n(자격증 취득율)",
      "취창업인원\n(취창업율)",
      "이수자 교육만족응답수\n(만족도율)",
    ];
    const vals = [
      v.capacity,
      v.enrolled,
      `${v.completed}\n(${percentage(v.completed, v.enrolled)})`,
      `${v.certificates}\n(${percentage(v.certificates, v.completed)})`,
      `${v.employed}\n(${percentage(v.employed, v.completed)})`,
      `${v.surveyResponses}\n(${v.satisfaction || "—"}%)`,
    ];
    pages.push(
      <div key="performance">
        <h2>1. 프로그램명: {v.title}</h2>
        <h2>2. 주요 내용</h2>
        <Box>{v.content}</Box>
        <h2>3. 운영 성과</h2>
        <h3>가. 성과</h3>
        <Grid headers={labels} rows={[vals]} />
        <h3>나. 운영 사진</h3>
        <Photos photos={photos.slice(0, 4)} />
        <p className="op-photo-note">{v.photoNote}</p>
      </div>,
    );
  }
  if (kind === "result" && photos.length > 4) {
    groups(photos.slice(4), 8).forEach((part, index) => pages.push(
      <div key={`photos-${index}`}>
        <h2>3. 운영 성과 · 운영 사진 (계속)</h2>
        <Photos photos={part} />
      </div>,
    ));
  }
  const schedule = tt.schedule ?? [];
  groups(schedule, 15).forEach((rows, group) =>
    pages.push(
      <div key={`schedule-${group}`}>
        {kind === "result" && group === 0 && photos.length <= 6 && photos.length > 4 && (
          <Photos photos={photos.slice(4)} />
        )}
        <h2>
          {kind === "plan" ? "5. 강의계획" : "4. 강사별 교육시간 상세 내역"}
          {group > 0 ? " (계속)" : ""}
        </h2>
        {kind === "plan" && (
          <p>
            교육기간 : {date(v.startsOn)} ~ {date(v.endsOn)}
          </p>
        )}
        <table className="op-table op-schedule">
          <colgroup>
            {(kind === "plan"
              ? [5, 15, 24.5, 8, 6, 8, 6, 11.5, 7, 9]
              : [5, 18, 31, 8, 6, 8, 6, 18]
            ).map((width, index) => (
              <col key={index} style={{ width: `${width}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2} className="op-schedule-round">회차</th>
              <th rowSpan={2} className="op-schedule-datetime">
                일자
                <br />
                <span>(시간)</span>
              </th>
              <th rowSpan={2}>강의주제 및 내용</th>
              <th colSpan={2}>주강사</th>
              <th colSpan={2}>보조강사</th>
              <th rowSpan={2}>교육장소</th>
              {kind === "plan" && (
                <>
                  <th rowSpan={2}>수업방식</th>
                  <th rowSpan={2}>
                    공휴일 수업여부
                    <br />
                    (보강 날짜)
                  </th>
                </>
              )}
            </tr>
            <tr>
              <th>강사명</th>
              <th>
                교육
                <br />
                시간
              </th>
              <th>강사명</th>
              <th>
                교육
                <br />
                시간
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.max(15, rows.length) }, (_, i) => (
              <tr key={i}>
                <td>{group * 15 + i + 1}</td>
                <ScheduleDateTimeCell row={rows[i]} />
                <ScheduleTopicCell value={rows[i]?.topic} />
                <td className="op-schedule-instructor">{rows[i]?.instructor || "\u00a0"}</td>
                <td>{rows[i]?.hours || "\u00a0"}</td>
                <td className="op-schedule-instructor">{rows[i]?.assistant || "\u00a0"}</td>
                <td>{rows[i]?.assistantHours || "\u00a0"}</td>
                <ScheduleLocationCell value={rows[i]?.location} />
                {kind === "plan" && (
                  <>
                    <td>{rows[i]?.mode || "\u00a0"}</td>
                    <td>{rows[i]?.holiday || "\u00a0"}</td>
                  </>
                )}
              </tr>
            ))}
            <tr>
              <th colSpan={3}>합계</th>
              <td />
              <td>{sum(rows, "hours")}h</td>
              <td />
              <td>{sum(rows, "assistantHours")}h</td>
              <td colSpan={kind === "plan" ? 3 : 1} />
            </tr>
          </tbody>
        </table>
      </div>,
    ),
  );
  if (kind === "plan") {
    pages.push(
      <div key="staff">
        {tables("plan")
          .filter((t) =>
            ["instructors", "assistants", "support"].includes(t.key),
          )
          .map((t) => (
            <section key={t.key}>
              <h2>{t.label}</h2>
              <Grid
                headers={[
                  ...t.columns.map((c) => c.label),
                  ...(t.key === "instructors" ? ["계"] : []),
                ]}
                rows={tt[t.key].map((r) => [
                  ...t.columns.map((c) => r[c.key]),
                  ...(t.key === "instructors"
                    ? [Number(r.theory || 0) + Number(r.practice || 0)]
                    : []),
                ])}
                blank={t.key === "instructors" ? 5 : 2}
              />
              <p className="op-hours">
                합계{" "}
                {t.key === "instructors"
                  ? sum(tt[t.key], "theory") + sum(tt[t.key], "practice")
                  : sum(tt[t.key], "hours")}
                시간
              </p>
            </section>
          ))}
        <Box>{v.staffNote}</Box>
      </div>,
    );
    pages.push(
      <div key="budget">
        <h2>9. 예산계획</h2>
        <h3>
          가. 과정운영비 :{" "}
          {money(
            budget.rows
              .filter((r) => r.category !== "수강료")
              .reduce((n, r) => n + Number(r.planned || 0), 0),
          )}
          원
        </h3>
        <BudgetTable budget={budget} kind={kind} />
        <p className="op-budget-notice">
          예산계획은 운영 담당자가 작성·확인합니다.
        </p>
      </div>,
    );
  } else {
    pages.push(
      <div key="quality">
        <h2>5. 예산집행현황</h2>
        <BudgetTable budget={budget} kind={kind} />
        <h2>6. 프로그램 품질 개선</h2>
        <table className="op-table op-quality"><colgroup><col style={{width:"29%"}} /><col style={{width:"16%"}} /><col style={{width:"55%"}} /></colgroup>
          <thead>
            <tr>
              <th colSpan={3}>운영 내용</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["교육방법", "method"],
              ["교육내용", "education"],
              ["교육생\n모집 홍보", "promotion"],
              ["기타", "other"],
            ].map(([label, key], i) => (
              <tr key={key}>
                {i === 0 && (
                  <th rowSpan={4}>
                    {v.year}학년도 프로그램
                    <br />
                    운영 사항
                  </th>
                )}
                <th>{label}</th>
                <td>{v[key]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>,
    );
    pages.push(
      <div key="review">
        <h2>7. 총평</h2>
        <table className="op-table op-review"><colgroup><col style={{width:"5%"}} /><col style={{width:"15%"}} /><col style={{width:"65%"}} /><col style={{width:"15%"}} /></colgroup>
          <thead>
            <tr>
              <th colSpan={2}>구 분</th>
              <th>내 용</th>
              <th>비고</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th rowSpan={2}>
                총<br />평
              </th>
              <th>우수한 점</th>
              <td>{v.strengths}</td>
              <td>{v.strengthsNote}</td>
            </tr>
            <tr>
              <th>개선할 점</th>
              <td>{v.improvements}</td>
              <td>{v.improvementsNote}</td>
            </tr>
            <tr>
              <th colSpan={2}>환류 계획</th>
              <td>{v.followUp}</td>
              <td>{v.followUpNote}</td>
            </tr>
          </tbody>
        </table>
        <h2>8. 장학금 지원</h2>
        <Grid
          headers={["구분", "인원수", "장학금액", "비고"]}
          rows={[
            [
              "학습활동 우수장학",
              scholarshipSummary(budget).count,
              money(scholarshipSummary(budget).amount),
              budget.scholarshipNote,
            ],
          ]}
        />
      </div>,
    );
    if (budget.scholarships.length)
      groups(budget.scholarships, 18).forEach((rows, pageIndex) =>
        pages.push(
          <div key={`scholarship-${pageIndex}`}>
            <h2>8. 장학금 지원 세부내역</h2>
            <Grid
              headers={["순번", "성명", "장학유형", "지급률", "지급액", "지급일", "비고"]}
              rows={rows.map((row, rowIndex) => [
                pageIndex * 18 + rowIndex + 1,
                row.name,
                row.category,
                `${row.rate}%`,
                money(row.amount),
                row.paidOn ? date(row.paidOn) : "미지급",
                row.note,
              ])}
            />
          </div>,
        ),
      );
  }
  return (
    <div
      className={`report-output op-output op-${kind}`}
      aria-label={`${documentLabel(kind)} A4 미리보기`}
    >
      {pages.map((page, i) => (
        <article key={i} className="report-sheet op-page">
          <div className="op-page-content">{page}</div>
          {/* 커버페이지(i === 0)에는 페이지 번호와 바닥글을 일체 표시하지 않습니다 */}
          {i > 0 && (
            <footer className="op-page-footer">
              <span>
                {status === "SUBMITTED"
                  ? `최종 제출본 · v${revision}`
                  : "검토용 초안"}
              </span>
              <span className="op-page-number">{`- ${i} -`}</span>
              <span>울산과학대학교 앵커사업단</span>
            </footer>
          )}
        </article>
      ))}
    </div>
  );
}
function Photos({ photos }: { photos: Content["photos"] }) {
  if (!photos.length) return null;
  return (
    <div className="op-photos">
      {photos.map((p, i) => (
        <figure key={i}>
          <figcaption>
            {p.caption}{p.date ? `(${date(p.date)})` : ""}
          </figcaption>
          <div>{p.image && <img src={p.image} alt={p.caption} />}</div>
        </figure>
      ))}
    </div>
  );
}
function BudgetTable({ budget, kind }: { budget: Budget; kind: DocumentKind }) {
  const rows = budget.rows.filter(
      (r) => kind === "result" || r.category !== "수강료",
    ),
    tuition = budget.rows.filter((r) => r.category === "수강료");
  return (
    <>
      <p className="op-unit">단위(원)</p>
      <Grid
        headers={
          kind === "plan"
            ? ["세부내역", "산출내역", "금액", "비고"]
            : ["구분", "신청예산", "집행예산", "비고"]
        }
        rows={[
          ...rows.map((r) =>
            kind === "plan"
              ? [r.category, r.calculation, money(r.planned), r.note]
              : [r.category, money(r.planned), money(r.spent), r.note],
          ),
          kind === "plan"
            ? ["합계", "", money(sum(rows, "planned")), ""]
            : [
                "합계",
                money(sum(rows, "planned")),
                money(sum(rows, "spent")),
                "",
              ],
          ...(kind === "plan"
            ? tuition.map((r) => [
                r.category,
                r.calculation,
                money(r.planned),
                r.note,
              ])
            : []),
        ]}
      />
    </>
  );
}
