import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const module = { exports: {} };
const code = ts.transpileModule(readFileSync('src/lib/course-guide/model.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
new Function('exports', code)(module.exports);
const m = module.exports;
let count = 0;
function check(name, run) { run(); count++; console.log(`PASS ${name}`); }
check('legacy dates and exact requested display round-trip', () => {
  const dates = m.parseGuidePeriod('2026.10.10–12.05', 2026);
  assert.deepEqual(dates, { startDate: '2026-10-10', endDate: '2026-12-05' });
  const label = m.formatGuidePeriod(dates.startDate, dates.endDate);
  assert.equal(label, '2026. 10. 10. - 12. 5.');
  assert.deepEqual(m.parseGuidePeriod(label, 2026), dates);
  assert.equal(m.guideEndDate(label, 2026), '2026-12-05');
});
check('cross-year dates, ISO and inclusive one-day periods', () => {
  assert.equal(m.guideEndDate('2026.12.20–01.05', 2026), '2027-01-05');
  assert.equal(m.formatGuidePeriod('2026-12-20', '2027-01-05'), '2026. 12. 20. - 2027. 1. 5.');
  assert.equal(m.guideEndDate('2026-10-10 ~ 2026-12-05', 2026), '2026-12-05');
  assert.deepEqual(m.parseGuidePeriod('07.14', 2026), { startDate: '2026-07-14', endDate: '2026-07-14' });
});
check('invalid calendar dates, reversed periods and unknown dates', () => {
  for (const text of ['2026.02.30', '2026.02.29', '2026.13.01', '2026.10.20–10.10', '2027.1.1–2026.12.31']) assert.equal(m.parseGuidePeriod(text, 2026), null);
  assert.equal(m.guideEndDate('2028.2.29', 2028), '2028-02-29');
  assert.equal(m.formatGuidePeriod('2026-10-20', '2026-10-10'), null);
  assert.equal(m.guidePeriodLabel('2026년 12월 예정', 2026), '2026년 12월 예정');
});
check('weekday groups and ranges preserve each original time', () => {
  assert.deepEqual(m.parseGuideSchedule('월·수·금 17:00–21:00').map(r => r.day), ['월', '수', '금']);
  assert.deepEqual(m.parseGuideSchedule('월–목 09:00–18:00').map(r => r.day), ['월', '화', '수', '목']);
  assert.equal(m.formatGuideSchedule(m.parseGuideSchedule('토 14:00–20:00')), '토 14:00 - 20:00');
});
check('multiple weekday times persist and reopen separately', () => {
  const rows = [{ day: '토', startTime: '14:00', endTime: '18:00' }, { day: '일', startTime: '15:00', endTime: '19:00' }];
  const label = m.formatGuideSchedule(rows);
  assert.equal(label, '토 14:00 - 18:00\n일 15:00 - 19:00');
  assert.deepEqual(m.parseGuideSchedule(label), rows);
});
check('missing, malformed and reversed times are rejected', () => {
  for (const text of ['토 18:00 - 14:00', '토 24:00 - 25:00', '토 09:60 - 10:00', '토 14:00 - 14:00', '일–월 09:00 - 18:00', '미정']) assert.equal(m.parseGuideSchedule(text), null);
  assert.equal(m.formatGuideSchedule([{ day: '', startTime: '14:00', endTime: '18:00' }]), null);
  const row = { day: '토', startTime: '14:00', endTime: '18:00' };
  assert.ok(m.formatGuideSchedule(Array(7).fill(row)).length <= 160);
  assert.equal(m.formatGuideSchedule(Array(8).fill(row)), null);
});
check('all existing guides retain dates and times without invented values', () => {
  const guides = JSON.parse(readFileSync('docs/operations/2026-public-course-guides.json')).courses;
  for (const guide of guides) {
    const schedule = m.parseGuideSchedule(guide.time_label);
    assert.ok(schedule, guide.id);
    assert.deepEqual(m.parseGuideSchedule(m.formatGuideSchedule(schedule)), schedule);
    const period = m.parseGuidePeriod(guide.period_label, guide.year);
    if (period) assert.deepEqual(m.parseGuidePeriod(m.guidePeriodLabel(guide.period_label, guide.year), guide.year), period);
    else assert.equal(m.guidePeriodLabel(guide.period_label, guide.year), guide.period_label);
  }
});
check('catalog date filter accepts normalized period and midnight boundary', () => {
  const guide = { id: 'example', name: 'example', period_label: '2026. 10. 10. - 12. 5.', year: 2026, offering_id: null };
  const c = m.mergeCatalog([guide], [])[0];
  assert.equal(c.ends_on, '2026-12-05');
  assert.equal(m.courseIsUpcoming(c, Date.parse('2026-12-05T14:59:59Z')), true);
  assert.equal(m.courseIsUpcoming(c, Date.parse('2026-12-05T15:00:00Z')), false);
});
console.log(`${count} course guide schedule checks passed.`);
