import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(
  "src/lib/operation-documents/prefilled-data.ts",
  "utf8",
);
const moduleExports = {};
vm.runInNewContext(
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText,
  { exports: moduleExports },
);

const { PREFILLED_COURSES, findPrefilledCourse } = moduleExports;
assert.equal(PREFILLED_COURSES.length, 16, "2026년 원문 과정은 16건이어야 합니다.");
assert.equal(
  PREFILLED_COURSES.filter((course) => course.hasResultReport).length,
  7,
  "결과보고서 원문 보유 과정은 7건이어야 합니다.",
);

for (const key of ["id", "sourceId", "programId", "title"]) {
  const values = PREFILLED_COURSES.map((course) => course[key]);
  assert.equal(
    new Set(values).size,
    values.length,
    `${key} 값은 과정마다 고유해야 합니다.`,
  );
}

const planScheduleKeys = [
  "date",
  "startTime",
  "endTime",
  "topic",
  "instructor",
  "hours",
  "assistant",
  "assistantHours",
  "location",
  "mode",
  "holiday",
].sort();
const warnings = [];

for (const course of PREFILLED_COURSES) {
  assert.match(course.startsOn, /^2026-\d{2}-\d{2}$/);
  assert.match(course.endsOn, /^2026-\d{2}-\d{2}$/);
  assert.ok(course.startsOn <= course.endsOn, `${course.title}: 교육기간 역전`);
  assert.ok(course.scheduleRows.length > 0, `${course.title}: 일정 누락`);
  assert.equal(course.planStatus, undefined, `${course.title}: 추정 계획서 상태 금지`);
  assert.equal(course.resultStatus, undefined, `${course.title}: 추정 결과보고서 상태 금지`);

  let hours = 0;
  for (const [index, row] of course.scheduleRows.entries()) {
    assert.deepEqual(
      Object.keys(row).sort(),
      planScheduleKeys,
      `${course.title} ${index + 1}회차: 현행 일정 스키마 불일치`,
    );
    assert.match(row.date, /^2026-\d{2}-\d{2}$/, `${course.title}: 날짜 형식`);
    assert.match(row.startTime, /^(|([01]\d|2[0-3]):[0-5]\d)$/);
    assert.match(row.endTime, /^(|([01]\d|2[0-3]):[0-5]\d)$/);
    assert.ok(
      !row.startTime || !row.endTime || row.startTime < row.endTime,
      `${course.title}: 시작·종료시간 역전`,
    );
    if (row.date < course.startsOn || row.date > course.endsOn)
      warnings.push(`${course.title}: ${row.date} 일정이 표지 교육기간 밖에 있음`);
    hours += Number(row.hours || 0);
  }
  if (hours !== course.teachingHours)
    warnings.push(
      `${course.title}: 주강사 일정 합계 ${hours}시간 / 표지 ${course.teachingHours}시간`,
    );
}

assert.equal(
  findPrefilledCourse("파크골프지도사 양성(자격증)과정")?.programId,
  "C1-LIFE-CARE-05",
  "운영 DB 과정명과 파크골프 원문을 연결해야 합니다.",
);
assert.equal(
  findPrefilledCourse("반려동물수제간식 만들기")?.programId,
  "C1-LOCAL-BUSINESS-02",
  "운영 DB 과정명과 수제간식 원문을 연결해야 합니다.",
);
assert.equal(
  findPrefilledCourse("“달콤한 도약”: 로컬 쿠키 창업 마스터클래스")?.programId,
  "C1-LOCAL-BUSINESS-01",
  "운영 DB 과정명과 로컬쿠키 원문을 연결해야 합니다.",
);

for (const fabricated of [
  "2026-0001",
  "한국직업능력연구원 등록기관",
  "출석률 80% 이상 수료생 대상 장학금 지급",
  'content.fields.satisfaction = "95.5"',
])
  assert.equal(source.includes(fabricated), false, `추정값 제거 필요: ${fabricated}`);

console.log(
  `PASS prefilled operation documents: ${PREFILLED_COURSES.length} courses, ${PREFILLED_COURSES.filter((course) => course.hasResultReport).length} source reports`,
);
if (warnings.length) {
  console.log("SOURCE WARNINGS (원문 확인 필요)");
  for (const warning of [...new Set(warnings)]) console.log(`- ${warning}`);
}
