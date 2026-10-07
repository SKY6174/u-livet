"use client";

import { useState } from "react";
import { joinCourseLocations, MAX_COURSE_LOCATION_LENGTH, MAX_COURSE_LOCATIONS, parseCourseLocations, validCourseLocation } from "@/lib/course-guide/locations";

export function CourseLocationFields({ initialLocation }: { initialLocation: string }) {
  const [places, setPlaces] = useState(() => parseCourseLocations(initialLocation));
  const [edited, setEdited] = useState(false);
  const location = edited ? joinCourseLocations(places) : initialLocation;
  const update = (index: number, value: string) => {
    setEdited(true);
    setPlaces(current => current.map((place, position) => position === index ? value : place));
  };

  return <fieldset className="min-w-0 space-y-3">
    <legend className="text-sm font-semibold">교육장소</legend>
    <p className="text-xs font-normal text-slate-600">교내·교외 장소를 각각 입력하세요. 특정 날짜에만 사용하는 장소는 해당 행에 함께 적어주세요.</p>
    {places.map((place, index) => <div key={index} className="flex min-w-0 items-end gap-2">
      <label className="field min-w-0 flex-1">장소 {index + 1}
        <input aria-label={`교육장소 ${index + 1}`} maxLength={MAX_COURSE_LOCATION_LENGTH} value={place}
          placeholder={index === 0 ? "예: 교내 2-417 (첫날)" : "예: 교외 비앤비네오필라테스센터 (이후)"}
          onChange={event => update(index, event.target.value)} required />
      </label>
      {places.length > 1 && <button type="button" className="btn-secondary shrink-0 text-sm" aria-label={`교육장소 ${index + 1} 삭제`}
        onClick={() => { setEdited(true); setPlaces(current => current.filter((_, position) => position !== index)); }}>삭제</button>}
    </div>)}
    <input type="hidden" name="location" value={location} />
    <div className="flex flex-wrap items-center justify-between gap-2">
      <button type="button" className="btn-secondary text-sm" disabled={places.length >= MAX_COURSE_LOCATIONS}
        onClick={() => { setEdited(true); setPlaces(current => [...current, ""]); }}>+교육장소</button>
      <span className={`text-xs ${location.length > MAX_COURSE_LOCATION_LENGTH || (edited && !validCourseLocation(location)) ? "text-red-700" : "text-slate-500"}`}>
        {location.length}/{MAX_COURSE_LOCATION_LENGTH}자 · 최대 {MAX_COURSE_LOCATIONS}곳
      </span>
    </div>
  </fieldset>;
}
