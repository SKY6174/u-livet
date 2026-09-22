export type DocumentKind = "plan" | "result";
export type Field = {
  key: string;
  label: string;
  type: "text" | "long" | "number" | "date" | "time";
  required?: boolean;
  max: number;
};
export type Table = {
  key: string;
  label: string;
  columns: Field[];
  min?: number;
  max: number;
};
export type Section = {
  key: string;
  label: string;
  fields?: Field[];
  tables?: Table[];
};
const f = (
  key: string,
  label: string,
  type: Field["type"] = "text",
  required = false,
): Field => ({
  key,
  label,
  type,
  required,
  max: type === "long" ? 5000 : type === "number" ? 12 : 500,
});
const t = (
  key: string,
  label: string,
  columns: Field[],
  min = 0,
  max = 60,
): Table => ({ key, label, columns, min, max });
export const COMMON = [
  f("title", "과정명", "text", true),
  f("year", "학년도", "number", true),
  f("academy", "영역 / 아카데미", "text", true),
  f("program", "세부프로그램명", "text", true),
  f("professor", "담당 교수 / 책임강사", "text", true),
  f("documentDate", "작성일", "date", true),
  f("startsOn", "교육 시작일", "date", true),
  f("endsOn", "교육 종료일", "date", true),
];
export const SCHEDULE = [
  f("date", "일자", "date"),
  f("startTime", "시작시간", "time"),
  f("endTime", "종료시간", "time"),
  f("topic", "강의주제 및 내용"),
  f("instructor", "주강사명"),
  f("hours", "주강사 교육시간", "number"),
  f("assistant", "보조강사명"),
  f("assistantHours", "보조강사 교육시간", "number"),
  f("location", "교육장소"),
];
export const RECRUITMENT = [
  "일반인",
  "재직자",
  "경력단절여성",
  "다문화가정",
  "취약계층",
  "고령자",
  "자격증소지자",
  "장애인",
  "기타",
];
export const ACADEMIES = [
  "스마트테크 아카데미",
  "라이프케어 아카데미",
  "로컬창업 아카데미",
  "팝업 아카데미",
];
export const PLAN_SECTIONS: Section[] = [
  {
    key: "cover",
    label: "표지 · 기본정보",
    fields: [
      ...COMMON,
      f("audience", "주요대상 (성인학습자 / 지역주민)", "text", true),
    ],
  },
  {
    key: "overview",
    label: "1. 과정 개요",
    fields: [
      f("content", "1-2. 주요내용", "long", true),
      f("method", "1-3. 교육방법", "long", true),
      f("effects", "1-4. 기대효과", "long", true),
    ],
  },
  {
    key: "recruitment",
    label: "2. 모집 대상 계획",
    fields: [
      f("capacity", "가. 모집인원", "number", true),
      f(
        "purposes",
        "다. 주요목적 (자격증 / 취창업 / 취미·여가 / 자기계발 / 진로진학 / 기타)",
        "text",
        true,
      ),
    ],
    tables: [
      t(
        "recruitment",
        "나. 주요대상",
        [
          f("category", "구분"),
          f("count", "인원", "number"),
          f("ratio", "비율 (%)", "number"),
        ],
        1,
        9,
      ),
    ],
  },
  {
    key: "governance",
    label: "3. 거버넌스 활용 계획",
    fields: [
      f("partner", "거버넌스 기관명", "text", true),
      f("partnerField", "거버넌스 기관 분야", "text", true),
      f("partnerDevelopment", "교육과정개발 연계", "long", true),
      f("partnerEmployment", "취·창업 연계", "long", true),
      f("partnerInternship", "인턴십 연계", "long", true),
      f("partnerService", "봉사 및 기여활동", "long", true),
      f("partnerFollowUp", "교육종료 후 활성화 방안", "long", true),
    ],
  },
  {
    key: "qualifications",
    label: "4. 관련 자격증",
    fields: [
      f(
        "qualificationNote",
        "자격증 과정 해당 여부 / 비해당 사유",
        "text",
        true,
      ),
      f(
        "issuerInfo",
        "민간자격 발급기관 정보 (기관명·대표자·연락처·이메일·소재지·홈페이지)",
        "long",
      ),
      f("refundPolicy", "민간자격 환불규정", "long"),
    ],
    tables: [
      t(
        "national",
        "가. 국가자격증",
        [
          f("name", "자격명 (자격종류)"),
          f("issuer", "발급기관명 (홈페이지)"),
          f("exam", "시험일정"),
          f("cost", "응시료·자격발급비"),
          f("refund", "자격발급 환불규정"),
          f("contact", "연락처"),
        ],
        0,
        10,
      ),
      t(
        "private",
        "나. 민간자격증",
        [
          f("name", "자격명"),
          f("kind", "자격의 종류"),
          f("registration", "등록번호"),
          f("issuer", "자격발급기관"),
          f("cost", "총비용 및 세부내역"),
        ],
        0,
        10,
      ),
    ],
  },
  {
    key: "schedule",
    label: "5. 강의계획",
    tables: [
      t(
        "schedule",
        "회차별 강의계획",
        [
          ...SCHEDULE,
          f("mode", "수업방식"),
          f("holiday", "공휴일 수업여부 / 보강 날짜"),
        ],
        1,
      ),
    ],
  },
  {
    key: "staff",
    label: "6~8. 강사·보조인력",
    fields: [
      f("staffNote", "보조강사·보조인력 해당 여부 및 비고", "long", true),
    ],
    tables: [
      t(
        "instructors",
        "6. 강사현황",
        [
          f("affiliation", "소속"),
          f("position", "직위"),
          f("name", "성명"),
          f("theory", "이론 시수", "number"),
          f("practice", "실습 시수", "number"),
        ],
        1,
      ),
      t("assistants", "7. 보조강사현황", [
        f("affiliation", "소속"),
        f("position", "직위"),
        f("name", "성명"),
        f("hours", "근무시수", "number"),
        f("note", "비고"),
      ]),
      t("support", "8. 보조인력 현황", [
        f("department", "학과"),
        f("studentId", "학번"),
        f("name", "성명"),
        f("hours", "근무시수", "number"),
        f("note", "비고"),
      ]),
    ],
  },
];
export const RESULT_SECTIONS: Section[] = [
  { key: "cover", label: "표지 · 기본정보", fields: COMMON },
  {
    key: "overview",
    label: "1~2. 프로그램 · 주요내용",
    fields: [f("content", "2. 주요내용", "long", true)],
  },
  {
    key: "performance",
    label: "3. 운영 성과",
    fields: [
      f("capacity", "모집정원", "number", true),
      f("enrolled", "모집인원", "number", true),
      f("completed", "수료인원", "number", true),
      f("certificates", "자격증 취득 수", "number", true),
      f("employed", "취창업인원", "number", true),
      f("surveyResponses", "이수자 교육만족 응답수", "number", true),
      f("satisfaction", "교육만족도율 (%)", "number", true),
      f("photoNote", "운영사진 설명 / 미첨부 사유", "long", true),
    ],
  },
  {
    key: "schedule",
    label: "4. 강사별 교육시간 상세 내역",
    tables: [t("schedule", "회차별 교육 내역", SCHEDULE, 1)],
  },
  {
    key: "quality",
    label: "6. 프로그램 품질 개선",
    fields: [
      f("method", "교육방법", "long", true),
      f("education", "교육내용", "long", true),
      f("promotion", "교육생 모집 홍보", "long", true),
      f("other", "기타", "long", true),
    ],
  },
  {
    key: "review",
    label: "7. 총평 · 환류 계획",
    fields: [
      f("strengths", "우수한 점", "long", true),
      f("strengthsNote", "우수한 점 비고"),
      f("improvements", "개선할 점", "long", true),
      f("improvementsNote", "개선할 점 비고"),
      f("followUp", "환류 계획", "long", true),
      f("followUpNote", "환류 계획 비고"),
    ],
  },
];
export const BUDGET_CATEGORIES = {
  plan: [
    "내부강사",
    "외부강사",
    "보조강사",
    "보조인력",
    "장학금",
    "운영비",
    "인쇄비",
    "재료비",
    "수강료",
  ],
  result: ["운영비", "인쇄비", "재료비", "강사료"],
};
export const PHOTO_CAPTIONS = [
  "개강식",
  "수료식",
];
export const MAX_OPERATION_PHOTOS = 30;
export const sections = (kind: DocumentKind) =>
  kind === "plan" ? PLAN_SECTIONS : RESULT_SECTIONS;
export const fields = (kind: DocumentKind) =>
  sections(kind).flatMap((s) => s.fields ?? []);
export const tables = (kind: DocumentKind) =>
  sections(kind).flatMap((s) => s.tables ?? []);
export const documentLabel = (kind: DocumentKind) =>
  kind === "plan" ? "운영계획서" : "운영결과보고서";
