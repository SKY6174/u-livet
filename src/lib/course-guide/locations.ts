export const MAX_COURSE_LOCATIONS = 3;
export const MAX_COURSE_LOCATION_LENGTH = 160;
export type CourseLocationRow = { kind: "INTERNAL" | "EXTERNAL"; room: string; note: string };

export function parseCourseLocations(value: string): string[] {
  const lines = value.includes("\n") ? value.split(/\r?\n/) : value.split(/,\s*/);
  const places = lines.map(part => part.trim()).filter(Boolean);
  return places.length > MAX_COURSE_LOCATIONS ? [value.trim()] : places.length ? places : [""];
}

export function joinCourseLocations(places: string[]): string {
  return places.map(place => place.trim()).filter(Boolean).join("\n");
}

export function validCourseLocation(value: string): boolean {
  const places = value.split(/\r?\n/).map(place => place.trim());
  return value.length <= MAX_COURSE_LOCATION_LENGTH && places.length <= MAX_COURSE_LOCATIONS &&
    places.every(place => place.length > 0 && place.length <= MAX_COURSE_LOCATION_LENGTH);
}

export function parseCourseLocationRows(value: string): CourseLocationRow[] {
  return parseCourseLocations(value).map(place => {
    const parts = place.split(" · ");
    if (parts[0] === "교내" || parts[0] === "교외") {
      return { kind: parts[0] === "교내" ? "INTERNAL" : "EXTERNAL", room: parts[1] ?? "", note: parts.slice(2).join(" · ") };
    }
    const legacyNote = place.match(/^(첫날|이후|\d{1,2}\/\d{1,2}(?:[·.]\d{1,2})*)\s*(.+)$/);
    const legacyRoom = legacyNote?.[2] ?? place;
    const explicitKind = legacyRoom.match(/^(교내|교외)\s+(.+)$/);
    const room = explicitKind?.[2] ?? legacyRoom;
    return {
      kind: explicitKind ? (explicitKind[1] === "교내" ? "INTERNAL" : "EXTERNAL") : /^(?:[A-Za-z]-)?\d+(?:-\d+)?호?$/.test(room) ? "INTERNAL" : "EXTERNAL",
      room,
      note: legacyNote?.[1] ?? "",
    };
  });
}

export function formatCourseLocationRows(rows: CourseLocationRow[]): string | null {
  if (!rows.length || rows.length > MAX_COURSE_LOCATIONS || rows.some(row =>
    !["INTERNAL", "EXTERNAL"].includes(row.kind) || !row.room.trim() ||
    row.room.length > 80 || row.note.length > 60 ||
    /[\r\n]/.test(row.room + row.note) || row.room.includes(" · ") || row.note.includes(" · "))) return null;
  const value = rows.map(row => `${row.kind === "INTERNAL" ? "교내" : "교외"} · ${row.room.trim()}${row.note.trim() ? ` · ${row.note.trim()}` : ""}`).join("\n");
  return validCourseLocation(value) ? value : null;
}
