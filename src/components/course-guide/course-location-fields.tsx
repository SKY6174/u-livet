"use client";

import { useState } from "react";
import { formatCourseLocationRows, MAX_COURSE_LOCATION_LENGTH, MAX_COURSE_LOCATIONS, parseCourseLocationRows, type CourseLocationRow } from "@/lib/course-guide/locations";

export function CourseLocationFields({ initialLocation }: { initialLocation: string }) {
  const [places, setPlaces] = useState(() => parseCourseLocationRows(initialLocation));
  const [edited, setEdited] = useState(false);
  const formatted = formatCourseLocationRows(places);
  const location = edited ? formatted ?? "" : initialLocation;
  const update = (index: number, field: keyof CourseLocationRow, value: string) => {
    setEdited(true);
    setPlaces(current => current.map((place, position) => position === index ? { ...place, [field]: value } : place));
  };

  return <fieldset className="min-w-0 space-y-3">
    <legend className="text-sm font-semibold">교육장소</legend>
    <p className="text-xs font-normal text-slate-600">날짜나 차시에 따라 장소가 다르면 행을 추가하고 비고에 ‘1차시’, ‘10/17·24’처럼 적어주세요.</p>
    {places.map((place, index) => <div key={index} className="grid min-w-0 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[5rem_8rem_minmax(0,1fr)_minmax(0,0.7fr)_4.5rem] lg:items-end">
      <span className="self-center text-sm font-semibold text-slate-700">장소 {index + 1}</span>
      <label className="field text-sm">구분
        <select aria-label={`장소 ${index + 1} 구분`} value={place.kind} onChange={event => update(index, "kind", event.target.value)}>
          <option value="INTERNAL">교내</option><option value="EXTERNAL">교외</option>
        </select>
      </label>
      <label className="field text-sm">강의실(강의실명)·장소명
        <input aria-label={`장소 ${index + 1} 강의실 또는 장소명`} maxLength={80} value={place.room}
          placeholder={place.kind === "INTERNAL" ? "예: 2-417" : "예: 비앤비네오필라테스센터"}
          onChange={event => update(index, "room", event.target.value)} required />
      </label>
      <label className="field text-sm">비고
        <input aria-label={`장소 ${index + 1} 비고`} maxLength={60} value={place.note} placeholder="예: 1차시"
          onChange={event => update(index, "note", event.target.value)} />
      </label>
      {places.length > 1 ? <button type="button" className="btn-secondary !min-h-12 !px-2 !text-sm" aria-label={`교육장소 ${index + 1} 삭제`}
        onClick={() => { setEdited(true); setPlaces(current => current.filter((_, position) => position !== index)); }}>삭제</button> : <span aria-hidden="true" />}
    </div>)}
    <input type="hidden" name="location" value={location} />
    <div className="flex flex-wrap items-center justify-between gap-2">
      <button type="button" className="btn-secondary text-sm" disabled={places.length >= MAX_COURSE_LOCATIONS}
        onClick={() => { setEdited(true); setPlaces(current => [...current, { kind: "INTERNAL", room: "", note: "" }]); }}>+교육장소</button>
      <span className={`text-xs ${edited && !formatted ? "text-red-700" : "text-slate-500"}`}>
        {edited && !formatted ? "장소명과 비고를 확인해 주세요 · " : ""}{location.length}/{MAX_COURSE_LOCATION_LENGTH}자 · 최대 {MAX_COURSE_LOCATIONS}곳
      </span>
    </div>
  </fieldset>;
}
