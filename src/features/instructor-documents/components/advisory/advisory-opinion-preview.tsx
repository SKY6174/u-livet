/* eslint-disable @next/next/no-img-element -- Private upload previews must remain canvas-readable. */
import type React from "react";
import type { AdvisoryOpinionFontSize } from "../../types/advisory-intake";
import {
  ADVISORY_BEST_PRACTICE_HEADING,
  ADVISORY_IMPROVEMENT_HEADING,
  type AdvisoryOpinionSectionKey,
  ADVISORY_OPERATION_HEADING
} from "../../features/committee/utils/advisory-opinion";
import { formatSeoulConsultationRange } from "../../features/committee/utils/committee-date-time";

type PreviewBlock =
  | { type: "heading" | "unordered-list-item" | "sub-list-item" | "ordered-list-item" | "paragraph"; text: string }
  | { type: "table"; headers: string[]; rows: string[][] };

const splitTableRow = (line: string): string[] => {
  let source = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let current = "";
  let escaped = false;
  for (const character of source) {
    if (escaped) {
      current += character;
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if (character === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  cells.push(current.trim());
  return cells;
};

const parsePreviewMarkdown = (text: string): PreviewBlock[] => {
  const lines = text.split(/\r?\n/);
  const blocks: PreviewBlock[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (!trimmed) continue;
    const headers = splitTableRow(trimmed);
    const separators = lines[index + 1]?.trim();
    const isTable = trimmed.includes("|")
      && Boolean(separators)
      && splitTableRow(separators).length === headers.length
      && splitTableRow(separators).every(cell => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")));
    if (isTable) {
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].trim().includes("|")) {
        const cells = splitTableRow(lines[index]);
        rows.push(headers.map((_, columnIndex) => cells[columnIndex] ?? ""));
        index += 1;
      }
      blocks.push({ type: "table", headers, rows });
      index -= 1;
      continue;
    }
    const heading = /^(#{2,4})\s+(.*)$/.exec(trimmed);
    if (heading) blocks.push({ type: "heading", text: heading[2] });
    else if (/^--\s+/.test(trimmed)) blocks.push({ type: "sub-list-item", text: trimmed.replace(/^--\s+/, "") });
    else if (/^[-*]\s+/.test(trimmed)) blocks.push({ type: "unordered-list-item", text: trimmed.replace(/^[-*]\s+/, "") });
    else if (/^\d+\.\s+/.test(trimmed)) blocks.push({ type: "ordered-list-item", text: trimmed });
    else blocks.push({ type: "paragraph", text: trimmed });
  }
  return blocks;
};

interface AdvisoryOpinionPreviewProps {
  member: { name: string; org?: string | null; dept?: string | null; rank?: string | null };
  meeting: { title: string; meeting_date?: string | null; meeting_end_date?: string | null; closes_at?: string | null };
  opinionTitle: string;
  operationOpinion: string;
  bestPracticeOpinion: string;
  improvementOpinion: string;
  selectedSections: AdvisoryOpinionSectionKey[];
  squareBulletFontSize: AdvisoryOpinionFontSize;
  triangleBulletFontSize: AdvisoryOpinionFontSize;
  signatureUrl?: string;
}

const renderMarkdown = (markdown: string): React.ReactNode => parsePreviewMarkdown(markdown).map((block, index) => {
  if (block.type === "heading") {
    return <h4 key={index} className="advisory-preview-heading">{block.text}</h4>;
  }
  if (block.type === "unordered-list-item") {
    return <p key={index} className="advisory-preview-circle">{block.text}</p>;
  }
  if (block.type === "sub-list-item") {
    return <p key={index} className="advisory-preview-sub-list">{block.text}</p>;
  }
  if (block.type === "table") {
    return (
      <table key={index} className="advisory-preview-table">
        <thead><tr>{block.headers.map((header, cellIndex) => <th key={cellIndex}>{header}</th>)}</tr></thead>
        <tbody>{block.rows.map((row, rowIndex) => (
          <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
        ))}</tbody>
      </table>
    );
  }
  return <p key={index}>{block.text}</p>;
});

export function AdvisoryOpinionPreview({
  member,
  meeting,
  opinionTitle,
  operationOpinion,
  bestPracticeOpinion,
  improvementOpinion,
  selectedSections,
  squareBulletFontSize,
  triangleBulletFontSize,
  signatureUrl
}: AdvisoryOpinionPreviewProps) {
  const affiliation = [member.org, member.dept].filter(Boolean).join(" / ") || "-";
  const position = member.rank || "-";
  const consultationDate = formatSeoulConsultationRange(meeting.meeting_date, meeting.meeting_end_date);
  const submittedDate = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());

  return (
    <article
      className={`advisory-opinion-preview ${selectedSections.length === 3 ? "is-three-sections" : ""}`}
      aria-label="전문가 자문 의견서 출력 미리보기"
      style={{
        "--advisory-square-font-size": `${squareBulletFontSize}pt`,
        "--advisory-triangle-font-size": `${triangleBulletFontSize}pt`
      } as React.CSSProperties}
    >
      <div className="advisory-preview-gradient" />
      <div className="advisory-preview-kicker">지역성장인재양성체계(앵커)사업</div>
      <h2 className="advisory-document-title">전문가 자문 의견서</h2>
      <div className="advisory-preview-gradient" />
      <table className="advisory-preview-meta">
        <tbody>
          <tr><th>소속 / 직위</th><td>{affiliation}</td><td>{position}</td></tr>
          <tr><th>자 문 일 시</th><td colSpan={2}>{consultationDate}</td></tr>
          <tr><th>자 문 제 목</th><td colSpan={2}>{opinionTitle || meeting.title}</td></tr>
        </tbody>
      </table>
      <h3 className="advisory-preview-content-title">자문 내용</h3>
      <div className="advisory-preview-content">
        {selectedSections.includes("operation") && <section className="advisory-preview-fixed-block">
          <h4>□ {ADVISORY_OPERATION_HEADING}</h4>
          {operationOpinion.trim() ? renderMarkdown(operationOpinion) : <p className="advisory-preview-placeholder">의견을 입력해 주세요.</p>}
        </section>}
        {selectedSections.includes("bestPractice") && <section className="advisory-preview-fixed-block">
          <h4>□ {ADVISORY_BEST_PRACTICE_HEADING}</h4>
          {bestPracticeOpinion.trim() ? renderMarkdown(bestPracticeOpinion) : <p className="advisory-preview-placeholder">우수사례를 입력해 주세요.</p>}
        </section>}
        {selectedSections.includes("improvement") && <section className="advisory-preview-fixed-block">
          <h4>□ {ADVISORY_IMPROVEMENT_HEADING}</h4>
          {improvementOpinion.trim() ? renderMarkdown(improvementOpinion) : <p className="advisory-preview-placeholder">개선 의견을 입력해 주세요.</p>}
        </section>}
      </div>
      <footer className="advisory-opinion-signature">
        <p className="advisory-opinion-submitted-date">제출일 : {submittedDate}</p>
        <p className="advisory-opinion-signer"><span>성명: <strong>{member.name}</strong></span><span className="advisory-signature-mark"><span>(서명)</span>{signatureUrl && <img src={signatureUrl} alt="자문의견서 서명" />}</span></p>
        <p className="advisory-opinion-recipient">울산과학대학교 앵커사업단장 귀하</p>
      </footer>
    </article>
  );
}
