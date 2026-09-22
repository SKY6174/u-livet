export const ADVISORY_OPERATION_HEADING = "사업운영 현황에 대한 의견";
export const ADVISORY_BEST_PRACTICE_HEADING = "타 대학(또는 본인 소속 대학) 우수사례 소개";
export const ADVISORY_IMPROVEMENT_HEADING = "사업운영 개선에 관한 의견";

export type AdvisoryOpinionSectionKey = "operation" | "bestPractice" | "improvement";

export interface AdvisoryOpinionSections {
  operationOpinion: string;
  bestPracticeOpinion: string;
  improvementOpinion: string;
  selectedSections?: AdvisoryOpinionSectionKey[];
  preservedMarkdown?: string;
}

const cleanSection = (value: string): string => value.trim().replace(/^[-*]\s*$/gm, "").trim();

export const composeAdvisoryOpinionMarkdown = ({
  operationOpinion,
  bestPracticeOpinion,
  improvementOpinion,
  selectedSections,
  preservedMarkdown
}: AdvisoryOpinionSections): string => {
  const sections: Array<{ key: AdvisoryOpinionSectionKey; heading: string; value: string }> = [
    { key: "operation", heading: ADVISORY_OPERATION_HEADING, value: operationOpinion },
    { key: "bestPractice", heading: ADVISORY_BEST_PRACTICE_HEADING, value: bestPracticeOpinion },
    { key: "improvement", heading: ADVISORY_IMPROVEMENT_HEADING, value: improvementOpinion }
  ];
  const inferredSelection = sections.filter(section => section.value.trim()).map(section => section.key);
  const activeSelection = new Set(selectedSections?.length ? selectedSections : inferredSelection);
  const currentForm = sections
    .filter(section => activeSelection.has(section.key))
    .flatMap(section => [`## ${section.heading}`, cleanSection(section.value), ""])
    .join("\n").trim();
  const preserved = String(preservedMarkdown || "").trim();
  return preserved ? `${currentForm}\n\n${preserved}` : currentForm;
};

export const parseAdvisoryOpinionMarkdown = (markdown: string): AdvisoryOpinionSections => {
  const operationLines: string[] = [];
  const bestPracticeLines: string[] = [];
  const improvementLines: string[] = [];
  const preservedLines: string[] = [];
  const selectedSections: AdvisoryOpinionSectionKey[] = [];
  let target: AdvisoryOpinionSectionKey | "preserved" = "preserved";
  for (const line of String(markdown || "").split(/\r?\n/)) {
    const heading = /^#{1,6}\s+(.+)$/.exec(line.trim())?.[1]?.trim();
    if (heading) {
      if (heading === ADVISORY_OPERATION_HEADING) target = "operation";
      else if (heading === ADVISORY_BEST_PRACTICE_HEADING) target = "bestPractice";
      else if (heading === ADVISORY_IMPROVEMENT_HEADING) target = "improvement";
      else {
        target = "preserved";
        preservedLines.push(line);
      }
      if (target !== "preserved" && !selectedSections.includes(target)) selectedSections.push(target);
      continue;
    }
    if (target === "operation") operationLines.push(line);
    else if (target === "bestPractice") bestPracticeLines.push(line);
    else if (target === "improvement") improvementLines.push(line);
    else preservedLines.push(line);
  }
  return {
    operationOpinion: cleanSection(operationLines.join("\n")),
    bestPracticeOpinion: cleanSection(bestPracticeLines.join("\n")),
    improvementOpinion: cleanSection(improvementLines.join("\n")),
    selectedSections,
    preservedMarkdown: preservedLines.join("\n").trim()
  };
};
